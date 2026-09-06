import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/*/generated/**',
      'data/**',
    ],
  },

  eslint.configs.recommended,
  tseslint.configs.recommended,

  // Turns off every stylistic rule Prettier already owns. Must stay last of
  // the shared configs so it wins over anything they enable.
  prettierConfig,

  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'properties'],

      // Named functions are declarations, so they hoist and read the same
      // whether they are exported or local.
      'func-style': ['error', 'declaration', { allowArrowFunctions: false }],

      // Exported functions carry their return type in the source rather than
      // leaving it to inference, so a change to a body cannot silently widen
      // the public signature.
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // `verbatimModuleSyntax` is on, so type-only imports must be erasable on
      // sight. Separate statements rather than inline `type` specifiers.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Type assertions defeat the checker. `as const` is exempt: it narrows
      // rather than asserts, and the card tables rely on it.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > *.typeAnnotation:not(TSTypeReference[typeName.name="const"])',
          message:
            'Avoid `as`. Narrow with a type guard, or use optional chaining / nullish coalescing.',
        },
        {
          selector: 'TSNonNullExpression',
          message: 'Avoid `!`. Narrow the value instead, or handle the undefined case.',
        },
      ],
    },
  },

  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },

  {
    plugins: { 'import-x': importX },
    settings: {
      // Flat-config resolver API. The TypeScript resolver runs first so that
      // the `.ts` extensions the sources import with resolve; the Node
      // resolver is the fallback for bare package specifiers.
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ alwaysTryTypes: true, project: ['tsconfig.json'] }),
        createNodeResolver(),
      ],
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          pathGroups: [{ pattern: '@wot/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': ['error', { 'prefer-inline': false, considerQueryString: false }],
      'import-x/no-self-import': 'error',
      'import-x/no-unresolved': 'error',
    },
  },

  // Everything in this repo runs on bare Node today. When a browser app lands
  // under `apps/`, scope this block to the Node surfaces rather than widening
  // its rules.
  {
    files: ['packages/**/*.ts', 'tools/**/*.ts', '*.mjs', '*.ts'],
    plugins: { n: nodePlugin },
    // The workspace packages do not carry their own `engines`, so point the
    // plugin at the root's range rather than letting it fall back to its
    // `>=16.0.0` default and flag Node 24 builtins as unsupported.
    settings: { node: { version: '>=24' } },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/prefer-node-protocol': 'error',
      'n/no-process-exit': 'error',
    },
  },

  // CLI entry points set their exit code by exiting.
  {
    files: ['tools/*/src/index.ts'],
    rules: {
      'n/no-process-exit': 'off',
    },
  },
);
