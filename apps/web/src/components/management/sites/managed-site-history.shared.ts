export interface SiteHistoryItem {
  id: string;
  action: string;
  status: string;
  operator_name: string;
  reviewer_comment: string | null;
  submit_reason: string | null;
  change_summary: string;
  created_time: string;
  reviewed_time: string | null;
}
