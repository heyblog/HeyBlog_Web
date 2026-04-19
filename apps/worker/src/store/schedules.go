package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

func (s *Store) LoadDueSchedules(ctx context.Context, batch int) ([]ScheduleRecord, error) {
	rows, err := s.pool.Query(ctx, `
select
	id,
	name,
	task_type,
	schedule_mode,
	coalesce(request_config_id::text, ''),
	schedule_config::text,
	payload_template::text,
	next_run_time
from task_schedules
where is_enabled = true
	and schedule_mode in ('CRON', 'INTERVAL')
	and (next_run_time is null or next_run_time <= now())
order by coalesce(next_run_time, created_time) asc
limit $1
`, batch)
	if err != nil {
		return nil, fmt.Errorf("load due schedules: %w", err)
	}
	defer rows.Close()

	result := make([]ScheduleRecord, 0, batch)
	for rows.Next() {
		var row ScheduleRecord
		var scheduleConfig string
		var payloadTemplate string
		if scanErr := rows.Scan(
			&row.ID,
			&row.Name,
			&row.TaskType,
			&row.ScheduleMode,
			&row.RequestConfigID,
			&scheduleConfig,
			&payloadTemplate,
			&row.NextRunTime,
		); scanErr != nil {
			return nil, fmt.Errorf("scan schedule: %w", scanErr)
		}

		row.ScheduleConfig = []byte(scheduleConfig)
		row.PayloadTemplate = []byte(payloadTemplate)
		result = append(result, row)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate schedules: %w", err)
	}

	return result, nil
}

func (s *Store) InsertScheduledJob(
	ctx context.Context,
	schedule ScheduleRecord,
	payload map[string]any,
	runAt time.Time,
) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal schedule payload: %w", err)
	}

	jobID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate job id: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
insert into jobs (
	id,
	schedule_id,
	task_type,
	trigger_source,
	status,
	payload,
	run_at,
	result
)
values ($1, $2, $3, 'SCHEDULE', 'PENDING', $4, $5, '{}'::jsonb)
`, jobID, schedule.ID, schedule.TaskType, payloadBytes, runAt)
	if err != nil {
		return fmt.Errorf("insert scheduled job: %w", err)
	}

	return nil
}

func (s *Store) UpdateScheduleRunWindow(
	ctx context.Context,
	scheduleID string,
	lastRunTime time.Time,
	nextRunTime time.Time,
) error {
	_, err := s.pool.Exec(ctx, `
update task_schedules
set last_run_time = $2,
	next_run_time = $3,
	updated_time = now()
where id = $1
`, scheduleID, lastRunTime, nextRunTime)
	if err != nil {
		return fmt.Errorf("update schedule run window: %w", err)
	}

	return nil
}
