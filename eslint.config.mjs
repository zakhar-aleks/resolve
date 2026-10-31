import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
const uiQuality = {
  rules: {
    'no-inline-copy': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          copy: 'Move visible text to src/consts/copy.ts.',
          classes: 'Use a semantic CSS component with @apply instead of a long class list.',
        },
      },
      create(context) {
        return {
          JSXText(node) {
            if (node.value.trim()) context.report({ node, messageId: 'copy' });
          },
          JSXAttribute(node) {
            if (
              node.name.name === 'class' &&
              node.value?.type === 'Literal' &&
              typeof node.value.value === 'string' &&
              node.value.value.trim().split(/\s+/u).length > 4
            )
              context.report({ node, messageId: 'classes' });
            if (
              ['title', 'placeholder', 'aria-label', 'alt'].includes(node.name.name) &&
              node.value?.type === 'Literal' &&
              typeof node.value.value === 'string' &&
              node.value.value.trim()
            )
              context.report({ node, messageId: 'copy' });
          },
        };
      },
    },
  },
};
export default [
  {
    ignores: [
      '**/dist/**',
      '**/.astro/**',
      '**/node_modules*/**',
      '.runtime/**',
      'static/**',
      '*.py',
    ],
  },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
  },
  {
    files: ['apps/web/src/components/**/*.astro'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../wrappers/*', '../services/support-api', '../services/actions'],
              message: 'Keep transport and actions outside rendering components.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.astro'],
    plugins: { quality: uiQuality },
    rules: { 'quality/no-inline-copy': 'error' },
  },
];
