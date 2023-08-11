import { defineConfig } from "vitepress";

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
    sidebar: [
      {
        text: "Get Started",
        items: [
          { text: "Get Started", link: "/get-started" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/manzt/zarrita.js" },
    ],
  },
});
