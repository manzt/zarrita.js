import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "zarrita.js",
  description: "Zarr building blocks for JavaScript",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Get Started", link: "/get-started" },
    ],
    sidebar: {
      "/guide/": { base: "/guide/", items: sidebarGuide() },
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/manzt/zarrita.js" },
    ],
  },
  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin);
    }
  }
});

function sidebarGuide() {
  return [
    {
      text: "Introduction",
      items: [
        { text: "What is zarrita.js?", link: "what-is-zarrita" },
        { text: "Get Started", link: "get-started" },
      ],
    },
  ];
}
