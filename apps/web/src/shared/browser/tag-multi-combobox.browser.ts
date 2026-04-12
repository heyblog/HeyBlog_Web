export interface ComboboxOption {
  id: string;
  name: string;
}

export interface ComboboxValueItem {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

export function normalize(value: string): string {
  return value.trim();
}

export function normalizeKey(value: string): string {
  return normalize(value)
    .toLocaleLowerCase('zh-CN')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function normalizeSelectionItems(items: ComboboxValueItem[]): ComboboxValueItem[] {
  const normalized: ComboboxValueItem[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const item of items) {
    const tag_id = normalize(item.tag_id ?? '') || null;
    const name = normalize(item.name ?? '') || null;
    const name_normalized = normalizeKey(item.name_normalized ?? name ?? '') || null;

    if (!tag_id && !name) {
      continue;
    }

    if (tag_id) {
      if (seenIds.has(tag_id)) {
        continue;
      }

      seenIds.add(tag_id);
      normalized.push({
        tag_id,
        name,
        name_normalized,
      });
      continue;
    }

    if (!name || !name_normalized || seenNames.has(name_normalized)) {
      continue;
    }

    seenNames.add(name_normalized);
    normalized.push({
      tag_id: null,
      name,
      name_normalized,
    });
  }

  return normalized.sort((left, right) => {
    const leftHasId = Boolean(left.tag_id);
    const rightHasId = Boolean(right.tag_id);

    if (leftHasId !== rightHasId) {
      return leftHasId ? -1 : 1;
    }

    if ((left.tag_id ?? '') !== (right.tag_id ?? '')) {
      return (left.tag_id ?? '').localeCompare(right.tag_id ?? '', 'zh-CN');
    }

    return (left.name_normalized ?? '').localeCompare(right.name_normalized ?? '', 'zh-CN');
  });
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) {
    return true;
  }

  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) {
      cursor += 1;
      if (cursor === needle.length) {
        return true;
      }
    }
  }

  return false;
}

export function filterOptions(
  options: ComboboxOption[],
  normalizedQuery: string,
): ComboboxOption[] {
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => {
    const lowerName = option.name.toLocaleLowerCase('zh-CN');
    const queryKey = normalizeKey(normalizedQuery);
    const nameKey = normalizeKey(option.name);

    if (lowerName.includes(normalizedQuery.toLocaleLowerCase('zh-CN'))) {
      return true;
    }

    if (!queryKey) {
      return false;
    }

    return (
      nameKey.startsWith(queryKey) || nameKey.includes(queryKey) || isSubsequence(queryKey, nameKey)
    );
  });
}

export function hasCustomConflict(
  normalizedQuery: string,
  selectedOptions: ComboboxOption[],
  items: ComboboxValueItem[],
  options: ComboboxOption[],
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const key = normalizeKey(normalizedQuery);

  if (!key) {
    return true;
  }

  const selectedOptionNameSet = new Set(selectedOptions.map((option) => normalizeKey(option.name)));
  const customNameSet = new Set(
    items
      .filter((item) => !item.tag_id)
      .map((item) => normalizeKey(item.name ?? ''))
      .filter(Boolean),
  );
  const optionNameSet = new Set(options.map((option) => normalizeKey(option.name)));

  return selectedOptionNameSet.has(key) || customNameSet.has(key) || optionNameSet.has(key);
}
