import { defineConfig } from 'vite'

// Относительный base: ассеты грузятся относительно страницы, поэтому сборка
// работает и на GitHub Pages (проектная страница /<repo>/), и локально,
// без привязки к имени репозитория.
export default defineConfig({
  base: './',
})
