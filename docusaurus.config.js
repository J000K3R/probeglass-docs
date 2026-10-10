// Docusaurus configuration for the Weatherglass documentation site.
//
// Everything here is meant to be edited in one place when the site moves: the
// url/baseUrl pair at the top, and the organization/project pair at the bottom.
// The docs themselves live in docs/ and are ordered by sidebars.js; nothing in
// this file has to change when a page is added.

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Weatherglass',
  tagline: 'A small, self-hosted watchdog for your homelab.',

  // Used in the sitemap and in social cards. For a project page on GitHub Pages
  // the baseUrl is the repository name; for a custom domain set baseUrl to '/'.
  url: 'https://j000k3r.github.io',
  baseUrl: '/weatherglass-docs/',

  organizationName: 'j000k3r',
  projectName: 'weatherglass-docs',

  favicon: 'img/favicon.svg',

  // Fail the build on a dead internal link rather than shipping it; warn on
  // dead links to the main repository, which is a different site.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/j000k3r/weatherglass-docs/tree/main/',
        },
        // No blog: release notes live in the repository's CHANGELOG.
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.svg',
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Weatherglass',
        logo: {
          alt: 'Weatherglass',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://j000k3r.github.io/weatherglass-website/',
            label: 'Website',
            position: 'right',
          },
          {
            href: 'https://github.com/j000k3r/weatherglass',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {label: 'Introduction', to: '/'},
              {label: 'Installation', to: '/getting-started/install'},
              {label: 'Configuration', to: '/configuration/'},
              {label: 'Troubleshooting', to: '/operations/troubleshooting'},
            ],
          },
          {
            title: 'Project',
            items: [
              {
                label: 'Source code',
                href: 'https://github.com/j000k3r/weatherglass',
              },
              {
                label: 'Container image',
                href: 'https://github.com/j000k3r/weatherglass/pkgs/container/weatherglass',
              },
              {
                label: 'Issues',
                href: 'https://github.com/j000k3r/weatherglass/issues',
              },
              {
                label: 'Changelog',
                href: 'https://github.com/j000k3r/weatherglass/blob/main/CHANGELOG.md',
              },
              {
                label: 'Who makes this, and how',
                to: '/about',
              },
            ],
          },
        ],
        // The copyright line is a string rather than JSX, so it cannot use a
        // `to` link: Docusaurus does not route an href written here, and the site
        // is served from a subpath, so a root-absolute "/about" would leave the
        // site. Absolute, for that reason only.
        copyright: `Weatherglass is a hobby project, written in dialogue with an AI coding agent. MIT licensed, no warranty, no liability. <a href="https://j000k3r.github.io/weatherglass-docs/about">Read more</a>.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'json', 'go', 'ini', 'nginx'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
    }),
};

export default config;
