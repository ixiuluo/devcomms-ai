import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      'node_modules/',
      '**/dist/**',
      'build/',
      '**/.next/**',
      'coverage/',
      '*.js',
      '*.mjs',
      '*.cjs',
      '**/vitest.config.ts',
      '**/next-env.d.ts',
      '**/postcss.config.mjs',
      // Non-source files
      'apps/api/public/**',
      'apps/api/prisma.config.ts',
      // Generated code
      'apps/api/src/generated/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
