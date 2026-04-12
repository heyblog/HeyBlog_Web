import { describe, expect, it } from 'vitest';

import { createEmptyAutoFillMissingState } from '@/application/site-submission/site-submission.browser-workspace';
import type {
  RestoreTargetResult,
  SiteResolveResult,
  SiteSearchItem,
  SiteSubmissionOptionsResult,
  SubmissionResult,
  SubmissionStatusResult,
} from '@/application/site-submission/site-submission.service';
import {
  createInitialCreateForm,
  createInitialDeleteForm,
  createInitialQueryForm,
  createInitialRestoreForm,
  createInitialUpdateForm,
} from '@/application/site-submission/site-submission.service';
import type {
  BlockedSubmissionNoticeState,
  CreateSubmissionDuplicateDialogState,
  SiteSubmissionWorkspaceControllerContext,
  ValueState,
} from '@/components/site-submission/site-submission-workspace.types';
import { createSiteSubmissionWorkspaceFormController } from '@/components/site-submission/site-submission-workspace-form-controller';

function createState<T>(initial: T): ValueState<T> {
  let current = initial;

  return {
    get: () => current,
    set: (value) => {
      current = value;
    },
  };
}

function createController() {
  const context: SiteSubmissionWorkspaceControllerContext = {
    activePage: 'create',
    options: createState<SiteSubmissionOptionsResult>({
      main_tags: [],
      sub_tags: [],
      programs: [],
      tech_stacks: [],
    }),
    optionsPending: createState(false),
    forms: {
      create: createState(createInitialCreateForm()),
      update: createState(createInitialUpdateForm()),
      delete: createState(createInitialDeleteForm()),
      restore: createState(createInitialRestoreForm()),
      query: createState(createInitialQueryForm()),
    },
    errors: {
      create: createState({}),
      update: createState({}),
      delete: createState({}),
      restore: createState({}),
      query: createState({}),
      queryError: createState<string | null>(null),
    },
    success: {
      create: createState<SubmissionResult | null>(null),
      update: createState<SubmissionResult | null>(null),
      delete: createState<SubmissionResult | null>(null),
      restore: createState<SubmissionResult | null>(null),
      query: createState<SubmissionStatusResult | null>(null),
    },
    duplicate: {
      create: createState<CreateSubmissionDuplicateDialogState | null>(null),
    },
    blockedSubmission: createState<BlockedSubmissionNoticeState | null>(null),
    pending: {
      create: createState(false),
      update: createState(false),
      delete: createState(false),
      restore: createState(false),
      query: createState(false),
      search: createState(false),
      resolve: createState(false),
      autoFill: createState(false),
      autoFillTarget: createState<'create' | 'update' | null>(null),
    },
    search: {
      query: createState(''),
      results: createState<SiteSearchItem[]>([]),
      error: createState<string | null>(null),
      selectedSite: createState<SiteResolveResult | null>(null),
    },
    restore: {
      target: createState<RestoreTargetResult | null>(null),
    },
    autoFillMissing: {
      create: createState(createEmptyAutoFillMissingState()),
      update: createState(createEmptyAutoFillMissingState()),
    },
    programPicker: {
      create: createState(''),
      update: createState(''),
    },
  };

  return {
    context,
    controller: createSiteSubmissionWorkspaceFormController(context),
  };
}

describe('site submission workspace form controller', () => {
  it('hides stale picker selection when the form is using a custom program', () => {
    const { context, controller } = createController();

    context.forms.create.set({
      ...context.forms.create.get(),
      architecture_program_id: '',
      architecture_program_name: 'WPE',
    });
    context.programPicker.create.set('program-wordpress');

    expect(controller.getProgramPickerSelected('create')).toBe('');
  });

  it('applies a full custom program draft through the controller', () => {
    const { context, controller } = createController();

    context.programPicker.create.set('program-wordpress');
    context.autoFillMissing.create.set({
      ...createEmptyAutoFillMissingState(),
      architecture: true,
    });

    controller.applyProgramCustomDraft('create', {
      name: 'WPE',
      isOpenSource: false,
      websiteUrl: '',
      repoUrl: 'https://github.com/example/wpe',
      frameworkIds: ['framework-astro'],
      frameworkCustomNames: ['UnoCSS'],
      languageIds: ['language-node'],
      languageCustomNames: ['TypeScript'],
    });

    expect(context.programPicker.create.get()).toBe('');
    expect(context.autoFillMissing.create.get().architecture).toBe(false);
    expect(context.forms.create.get()).toMatchObject({
      architecture_program_id: '',
      architecture_program_name: 'WPE',
      architecture_program_is_open_source: false,
      architecture_website_url: '',
      architecture_repo_url: 'https://github.com/example/wpe',
      architecture_framework_ids: ['framework-astro'],
      architecture_framework_custom_names: ['UnoCSS'],
      architecture_language_ids: ['language-node'],
      architecture_language_custom_names: ['TypeScript'],
    });
    expect(controller.getProgramPickerSelected('create')).toBe('');
  });
});
