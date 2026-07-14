import { createModuleEslintConfig } from '@heyblog/configs/shared/eslint';

export default createModuleEslintConfig({
  moduleDir: import.meta.dirname,
  runtime: 'web',
  useAstro: true,
  useSvelte: true,
});
