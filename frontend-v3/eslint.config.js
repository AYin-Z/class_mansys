import js from '@eslint/js';
import globals from 'globals';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

/**
 * P0 前端 ESLint：只开启正确性相关规则（类型由 vue-tsc 把关），风格交给 Prettier。
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'android/**', 'coverage/**'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    // Node 侧配置/脚本（vite.config.ts、scripts/*.mjs）使用 node 全局
    files: ['**/*.mjs', 'vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2023,
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      },
      globals: { ...globals.browser }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-components': 'warn',
      'vue/no-side-effects-in-computed-properties': 'warn',
      'vue/require-v-for-key': 'warn'
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser, globals: { ...globals.browser } },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' }
  }
];
