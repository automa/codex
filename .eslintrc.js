const product = 'codex';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
    'plugin:mocha/recommended',
  ],
  plugins: ['simple-import-sort'],
  rules: {
    quotes: ['warn', 'single', { avoidEscape: true }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/ban-ts-comment': 'off',
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [
          ['^\u0000'],
          ['^node:'],
          ['^\\./env$'],
          [
            '^(fastify)$',
            '^(chai|quibble|sinon)$',
            '^(fastify-.*|@fastify/.*)(/.*)?$',
            '^(@opentelemetry/(sdk-node|semantic-conventions))$',
            '^@?\\w',
          ],
          [`^@${product}/`],
          ['^'],
          ['^.+/(env|telemetry)$'],
          ['^\\.\\./(types|utils)$'],
          ['^\\.\\.'],
          ['^\\./(types|utils)$'],
          ['^\\.'],
        ],
      },
    ],
    'import/no-empty-named-blocks': 'error',
    'import/no-absolute-path': 'error',
    'import/no-relative-packages': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'mocha/no-mocha-arrows': 'off',
    'mocha/no-exclusive-tests': 'error',
  },
  env: {
    node: true,
    mocha: true,
  },
  ignorePatterns: ['!.lintstagedrc.js', '!.prettierrc.js', 'build', 'coverage'],
  settings: {
    'import/resolver': {
      typescript: true,
    },
    'import/internal-regex': `^@${product}/`,
  },
};
