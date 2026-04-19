package store

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"zhblogs.net/src/config"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) ClaimJobs(ctx context.Context, cfg config.Config) ([]JobRecord, error) {
	heartbeatTimeoutMS := maxHeartbeatTimeoutMS(cfg.JobHeartbeatTimeout)

	rows, err := s.pool.Query(ctx, `
with picked as (
	select j.id
	from jobs j
	where (
		(j.status = 'PENDING' and j.run_at <= now())
		or (
			j.status = 'RUNNING'
			and (
				j.heartbeat_time is null
				or j.heartbeat_time <= now() - ($3::bigint * interval '1 millisecond')
			)
		)
	)
	order by
		case when j.status = 'RUNNING' then 0 else 1 end asc,
		coalesce(j.heartbeat_time, j.run_at, j.created_time) asc,
		j.created_time asc
	limit $1
	for update skip locked
)
update jobs as j
set status = 'RUNNING',
	locked_at = now(),
	locked_by = $2,
	heartbeat_time = now(),
	started_time = coalesce(j.started_time, now()),
	finished_time = null,
	updated_time = now()
from picked
where j.id = picked.id
returning
	j.id,
	coalesce(j.schedule_id::text, ''),
	j.task_type,
	j.trigger_source,
	j.payload::text,
	coalesce((
		select ts.request_config_id::text
		from task_schedules ts
		where ts.id = j.schedule_id
	), ''),
	coalesce(j.retry_root_job_id::text, ''),
	coalesce(j.retry_parent_job_id::text, ''),
	coalesce(j.retry_sequence, 0)
`, cfg.ConsumeBatch, cfg.WorkerID, heartbeatTimeoutMS)
	if err != nil {
		return nil, fmt.Errorf("claim jobs: %w", err)
	}
	defer rows.Close()

	jobs := make([]JobRecord, 0, cfg.ConsumeBatch)
	for rows.Next() {
		var row JobRecord
		var payloadText string
		if scanErr := rows.Scan(
			&row.ID,
			&row.ScheduleID,
			&row.TaskType,
			&row.TriggerSource,
			&payloadText,
			&row.RequestConfigID,
			&row.RetryRootJobID,
			&row.RetryParentJobID,
			&row.RetrySequence,
		); scanErr != nil {
			return nil, fmt.Errorf("scan claimed job: %w", scanErr)
		}

		row.Payload = []byte(payloadText)
		jobs = append(jobs, row)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate claimed jobs: %w", err)
	}

	return jobs, nil
}

func (s *Store) TouchRunningJob(
	ctx context.Context,
	jobID string,
	workerID string,
) (JobExecutionState, error) {
	var errorCode string
	var errorMessage string
	err := s.pool.QueryRow(ctx, `
update jobs
set heartbeat_time = now(),
	locked_by = $2,
	updated_time = now()
where id = $1 and status = 'RUNNING'
returning coalesce(error_code, ''), coalesce(error_message, '')
`, jobID, workerID).Scan(&errorCode, &errorMessage)
	if err != nil {
		if err == pgx.ErrNoRows {
			return JobExecutionState{}, fmt.Errorf("touch running job: no running job matched id=%s", jobID)
		}
		return JobExecutionState{}, fmt.Errorf("touch running job: %w", err)
	}

	return JobExecutionState{
		CancelRequested: errorCode == "CANCEL_REQUESTED",
		CancelReason:    errorMessage,
	}, nil
}

func (s *Store) UpdateRunningJobResult(ctx context.Context, jobID string, result map[string]any) error {
	payload, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal running job result: %w", err)
	}

	commandTag, err := s.pool.Exec(ctx, `
update jobs
set result = $2,
	heartbeat_time = now(),
	updated_time = now()
where id = $1
	and status = 'RUNNING'
`, jobID, payload)
	if err != nil {
		return fmt.Errorf("update running job result: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("update running job result: no running job matched id=%s", jobID)
	}

	return nil
}

