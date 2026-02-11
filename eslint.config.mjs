import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

export default [
  // --- Global ignores ---
  {
    ignores: ['dist/**', 'data/**', 'node_modules/**'],
  },

  // --- JS files (including config files) ---
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    plugins: { prettier: prettierPlugin, import: importPlugin },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        },
      ],
    },
  },

  // --- TS files (non-type-aware baseline rules) ---
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts'],
    plugins: { ...(cfg.plugins ?? {}), prettier: prettierPlugin, import: importPlugin },
    rules: {
      ...(cfg.rules ?? {}),
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],

      // formatting-ish (optional)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // TS-aware best practices (non-typed)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'type'],
      '@typescript-eslint/no-explicit-any': 'error',

      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        },
      ],
    },
  })),

  // --- TS files (type-aware rules) ---
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  // --- Layer boundary rules ---
  // Domain must not import from app or infra
  {
    files: ['src/domains/**/*.ts'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domains',
              from: './src/app',
              message: 'Domain must not import from app layer.',
            },
            {
              target: './src/domains',
              from: './src/infra',
              message: 'Domain must not import from infra layer.',
            },
          ],
        },
      ],
    },
  },
  // Config must not import from app, infra, or domains
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/config',
              from: './src/app',
              message: 'Config must not import from app layer.',
            },
            {
              target: './src/config',
              from: './src/infra',
              message: 'Config must not import from infra layer.',
            },
            {
              target: './src/config',
              from: './src/domains',
              message: 'Config must not import from domain layer.',
            },
          ],
        },
      ],
    },
  },
];
