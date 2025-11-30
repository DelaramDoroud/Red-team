export default {
  extends: 'stylelint-config-recommended',
  plugins: 'stylelint-scss',
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'layer',
          'apply',
          'responsive',
          'variants',
          'screen',
          'theme',
          'config',
          'custom-variant',
        ],
      },
    ],
  },
};
