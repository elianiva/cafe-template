import { recommended } from '@yielded/effect-tsrs/oxlint-presets'
import { defineConfig } from 'vite-plus'

const ignored = [
  '.git/**',
  '.turbo/**',
  '.alchemy/**',
  '.wrangler/**',
  'node_modules/**',
  'dist/**',
  'coverage/**',
]

export default defineConfig({
  fmt: {
    ignorePatterns: [...ignored, '**/*.d.ts'],
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
  },
  lint: {
    ignorePatterns: ignored,
    // `effect-tsrs patch --oxlint` (run by `prepare`) replaces the tsgolint
    // backend with effect-tsrs, so type-aware lint runs the Effect rules.
    options: { typeAware: true, typeCheck: false },
    plugins: ['typescript', 'unicorn', 'oxc', ...recommended.plugins],
    rules: {
      ...recommended.rules,
      // effect-tsrs hands these default type-aware rules to tsgolint. Keep them off.
      'typescript/await-thenable': 'off',
      'typescript/no-array-delete': 'off',
      'typescript/no-base-to-string': 'off',
      'typescript/no-duplicate-type-constituents': 'off',
      'typescript/no-floating-promises': 'off',
      'typescript/no-for-in-array': 'off',
      'typescript/no-implied-eval': 'off',
      'typescript/no-meaningless-void-operator': 'off',
      'typescript/no-misused-spread': 'off',
      'typescript/no-redundant-type-constituents': 'off',
      'typescript/no-unsafe-unary-minus': 'off',
      'typescript/no-useless-default-assignment': 'off',
      'typescript/require-array-sort-compare': 'off',
      'typescript/restrict-template-expressions': 'off',
      'typescript/unbound-method': 'off',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'typescript/no-explicit-any': 'error',
    },
  },
})
