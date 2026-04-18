import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        crypto: 'readonly',
        require: 'readonly',
        module: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        RequestInit: 'readonly',
        Response: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/preserve-caught-error': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-case-declarations': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-undef': 'off',
      '@typescript-eslint/no-empty': 'off',
      '@typescript-eslint/no-useless-assignment': 'off',
      '@typescript-eslint/no-case-declarations': 'off',
    },
  },
  {
    files: ['src/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
