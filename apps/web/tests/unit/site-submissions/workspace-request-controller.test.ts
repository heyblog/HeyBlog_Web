import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requestResolvedSiteMock,
  requestSearchSitesMock,
  requestSiteAutoFillMock,
  requestSubmissionMutationMock,
  requestSubmissionOptionsMock,
  requestSubmissionQueryMock,
} = vi.hoisted(() => ({
  requestResolvedSiteMock: vi.fn(),
  requestSearchSitesMock: vi.fn(),
  requestSiteAutoFillMock: vi.fn(),
  requestSubmissionMutationMock: vi.fn(),
  requestSubmissionOptionsMock: vi.fn(),
  requestSubmissionQueryMock: vi.fn(),
}));

const { clearSubmissionIdentifierSearchParamsMock } = vi.hoisted(() => ({
  clearSubmissionIdentifierSearchParamsMock: vi.fn(),
}));

vi.mock('@/application/site-submission/site-submission.browser-actions', () => ({
  requestResolvedSite: requestResolvedSiteMock,
  requestSearchSites: requestSearchSitesMock,
  requestSiteAutoFill: requestSiteAutoFillMock,
  requestSubmissionMutation: requestSubmissionMutationMock,
  requestSubmissionOptions: requestSubmissionOptionsMock,
  requestSubmissionQuery: requestSubmissionQueryMock,
}));

vi.mock('@/application/site-submission/site-submission.browser-feedback', () => ({
  clearSubmissionIdentifierSearchParams: clearSubmissionIdentifierSearchParamsMock,
}));

import { createEmptyAutoFillMissingState } from '@/application/site-submission/site-submission.browser-workspace';
import {
  createInitialCreateForm,
  createInitialDeleteForm,
  createInitialQueryForm,
  createInitialRestoreForm,
  createInitialUpdateForm,
  createUpdateFormFromResolvedSite,
  type RestoreTargetResult,
  type SiteResolveResult,
  type SiteSearchItem,
  type SiteSubmissionOptionsResult,
  type SubmissionPage,
  type SubmissionResult,
  type SubmissionStatusResult,
} from '@/application/site-submission/site-submission.service';
import type {
  BlockedSubmissionNoticeState,
  CreateSubmissionDuplicateDialogState,
  SiteSubmissionWorkspaceControllerContext,
  ValueState,
} from '@/components/site-submission/site-submission-workspace.types';
import { createSiteSubmissionWorkspaceFormController } from '@/components/site-submission/site-submission-workspace-form-controller';
import { createSiteSubmissionWorkspaceRequestController } from '@/components/site-submission/site-submission-workspace-request-controller';

function createState<T>(initial: T): ValueState<T> {
  let current = initial;

  return {
    get: () => current,
    set: (value) => {
      current = value;
    },
  };
}

