import type { AutoFillMissingState } from '@/application/site-submission/site-submission.browser-workspace';

export const WORKSPACE_INPUT_CLASS =
  'min-h-11 w-full rounded-md border border-(--color-line-med) bg-(--color-bg-raised) px-3 py-2.5 text-sm text-(--color-fg) outline-none transition focus:border-red-700/35 dark:focus:border-red-400/35';

export const WORKSPACE_SELECT_CLASS = `${WORKSPACE_INPUT_CLASS} appearance-none pr-9`;

export const WORKSPACE_SELECT_CHEVRON_STYLE =
  "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%23817874' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-size:0.95rem 0.95rem;background-position:right 0.65rem center;";

export const WORKSPACE_TEXTAREA_CLASS =
  'min-h-28 w-full rounded-md border border-(--color-line-med) bg-(--color-bg-raised) px-3 py-2.5 text-sm leading-7 text-(--color-fg) outline-none transition focus:border-red-700/35 dark:focus:border-red-400/35';

export const WORKSPACE_WARNED_INPUT_CLASS =
  'border-[color-mix(in_srgb,var(--color-fail)_52%,var(--color-line-med))] bg-[color-mix(in_srgb,var(--color-fail)_7%,var(--color-bg-raised))]';

export const AUTO_FILL_ALL_MISSING: AutoFillMissingState = {
  name: true,
  sign: true,
  feeds: true,
  sitemap: true,
  linkPage: true,
  architecture: true,
};
