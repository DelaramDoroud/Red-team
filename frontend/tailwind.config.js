import animate from 'tailwindcss-animate';

const config = {
  darkMode: ['class'],
  theme: {
    extend: {
      container: {
        center: true,
        padding: '1rem',
      },
    },
  },
  plugins: [animate],
};
export default config;
