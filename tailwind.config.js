// Tailwind precompilato: dopo aver cambiato classi in index.html o js/*.js rigenera i CSS con
//   npx tailwindcss@3.4.17 -i tailwind/base.css -o css/tailwind-base.css --minify
//   npx tailwindcss@3.4.17 -i tailwind/utilities.css -o css/tailwind.css --minify
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: { extend: {} },
  plugins: []
};