func (s *Store) MarkJobSucceeded(ctx context.Context, job JobRecord, output map[string]any) error {
	payload, err := json.Marshal(output)
	if err != nil {
		return fmt.Errorf("marshal success output: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
update jobs
set status = 'SUCCEEDED',
	result = $2,
	finished_time = now(),
	locked_at = null,
	locked_by = null,
	heartbeat_time = null,
	error_code = null,
	error_message = null,
	updated_time = now()
where id = $1
`, job.ID, payload)
	if err != nil {
		return fmt.Errorf("mark job succeeded: %w", err)
	}

	return nil
}

func (s *Store) MarkJobFailed(ctx context.Context, job JobRecord, errorCode string, errorMessage string) error {
	_, err := s.pool.Exec(ctx, `
update jobs
set status = 'FAILED',
	finished_time = now(),
	locked_at = null,
	locked_by = null,
	heartbeat_time = null,
	error_code = $2,
	error_message = $3,
	updated_time = now()
where id = $1
`, job.ID, limitVarchar(errorCode, 64), errorMessage)
	if err != nil {
		return fmt.Errorf("mark job failed: %w", err)
	}

	return nil
}

func (s *Store) CreateRetryJob(ctx context.Context, job JobRecord, runAt time.Time) error {
	jobID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate retry job id: %w", err)
	}

	retryRootID := job.RetryRootJobID
	if retryRootID == "" {
		retryRootID = job.ID
	}

	_, err = s.pool.Exec(ctx, `
insert into jobs (
	id,
	schedule_id,
	task_type,
	trigger_source,
	status,
	payload,
	retry_root_job_id,
	retry_parent_job_id,
	retry_sequence,
	run_at,
	result
)
values (
	$1,
	nullif($2, '')::uuid,
	$3,
	$4,
	'PENDING',
	$5,
	nullif($6, '')::uuid,
	$7::uuid,
	$8,
	$9,
	'{}'::jsonb
)
`, jobID, job.ScheduleID, job.TaskType, job.TriggerSource, json.RawMessage(job.Payload), retryRootID, job.ID, job.RetrySequence+1, runAt)
	if err != nil {
		return fmt.Errorf("create retry job: %w", err)
	}

	return nil
}

func (s *Store) MarkJobCanceled(ctx context.Context, job JobRecord, reason string) error {
	_, err := s.pool.Exec(ctx, `
update jobs
set status = 'CANCELED',
	finished_time = now(),
	locked_at = null,
	locked_by = null,
	heartbeat_time = null,
	error_code = 'MANUAL_CANCELED',
	error_message = $2,
	updated_time = now()
where id = $1
`, job.ID, reason)
	if err != nil {
		return fmt.Errorf("mark job canceled: %w", err)
	}

	return nil
}

func (s *Store) JobCounts(ctx context.Context) (JobCounts, error) {
	var counts JobCounts
	err := s.pool.QueryRow(ctx, `
select
	count(*) filter (where status = 'PENDING')::int as pending_jobs,
	count(*) filter (where status = 'RUNNING')::int as running_jobs
from jobs
`).Scan(&counts.Pending, &counts.Running)
	if err != nil {
		return JobCounts{}, fmt.Errorf("count job statuses: %w", err)
	}

	return counts, nil
}

func newUUIDV7String() (string, error) {
	var value [16]byte
	unixMilli := uint64(time.Now().UnixMilli())

	value[0] = byte(unixMilli >> 40)
	value[1] = byte(unixMilli >> 32)
	value[2] = byte(unixMilli >> 24)
	value[3] = byte(unixMilli >> 16)
	value[4] = byte(unixMilli >> 8)
	value[5] = byte(unixMilli)

	if _, err := rand.Read(value[6:]); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}

	value[6] = (value[6] & 0x0f) | 0x70
	value[8] = (value[8] & 0x3f) | 0x80

	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		value[0:4],
		value[4:6],
		value[6:8],
		value[8:10],
		value[10:16],
	), nil
}

func maxHeartbeatTimeoutMS(timeout time.Duration) int64 {
	if timeout <= 0 {
		return 45_000
	}

	return max(timeout.Milliseconds(), 1)
}
