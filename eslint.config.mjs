import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // --- Global ignores ---
  {
    ignores: ['dist/**', 'data/**', 'node_modules/**'],
  },

  // --- JS files (including config files) ---
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    plugins: { prettier: prettierPlugin },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // --- TS files (non-type-aware baseline rules) ---
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts'],
    plugins: { ...(cfg.plugins ?? {}), prettier: prettierPlugin },
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
];
