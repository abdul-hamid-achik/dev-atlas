import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span>🗺️ Dev Atlas</span>,
  project: {
    link: 'https://github.com/abdul-hamid-achik/dev-atlas',
  },
  docsRepositoryBase: 'https://github.com/abdul-hamid-achik/dev-atlas/tree/main/apps/website',
  footer: {
    content: 'Dev Atlas © 2024',
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Dev Atlas" />
      <meta property="og:description" content="Knowledge Graph for Developers" />
    </>
  )
}

export default config
