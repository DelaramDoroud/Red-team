export default {
  extends: 'stylelint-config-recommended',
  // Configurazione compatibile con Tailwind CSS v4 e CSS nesting
  rules: {
    // Consenti le at-rule personalizzate usate da Tailwind v4
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
          // Nuove at-rules di Tailwind v4
          'theme',
          'custom-variant',
        ],
      },
    ],
    // Disattiva la regola che segnala false-positivi con gradient multipli su background
    'declaration-property-value-no-unknown': null,
  },
};
