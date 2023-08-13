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
    details: Open arrays and groups
    link: /core
    # linkText:
  - title: "@zarrita/storage"
    details: Pick a storage backend
    link: /storage
  - title: "@zarrita/indexing"
    details: Slice and index arrays
    link: /indexing
  - title: "@zarrita/ndarray"
    details: Load arrays with scijs/ndarray
    link: /ndarray
---
