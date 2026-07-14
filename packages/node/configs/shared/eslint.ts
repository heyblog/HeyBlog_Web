import { builtinModules } from 'node:module';

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import svelte from 'eslint-plugin-svelte';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

type ModuleRuntime = 'node' | 'web' | 'worker';

type CreateModuleEslintConfigOptions = {
  moduleDir: string;
  runtime?: ModuleRuntime;
  useAstro?: boolean;
  useSvelte?: boolean;
  testPatterns?: string[];
};

function toConfigArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

const builtinModulesPattern = builtinModules
  .filter((moduleName) => !moduleName.startsWith('_'))
  .map((moduleName) => moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const sharedIgnorePatterns = [
  'node_modules/**',
  '**/node_modules/**',
  'dist/**',
  '**/dist/**',
  'coverage/**',
  '**/coverage/**',
  '.astro/**',
  '**/.astro/**',
  '**/*.d.ts',
  '**/*.d.mts',
  '**/*.d.cts',
  '**/*.map',
];

const defaultTestPatterns = [
  '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx}',
  '**/tests/**/*.{js,mjs,cjs,ts,mts,cts,tsx}',
];

const importSortRules = {
  'simple-import-sort/imports': [
    'error',
    {
      groups: [
        ['^\\u0000'],
        ['^node:', `^(${builtinModulesPattern})(/|$)`],
        ['^@heyblog/'],
        ['^@?\\w'],
        ['^@/', '^@tests/'],
        ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
        ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
        ['^.+\\.(css|scss|sass|less)$'],
      ],
    },
  ],
  'simple-import-sort/exports': 'error',
};

function getRuntimeGlobals(runtime: ModuleRuntime): Record<string, boolean> {
  if (runtime === 'web') {
    return {
      ...globals.browser,
      ...globals.node,
    };
  }

  if (runtime === 'worker') {
    return {
      ...globals.browser,
      ...globals.worker,
      ...globals.serviceworker,
    };
  }

  return {
    ...globals.node,
  };
}

export function createModuleEslintConfig(options: CreateModuleEslintConfigOptions): unknown[] {
  const runtime = options.runtime ?? 'node';
  const codeExtensions = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'tsx'];
  const templateExtensions = [
    options.useAstro ? 'astro' : null,
    options.useSvelte ? 'svelte' : null,
  ].filter(Boolean);
  const allLintExtensions = [...codeExtensions, ...templateExtensions].join(',');
  const runtimeGlobals = getRuntimeGlobals(runtime);
  const configItems: unknown[] = [
    {
      ignores: sharedIgnorePatterns,
      linterOptions: {
        reportUnusedDisableDirectives: 'error' as const,
      },
    },
    js.configs.recommended,
    ...toConfigArray(tsPlugin.configs['flat/recommended']),
  ];

  if (options.useAstro) {
    configItems.push(...toConfigArray(astro.configs['flat/recommended']));
  }

  if (options.useSvelte) {
    configItems.push(
      ...toConfigArray(svelte.configs['flat/recommended']),
      ...toConfigArray(svelte.configs['flat/prettier']),
    );
  }

  configItems.push(
    {
      files: [`**/*.{${allLintExtensions}}`],
      plugins: {
        'simple-import-sort': simpleImportSort,
        'unused-imports': unusedImports,
      },
      rules: {
        ...importSortRules,
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'warn',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
            vars: 'all',
            varsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
      languageOptions: {
        ecmaVersion: 'latest' as const,
        sourceType: 'module' as const,
        parser: tsParser,
        parserOptions: {
          tsconfigRootDir: options.moduleDir,
        },
        globals: runtimeGlobals,
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            disallowTypeAnnotations: false,
            fixStyle: 'inline-type-imports',
          },
        ],
      },
    },
    {
      files: ['**/*.{ts,mts,cts,tsx,astro,svelte}'],
      rules: {
        'no-undef': 'off',
        'no-useless-assignment': 'warn',
        '@typescript-eslint/no-empty-object-type': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      files: ['**/*.cjs'],
      languageOptions: {
        sourceType: 'commonjs' as const,
        globals: {
          ...globals.node,
        },
      },
    },
  );

  if (templateExtensions.length > 0) {
    configItems.push({
      files: [`**/*.{${templateExtensions.join(',')}}`],
      languageOptions: {
        globals: runtimeGlobals,
      },
    });
  }

  if (options.useSvelte) {
    configItems.push({
      files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
      languageOptions: {
        parserOptions: {
          extraFileExtensions: ['.svelte'],
          parser: tsParser,
        },
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
      rules: {
        'svelte/prefer-svelte-reactivity': 'warn',
        'svelte/require-each-key': 'warn',
      },
    });
  }

  configItems.push(
    {
      files: options.testPatterns ?? defaultTestPatterns,
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'unused-imports/no-unused-vars': 'off',
      },
    },
    eslintConfigPrettier,
  );

  return configItems;
}
