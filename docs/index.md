---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

title: zarrita.js
titleTemplate: A JavaScript toolkit for Zarr

head:
  - - link
    - rel: canonical
      href: https://manzt.github.io/zarrita.js/
  - - meta
    - name: title
      content: zarrita.js
  - - meta
    - name: description
      content: A JavaScript toolkit for Zarr
  - - meta
    - name: twitter:card
      content: summary_large_image
  - - meta
    - name: twitter:site
      content: "@trevmanz"
  - - meta
    - property: og:description
      content: A JavaScript toolkit for Zarr
  - - meta
    - property: og:image
      content: https://github.com/manzt/zarrita.js/assets/24403730/9d5666bc-0812-4cf5-8673-2552e562ef94
  - - meta
    - property: og:site_name
      content: zarrita.js
  - - meta
    - property: og:title
      content: zarrita.js documentation
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:url
      content: https://manzt.github.io/zarrita.js

hero:
  name: zarrita.js
  # text: A JavaScript toolkit for Zarr
  tagline: A JavaScript toolkit for working with chunked, compressed, n-dimensional arrays
  actions:
    - theme: brand
      text: Get Started
      link: /get-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/manzt/zarrita.js

features:
  - title: Modular design
    icon: 🧩
    details: Tailor Zarr for your application needs, with v3 & v2 support.
  - title: Multi-platform ESM
    icon: 🌍
    details: Native support for browsers, Node.js, Bun, and Deno.
  - title: Flexible storage & compression
    icon: 🛠️
    details: Select from a range of backends and codecs.
  - title: Type safe
    icon: 🦺
    details: Built in TypeScript, offering rich type information.

  - title: "@zarrita/core"
    link: /packages/core
    linkText: Open arrays and groups
  - title: "@zarrita/storage"
    link: /packages/storage
    linkText: Pick a storage backend
  - title: "@zarrita/indexing"
    linkText: Slice and index arrays
    link: /packages/indexing
  - title: "@zarrita/ndarray"
    linkText: Load with scijs/ndarray
    link: /packages/ndarray
---
