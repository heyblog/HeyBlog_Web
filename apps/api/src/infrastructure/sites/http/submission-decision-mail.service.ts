import type { AppConfig } from '@/infrastructure/app/http/app-config.service';

import { sendMailThroughSmtp } from './submission-mail-smtp.service';

export interface SubmissionDecisionMailInput {
  recipient: string;
  auditId: string;
  siteName: string;
  action: string;
  status: 'APPROVED' | 'REJECTED';
  reviewerComment: string | null;
  queryUrl: string;
}

export const canSendSubmissionDecisionMail = (config: AppConfig): boolean =>
  Boolean(config.API_SMTP_HOST && config.API_SMTP_PORT && config.API_SMTP_FROM);

export async function sendSubmissionDecisionMail(
  config: AppConfig,
  payload: SubmissionDecisionMailInput,
): Promise<void> {
  if (!canSendSubmissionDecisionMail(config)) {
    return;
  }

  const subject =
    payload.status === 'APPROVED'
      ? `[ZHBlogs] 站点提交已通过：${payload.siteName}`
      : `[ZHBlogs] 站点提交未通过：${payload.siteName}`;

  const text = [
    `站点：${payload.siteName}`,
    `动作：${payload.action}`,
    `结果：${payload.status === 'APPROVED' ? '已通过' : '已拒绝'}`,
    `审核编号：${payload.auditId}`,
    `查询地址：${payload.queryUrl}`,
    payload.reviewerComment ? `审核备注：${payload.reviewerComment}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await sendMailThroughSmtp(config, {
    to: payload.recipient,
    subject,
    text,
  });
}
