import { createModuleEslintConfig } from '@zhblogs/configs/shared/eslint';

export default createModuleEslintConfig({
  moduleDir: import.meta.dirname,
  runtime: 'worker',
});