function createResolvedSiteFixture(): SiteResolveResult {
  return {
    site_id: '11111111-1111-7111-8111-111111111111',
    bid: 'example-blog',
    name: 'Example Blog',
    url: 'https://example.com',
    sign: 'Original sign',
    feed: [
      {
        name: '默认订阅',
        url: 'https://example.com/feed',
        isDefault: true,
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
    link_page: 'https://example.com/friends',
    main_tag_id: 'main-tag-id',
    sub_tags: [],
    architecture: null,
  };
}

function createValidCreateForm() {
  const createForm = createInitialCreateForm();

  createForm.name = 'Example Blog';
  createForm.url = 'https://example.com';
  createForm.sign = 'A blog about software';
  createForm.main_tag_id = 'main-tag-id';
  createForm.feeds[0] = {
    ...createForm.feeds[0],
    name: '默认订阅',
    url: 'https://example.com/feed',
    isDefault: true,
  };
  createForm.agree_terms = true;

  return createForm;
}

function createRestoreTargetFixture(): RestoreTargetResult {
  return {
    site_id: '99999999-9999-7999-8999-999999999999',
    bid: 'archived-example',
    name: 'Archived Example',
    url: 'https://example.com',
    reason: 'temporarily offline',
  };
}

function createController(activePage: SubmissionPage = 'create') {
  const context: SiteSubmissionWorkspaceControllerContext = {
    activePage,
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

  const formController = createSiteSubmissionWorkspaceFormController(context);
  const requestController = createSiteSubmissionWorkspaceRequestController(context, formController);

  return {
    context,
    requestController,
  };
}

describe('site submission workspace request controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets the create form and emits shared success feedback after a successful create', async () => {
    const { context, requestController } = createController();
    context.forms.create.set(createValidCreateForm());
    context.autoFillMissing.create.set({
      ...createEmptyAutoFillMissingState(),
      architecture: true,
    });
    context.programPicker.create.set('program-wordpress');

    requestSubmissionMutationMock.mockResolvedValue({
      ok: true,
      data: {
        audit_id: '22222222-2222-7222-8222-222222222222',
        action: 'CREATE',
        status: 'PENDING',
        site_id: null,
      },
    });

    await requestController.submitCreate();

    expect(context.forms.create.get()).toMatchObject({
      name: '',
      url: 'https://',
      sign: '',
      main_tag_id: '',
      submit_reason: '',
      submitter_name: '',
      submitter_email: '',
      notify_by_email: false,
      agree_terms: false,
    });
    expect(context.forms.create.get().feeds).toHaveLength(1);
    expect(context.forms.create.get().feeds[0]?.isDefault).toBe(true);
    expect(context.errors.create.get()).toEqual({});
    expect(context.autoFillMissing.create.get()).toEqual(createEmptyAutoFillMissingState());
    expect(context.programPicker.create.get()).toBe('');
    expect(context.success.create.get()).toEqual({
      audit_id: '22222222-2222-7222-8222-222222222222',
      action: 'CREATE',
      status: 'PENDING',
      site_id: null,
    });
    expect(clearSubmissionIdentifierSearchParamsMock).not.toHaveBeenCalled();
  });

  it('opens a weak-duplicate confirmation dialog and keeps the create form intact', async () => {
    const { context, requestController } = createController();

    context.forms.create.set(createValidCreateForm());

    requestSubmissionMutationMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
        message: '检测到疑似重复站点，请确认后再继续提交。',
        fieldErrors: {},
        duplicateReview: {
          strong: [],
          weak: [
            {
              site_id: '55555555-5555-7555-8555-555555555555',
              bid: 'example-blog-net',
              name: 'Example Blog',
              url: 'https://example.net',
              visibility: 'VISIBLE',
              reason: '站点名称一致',
            },
          ],
        },
      },
    });

    await requestController.submitCreate();

    expect(context.duplicate.create.get()).toEqual({
      code: 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
      message: '检测到疑似重复站点，请确认后再继续提交。',
      review: {
        strong: [],
        weak: [
          {
            site_id: '55555555-5555-7555-8555-555555555555',
            bid: 'example-blog-net',
            name: 'Example Blog',
            url: 'https://example.net',
            visibility: 'VISIBLE',
            reason: '站点名称一致',
          },
        ],
      },
    });
    expect(context.forms.create.get().name).toBe('Example Blog');
    expect(context.success.create.get()).toBeNull();
  });

  it('resubmits create payload with confirmed weak-duplicate site ids', async () => {
    const { context, requestController } = createController();

    context.forms.create.set(createValidCreateForm());
    context.duplicate.create.set({
      code: 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
      message: '检测到疑似重复站点，请确认后再继续提交。',
      review: {
        strong: [],
        weak: [
          {
            site_id: '55555555-5555-7555-8555-555555555555',
            bid: 'example-blog-net',
            name: 'Example Blog',
            url: 'https://example.net',
            visibility: 'VISIBLE',
            reason: '站点名称一致',
          },
        ],
      },
    });

    requestSubmissionMutationMock.mockResolvedValue({
      ok: true,
      data: {
        audit_id: '66666666-6666-7666-8666-666666666666',
        action: 'CREATE',
        status: 'PENDING',
        site_id: null,
      },
    });

    await requestController.confirmCreateDuplicateReview();

    expect(requestSubmissionMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/site-submissions/create',
        payload: expect.objectContaining({
          duplicate_review: {
            confirmed_site_ids: ['55555555-5555-7555-8555-555555555555'],
          },
        }),
      }),
    );
    expect(context.success.create.get()).toEqual({
      audit_id: '66666666-6666-7666-8666-666666666666',
      action: 'CREATE',
      status: 'PENDING',
      site_id: null,
    });
  });

  it('clears resolved-site state after a successful update', async () => {
    const { context, requestController } = createController();
    const resolvedSite = createResolvedSiteFixture();
    const updateForm = createUpdateFormFromResolvedSite(resolvedSite);

    updateForm.sign = 'Updated sign';
    updateForm.submit_reason = 'Refresh the profile';
    updateForm.agree_terms = true;

    context.search.query.set('https://example.com');
    context.search.results.set([
      {
        site_id: resolvedSite.site_id,
        bid: resolvedSite.bid,
        name: resolvedSite.name,
        url: resolvedSite.url,
      },
    ]);
    context.search.error.set('old error');
    context.search.selectedSite.set(resolvedSite);
    context.forms.update.set(updateForm);
    context.autoFillMissing.update.set({
      ...createEmptyAutoFillMissingState(),
      name: true,
    });
    context.programPicker.update.set('program-astro');

    requestSubmissionMutationMock.mockResolvedValue({
      ok: true,
      data: {
        audit_id: '33333333-3333-7333-8333-333333333333',
        action: 'UPDATE',
        status: 'PENDING',
        site_id: resolvedSite.site_id,
      },
    });

    await requestController.submitUpdate();

    expect(context.search.query.get()).toBe('');
    expect(context.search.results.get()).toEqual([]);
    expect(context.search.error.get()).toBeNull();
    expect(context.search.selectedSite.get()).toBeNull();
    expect(context.forms.update.get()).toMatchObject({
      site_identifier: '',
      name: '',
      url: 'https://',
      sign: '',
      submit_reason: '',
      agree_terms: false,
    });
    expect(context.forms.delete.get()).toMatchObject({
      site_identifier: '',
      submit_reason: '',
      agree_terms: false,
    });
    expect(context.autoFillMissing.update.get()).toEqual(createEmptyAutoFillMissingState());
    expect(context.programPicker.update.get()).toBe('');
    expect(context.success.update.get()).toEqual({
      audit_id: '33333333-3333-7333-8333-333333333333',
      action: 'UPDATE',
      status: 'PENDING',
      site_id: resolvedSite.site_id,
    });
    expect(clearSubmissionIdentifierSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('clears resolved-site state after a successful delete', async () => {
    const { context, requestController } = createController();
    const resolvedSite = createResolvedSiteFixture();

    context.search.query.set('example-blog');
    context.search.results.set([
      {
        site_id: resolvedSite.site_id,
        bid: resolvedSite.bid,
        name: resolvedSite.name,
        url: resolvedSite.url,
      },
    ]);
    context.search.error.set('old error');
    context.search.selectedSite.set(resolvedSite);
    context.forms.delete.set({
      ...createInitialDeleteForm(),
      site_identifier: resolvedSite.site_id,
      submit_reason: 'Site closed',
      agree_terms: true,
    });
    context.autoFillMissing.update.set({
      ...createEmptyAutoFillMissingState(),
      sign: true,
    });
    context.programPicker.update.set('program-astro');

    requestSubmissionMutationMock.mockResolvedValue({
      ok: true,
      data: {
        audit_id: '44444444-4444-7444-8444-444444444444',
        action: 'DELETE',
        status: 'PENDING',
        site_id: resolvedSite.site_id,
      },
    });

    await requestController.submitDelete();

    expect(context.search.query.get()).toBe('');
    expect(context.search.results.get()).toEqual([]);
    expect(context.search.error.get()).toBeNull();
    expect(context.search.selectedSite.get()).toBeNull();
    expect(context.forms.delete.get()).toMatchObject({
      site_identifier: '',
      submit_reason: '',
      agree_terms: false,
    });
    expect(context.autoFillMissing.update.get()).toEqual(createEmptyAutoFillMissingState());
    expect(context.programPicker.update.get()).toBe('');
    expect(context.success.delete.get()).toEqual({
      audit_id: '44444444-4444-7444-8444-444444444444',
      action: 'DELETE',
      status: 'PENDING',
      site_id: resolvedSite.site_id,
    });
    expect(clearSubmissionIdentifierSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('stores restore success in the shared result state and resets the restore form', async () => {
    const { context, requestController } = createController('restore');
    const restoreTarget = createRestoreTargetFixture();

    context.restore.target.set(restoreTarget);
    context.forms.restore.set({
      ...createInitialRestoreForm(),
      submitter_name: 'Alice',
      submitter_email: 'alice@example.com',
      restore_reason: 'Site is back online',
      notify_by_email: true,
      agree_terms: true,
    });

    requestSubmissionMutationMock.mockResolvedValue({
      ok: true,
      data: {
        audit_id: '55555555-5555-7555-8555-555555555555',
        action: 'RESTORE',
        status: 'PENDING',
        site_id: restoreTarget.site_id,
      },
    });

    await requestController.submitRestore();

    expect(context.forms.restore.get()).toEqual(createInitialRestoreForm());
    expect(context.errors.restore.get()).toEqual({});
    expect(context.success.restore.get()).toEqual({
      audit_id: '55555555-5555-7555-8555-555555555555',
      action: 'RESTORE',
      status: 'PENDING',
      site_id: restoreTarget.site_id,
    });
  });

  it('stores the active pending submission when restore is blocked by an existing audit', async () => {
    const { context, requestController } = createController('restore');
    const restoreTarget = createRestoreTargetFixture();

    context.restore.target.set(restoreTarget);
    context.forms.restore.set({
      ...createInitialRestoreForm(),
      restore_reason: 'Site is back online',
      agree_terms: true,
    });

    requestSubmissionMutationMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'PENDING_AUDIT_EXISTS',
        message: 'There is already a pending submission for the target site.',
        fieldErrors: {},
        activeSubmission: {
          audit_id: '66666666-6666-7666-8666-666666666666',
          action: 'RESTORE',
          status: 'PENDING',
          created_time: '2026-04-12T09:00:00.000Z',
          site_id: restoreTarget.site_id,
        },
      },
    });

    await requestController.submitRestore();

    expect(context.blockedSubmission.get()).toEqual({
      message: 'There is already a pending submission for the target site.',
      submission: {
        audit_id: '66666666-6666-7666-8666-666666666666',
        action: 'RESTORE',
        status: 'PENDING',
        created_time: '2026-04-12T09:00:00.000Z',
        site_id: restoreTarget.site_id,
      },
    });
    expect(context.success.restore.get()).toBeNull();
  });

  it('hydrates the restore target when the workspace initializes in restore mode', async () => {
    const { context, requestController } = createController('restore');
    const restoreTarget = createRestoreTargetFixture();

    requestSubmissionOptionsMock.mockResolvedValue(null);

    await requestController.initialize({
      initialIdentifier: '',
      initialAuditId: '',
      initialRestoreTarget: restoreTarget,
    });

    expect(context.restore.target.get()).toEqual(restoreTarget);
    expect(requestSubmissionOptionsMock).toHaveBeenCalledWith('restore');
  });

  it('keeps user input and stores field errors when a mutation request fails', async () => {
    const { context, requestController } = createController();
    const createForm = createInitialCreateForm();

    createForm.name = 'Example Blog';
    createForm.url = 'https://example.com';
    createForm.sign = 'A blog about software';
    createForm.main_tag_id = 'main-tag-id';
    createForm.feeds[0] = {
      ...createForm.feeds[0],
      name: '默认订阅',
      url: 'https://example.com/feed',
      isDefault: true,
    };
    createForm.agree_terms = true;

    context.forms.create.set(createForm);

    requestSubmissionMutationMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Request body contains empty or malformed fields.',
        fieldErrors: {
          submitter_email: '提交者邮箱格式不正确。',
        },
      },
    });

    await requestController.submitCreate();

    expect(context.forms.create.get()).toMatchObject({
      name: 'Example Blog',
      url: 'https://example.com',
      sign: 'A blog about software',
      main_tag_id: 'main-tag-id',
      agree_terms: true,
    });
    expect(context.errors.create.get()).toEqual({
      submitter_email: '提交者邮箱格式不正确。',
    });
    expect(clearSubmissionIdentifierSearchParamsMock).not.toHaveBeenCalled();
  });
});
