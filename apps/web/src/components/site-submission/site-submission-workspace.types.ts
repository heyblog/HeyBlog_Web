import type { AutoFillMissingState } from '@/application/site-submission/site-submission.browser-workspace';
import type {
  ActiveSubmissionSummary,
  CreateSubmissionFormState,
  DeleteSubmissionFormState,
  FieldErrors,
  QuerySubmissionFormState,
  RestoreSubmissionFormState,
  RestoreTargetResult,
  SiteResolveResult,
  SiteSearchItem,
  SiteSubmissionOptionsResult,
  SubmissionDuplicateReviewPayload,
  SubmissionPage,
  SubmissionResult,
  SubmissionStatusResult,
  UpdateSubmissionFormState,
} from '@/application/site-submission/site-submission.service';

export type SiteFormKind = 'create' | 'update';

export type ValueState<T> = {
  get: () => T;
  set: (value: T) => void;
};

export interface CreateSubmissionDuplicateDialogState {
  code:
    | 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED'
    | 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED'
    | 'SITE_RESTORE_REQUIRED';
  message: string;
  review: SubmissionDuplicateReviewPayload;
}

export interface BlockedSubmissionNoticeState {
  message: string;
  submission: ActiveSubmissionSummary;
}

export interface SiteSubmissionWorkspaceControllerContext {
  activePage: SubmissionPage;
  options: ValueState<SiteSubmissionOptionsResult>;
  optionsPending: ValueState<boolean>;
  forms: {
    create: ValueState<CreateSubmissionFormState>;
    update: ValueState<UpdateSubmissionFormState>;
    delete: ValueState<DeleteSubmissionFormState>;
    restore: ValueState<RestoreSubmissionFormState>;
    query: ValueState<QuerySubmissionFormState>;
  };
  errors: {
    create: ValueState<FieldErrors>;
    update: ValueState<FieldErrors>;
    delete: ValueState<FieldErrors>;
    restore: ValueState<FieldErrors>;
    query: ValueState<FieldErrors>;
    queryError: ValueState<string | null>;
  };
  success: {
    create: ValueState<SubmissionResult | null>;
    update: ValueState<SubmissionResult | null>;
    delete: ValueState<SubmissionResult | null>;
    restore: ValueState<SubmissionResult | null>;
    query: ValueState<SubmissionStatusResult | null>;
  };
  duplicate: {
    create: ValueState<CreateSubmissionDuplicateDialogState | null>;
  };
  blockedSubmission: ValueState<BlockedSubmissionNoticeState | null>;
  pending: {
    create: ValueState<boolean>;
    update: ValueState<boolean>;
    delete: ValueState<boolean>;
    restore: ValueState<boolean>;
    query: ValueState<boolean>;
    search: ValueState<boolean>;
    resolve: ValueState<boolean>;
    autoFill: ValueState<boolean>;
    autoFillTarget: ValueState<SiteFormKind | null>;
  };
  search: {
    query: ValueState<string>;
    results: ValueState<SiteSearchItem[]>;
    error: ValueState<string | null>;
    selectedSite: ValueState<SiteResolveResult | null>;
  };
  restore: {
    target: ValueState<RestoreTargetResult | null>;
  };
  autoFillMissing: {
    create: ValueState<AutoFillMissingState>;
    update: ValueState<AutoFillMissingState>;
  };
  programPicker: {
    create: ValueState<string>;
    update: ValueState<string>;
  };
}
