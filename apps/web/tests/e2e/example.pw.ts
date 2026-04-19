import { expect, test } from './support/fixtures';
import { installHomeApiMocks } from './support/setup';

test('renders home page baseline', async ({ page, gotoPath }) => {
  await installHomeApiMocks(page);
  await gotoPath('/');

  await expect(page).toHaveTitle(/集博栈/);
  await expect(page.getByRole('heading', { name: '集博栈' })).toBeVisible();
});

test('opens docs index baseline', async ({ gotoPath, page }) => {
  await gotoPath('/docs');

  await expect(page).toHaveTitle(/项目文档 \| 集博栈/);
  await expect(page.getByRole('heading', { name: '按类别进入' })).toBeVisible();
});

test('opens site submit page baseline', async ({ gotoPath, page }) => {
  await gotoPath('/site/submit');

  await expect(page).toHaveTitle(/站点提交 \| 集博栈/);
  await expect(page.getByRole('heading', { name: '新增站点' })).toBeVisible();
});
