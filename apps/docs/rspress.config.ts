import { resolve } from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: 'docs',
  base: '/docplaybook/',
  ssg: false,
  title: 'DocPlaybook',
  description: 'A Git-first CLI for Markdown translation, memory learning, and lint-style review.',
  logoText: 'DocPlaybook',
  themeDir: resolve(__dirname, 'theme'),
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
              text: 'Flow Demo',
              link: '/guide/demo'
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
