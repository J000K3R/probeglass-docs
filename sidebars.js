// The sidebar is written out by hand rather than generated from the folder
// tree. The order below is the order a new user should read the pages in, and
// it should not change because a file was renamed or because alphabetical order
// put "Architecture" before "Installation".
//
// Every id is a path under docs/, without the .md extension. A missing id fails
// the build, which is the point: a page that is not in the sidebar is a page
// nobody reads.

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: [
        'getting-started/install',
        'getting-started/first-sensor',
        'getting-started/demo-data',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      collapsed: false,
      items: [
        'concepts/sensors',
        'concepts/alerts',
        'concepts/history',
        'concepts/incidents',
        'concepts/security',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: false,
      items: [
        'configuration/index',
        'configuration/file',
        'configuration/environment',
        'configuration/dashboard',
        'configuration/maintenance',
        'configuration/dependencies',
        'configuration/icons',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      collapsed: false,
      items: [
        'operations/backup',
        'operations/upgrading',
        'operations/reverse-proxy',
        'operations/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: ['reference/api', 'reference/cli', 'reference/faq'],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/architecture',
        'development/contributing',
        'development/roadmap',
      ],
    },
    // Last on purpose, and the only entry that is not about using the software.
    // It is the page that says the project is a hobby project with no warranty —
    // the one thing a reader should not have to go looking for. It is linked from
    // the introduction, from both footers, from the README and from the Docker Hub
    // page, so it is reachable from everywhere without being in the way here.
    'about',
  ],
};

export default sidebars;
