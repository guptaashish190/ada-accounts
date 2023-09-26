module.exports = {
  extends: 'erb',
  plugins: ['@typescript-eslint'],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'react/jsx-filename-extension': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': 'off',
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'import/no-extraneous-dependencies': 'off',
    'no-console': 'off',
    'no-use-before-define': 'off',
    'eslintno-nested-ternary': 'off',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {},
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
