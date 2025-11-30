export default {
  extends: 'stylelint-config-recommended',
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'layer',
          'apply',
          'variants',
          'responsive',
          'screen',
          'theme',
          'custom-variant',
        ],
      },
    ],
    'declaration-property-value-no-unknown': null,
  },
};
