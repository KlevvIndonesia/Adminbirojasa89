import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // 1. Global Ignores: build artifacts, dependencies, and archived legacy stubs
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'releases/**',
      'scratch/**',
      'archive/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  // Base recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 2. Global Node/CommonJS environment for scripts and config files
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },

  // 3. Active Application Source Code (Frontend: src/ & Backend: server/src/)
  {
    files: ['src/**/*.{ts,tsx}', 'server/src/**/*.ts'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-undef': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      // Warn on explicit any to encourage typing without blocking build
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow intentional unused parameters/variables prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Code hygiene & style warnings
      'prefer-const': 'warn',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'warn',
      'no-control-regex': 'off', // Needed for binary magic byte checks in fileValidation
      'preserve-caught-error': 'off',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // 4. Test Files Scope (tests/ and e2e/)
  // Tests need flexible mock typing, loose assertions, and test fixtures
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'warn',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
    },
  },

  // 5. Scripts and Tooling Scope (scripts/)
  // Build and dev orchestration scripts running under Node.js CLI
  {
    files: ['scripts/**/*.{js,cjs,ts}', '*.config.{js,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'warn',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-console': 'off',
    },
  },
);
