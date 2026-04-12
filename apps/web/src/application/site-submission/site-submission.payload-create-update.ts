import { trimText } from './site-submission.core';
import {
  areEqualJson,
  buildArchitectureFromForm,
  buildFeedInputs,
  isSameAsSiteUrl,
  normalizeArchitectureInput,
  normalizeOptionalSubmitterEmail,
  normalizeResolvedFeed,
  normalizeSubmitterName,
  normalizeSubTagInputs,
  validateContactFields,
  type ValidationResult,
} from './site-submission.payload-shared';
import type {
  CreateSubmissionFormState,
  FieldErrors,
  SiteResolveResult,
  SiteSubmissionCreateRequest,
  SiteSubmissionUpdateRequest,
  UpdateSubmissionFormState,
} from './site-submission.types';

export function buildCreateSubmissionPayload(
  form: CreateSubmissionFormState,
): ValidationResult<SiteSubmissionCreateRequest> {
  const fieldErrors: FieldErrors = {};
  validateContactFields(form, fieldErrors, {
    requireReason: false,
    reasonMessage: '请填写提交说明。',
  });

  const name = trimText(form.name);
  const url = trimText(form.url);
  const sign = trimText(form.sign);
  const sitemap = trimText(form.sitemap);
  const linkPage = trimText(form.link_page);
  const subTags = normalizeSubTagInputs(form.sub_tags);
  const { feed } = buildFeedInputs(form.feeds, fieldErrors);
  const architecture = buildArchitectureFromForm(form, fieldErrors);

  if (!name) {
    fieldErrors.name = '请填写站点名称。';
  }

  if (feed.some((item) => isSameAsSiteUrl(url, item.url))) {
    fieldErrors.feeds = '订阅地址与站点地址相同，请补充具体路径或删除该订阅。';
  }

  if (!sign) {
    fieldErrors.sign = '请填写站点简介。';
  }

  if (!trimText(form.main_tag_id)) {
    fieldErrors.main_tag_id = '请选择主分类。';
  }

  if (sitemap && isSameAsSiteUrl(url, sitemap)) {
    fieldErrors.sitemap = '网站地图地址与站点地址相同，请补充具体路径或清空该字段。';
  }

  if (linkPage && isSameAsSiteUrl(url, linkPage)) {
    fieldErrors.link_page = '友链页面地址与站点地址相同，请补充具体路径或清空该字段。';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      formError: '请先修正表单字段。',
    };
  }

  return {
    ok: true,
    data: {
      submitter_name: normalizeSubmitterName(form.submitter_name),
      submitter_email: normalizeOptionalSubmitterEmail(form.submitter_email),
      submit_reason: trimText(form.submit_reason),
      notify_by_email: form.notify_by_email,
      site: {
        name,
        url,
        sign,
        ...(feed.length > 0 ? { feed } : {}),
        ...(sitemap ? { sitemap } : {}),
        ...(linkPage ? { link_page: linkPage } : {}),
        main_tag_id: trimText(form.main_tag_id),
        ...(subTags.length > 0 ? { sub_tags: subTags } : {}),
        ...(architecture ? { architecture } : {}),
      },
    },
  };
}

export function buildUpdateSubmissionPayload(
  form: UpdateSubmissionFormState,
  current: SiteResolveResult,
): ValidationResult<SiteSubmissionUpdateRequest> {
  const fieldErrors: FieldErrors = {};
  validateContactFields(form, fieldErrors, {
    requireReason: false,
    reasonMessage: '请填写修改原因。',
  });

  const name = trimText(form.name);
  const url = trimText(form.url);
  const sign = trimText(form.sign);
  const sitemap = trimText(form.sitemap);
  const linkPage = trimText(form.link_page);
  const subTags = normalizeSubTagInputs(form.sub_tags);
  const { feed } = buildFeedInputs(form.feeds, fieldErrors);
  const architecture = buildArchitectureFromForm(form, fieldErrors);

  if (!trimText(form.site_identifier)) {
    fieldErrors.site_identifier = '请先选择需要修订的站点。';
  }

  if (!name) {
    fieldErrors.name = '请填写站点名称。';
  }

  if (feed.some((item) => isSameAsSiteUrl(url, item.url))) {
    fieldErrors.feeds = '订阅地址与站点地址相同，请补充具体路径或删除该订阅。';
  }

  if (!sign) {
    fieldErrors.sign = '请填写站点简介。';
  }

  if (!trimText(form.main_tag_id)) {
    fieldErrors.main_tag_id = '请选择主分类。';
  }

  if (sitemap && isSameAsSiteUrl(url, sitemap)) {
    fieldErrors.sitemap = '网站地图地址与站点地址相同，请补充具体路径或清空该字段。';
  }

  if (linkPage && isSameAsSiteUrl(url, linkPage)) {
    fieldErrors.link_page = '友链页面地址与站点地址相同，请补充具体路径或清空该字段。';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      formError: '请先修正表单字段。',
    };
  }

  const changes: SiteSubmissionUpdateRequest['changes'] = {};
  const currentFeed = normalizeResolvedFeed(current.feed ?? []);
  const nextFeed = normalizeResolvedFeed(feed);
  const currentArchitecture = normalizeArchitectureInput(current.architecture ?? {});
  const nextArchitecture = architecture;

  if (name !== trimText(current.name)) {
    changes.name = name;
  }

  if (url !== trimText(current.url)) {
    changes.url = url;
  }

  if (sign !== trimText(current.sign)) {
    changes.sign = sign;
  }

  if (!areEqualJson(nextFeed, currentFeed)) {
    changes.feed = nextFeed;
  }

  if ((sitemap || null) !== (trimText(current.sitemap ?? '') || null)) {
    changes.sitemap = sitemap || null;
  }

  if ((linkPage || null) !== (trimText(current.link_page ?? '') || null)) {
    changes.link_page = linkPage || null;
  }

  if ((trimText(form.main_tag_id) || null) !== (current.main_tag_id ?? null)) {
    changes.main_tag_id = trimText(form.main_tag_id) || null;
  }

  if (!areEqualJson(subTags, normalizeSubTagInputs(current.sub_tags ?? []))) {
    changes.sub_tags = subTags;
  }

  if (!areEqualJson(nextArchitecture, currentArchitecture)) {
    changes.architecture = nextArchitecture;
  }

  if (Object.keys(changes).length === 0) {
    return {
      ok: false,
      fieldErrors: {
        changes: '至少修改一个字段后才能提交修订。',
      },
      formError: '至少修改一个字段后才能提交修订。',
    };
  }

  return {
    ok: true,
    data: {
      submitter_name: normalizeSubmitterName(form.submitter_name),
      submitter_email: normalizeOptionalSubmitterEmail(form.submitter_email),
      submit_reason: trimText(form.submit_reason),
      notify_by_email: form.notify_by_email,
      site_identifier: trimText(form.site_identifier),
      changes,
    },
  };
}
