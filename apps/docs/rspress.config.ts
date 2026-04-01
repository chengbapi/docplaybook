import { resolve } from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: 'docs',
  base: '/docplaybook/',
  lang: 'en',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'DocPlaybook',
      description: 'A CLI for Markdown translation sync, memory learning, and translation health review.'
    }
  ],
  ssg: false,
  title: 'DocPlaybook',
  description: 'A CLI for Markdown translation sync, memory learning, and translation health review.',
  logoText: 'DocPlaybook',
  themeDir: resolve(__dirname, 'theme'),
  globalStyles: resolve(__dirname, 'styles/theme.css'),
  themeConfig: {
    darkMode: true,
    logo: {
      light: '/logo-icon-light.svg',
      dark: '/logo-icon-dark.svg'
    },
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/chengbapi/docplaybook'
      }
    ]
  }
});
