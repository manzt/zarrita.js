---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

title: zarrita.js
titleTemplate: A JavaScript toolkit for Zarr

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
