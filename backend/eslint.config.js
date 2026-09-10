const js = require('@eslint/js');
const globals = require('globals');

/**
 * P0 工程化基座：ESLint 只开启"真问题"级别规则，风格交给 Prettier。
 * 规则收紧放在 P1，避免一次性产生大量噪声 diff。
 */
module.exports = [
  { ignores: ['node_modules/**', 'uploads/**', 'apk/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-prototype-builtins': 'off',
      'no-fallthrough': 'off',
      'no-constant-condition': 'off',
      'no-async-promise-executor': 'off',
      'require-atomic-updates': 'off'
    }
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs', 'scripts/**/*.js', 'vitest.config.mjs'],
    languageOptions: { sourceType: 'module', ecmaVersion: 2023, globals: { ...globals.node } }
  }
];
