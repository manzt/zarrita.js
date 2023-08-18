import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "zarrita.js",
	base: "/zarrita.js/",
	description: "Zarr building blocks for JavaScript",
	head: [
		["link", { rel: "icon", type: "image/svg+xml", href: "/zarrita.js/logo.svg" }],
	],
	themeConfig: {
		logo: "/logo.svg",
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Guide", link: "/what-is-zarrita" },
		],
		sidebar: [
			{
				text: "Introduction",
				items: [
					{ text: "What is zarrita.js?", link: "/what-is-zarrita" },
					{ text: "Get Started", link: "/get-started" },
					{ text: "Slicing and Indexing", link: "/slicing" },
					{ text: "Cookbook", link: "/cookbook" },
				],
			},
			{
				text: "Packages",
				collapsed: false,
				items: [
					{ text: "@zarrita/core", link: "/packages/core" },
					{ text: "@zarrita/storage", link: "/packages/storage" },
					{ text: "@zarrita/indexing", link: "/packages/indexing" },
					{ text: "@zarrita/ndarray", link: "/packages/ndarray" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/manzt/zarrita.js" },
		],
		search: {
			provider: "local",
		},
		footer: {
			message:
				"Released under the <a style='text-decoration:underline;' href='https://github.com/manzt/zarrita.js/blob/main/LICENSE'>MIT License</a>.",
			copyright: `Copyright 2020–${new Date().getUTCFullYear()} Trevor Manz`,
		},
	},
	markdown: {
		config(md) {
			md.use(tabsMarkdownPlugin);
		},
	},
});
