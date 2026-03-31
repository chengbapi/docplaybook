import { resolve } from 'node:path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: '/',
  base: '/docplaybook/',
  markdown: {
    mdxRs: false
  },
  title: 'DocPlaybook',
  description: 'A local-first CLI for Markdown translation, memory learning, and lint-style review.',
  logoText: 'DocPlaybook',
  globalStyles: resolve(__dirname, 'styles/theme.css'),
  themeConfig: {
    darkMode: true,
    logo: {
      light: '/logo-icon-light.svg',
      dark: '/logo-icon-dark.svg'
    },
    nav: [
      {
        text: 'Introduction',
        link: '/guide/introduction'
      },
      {
        text: 'Guide',
        link: '/guide/quick-start'
      },
      {
        text: 'GitHub',
        link: 'https://github.com/chengbapi/docplaybook'
      }
    ],
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/chengbapi/docplaybook'
      }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Get Started',
          collapsed: false,
          items: [
            {
              text: 'Introduction',
              link: '/guide/introduction'
            },
            {
              text: 'Quick Start',
              link: '/guide/quick-start'
            },
          ]
        },
        {
          text: 'Workflow',
          collapsed: false,
          items: [
            {
              text: 'Project Workflow',
              link: '/guide/workflow'
            },
            {
              text: 'CI',
              link: '/guide/ci'
            }
          ]
        },
        {
          text: 'Advanced',
          collapsed: false,
          items: [
            {
              text: 'Advanced',
              link: '/guide/advanced'
            },
            {
              text: 'Config',
              link: '/guide/config'
            },
            {
              text: 'Agents',
              link: '/guide/agents'
            },
            {
              text: 'Memory',
              link: '/guide/memory'
            }
          ]
        }
      ]
    }
  }
});
