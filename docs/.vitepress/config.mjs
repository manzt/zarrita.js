import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "zarrita.js",
	base: "/zarrita.js/",
	description: "Zarr building blocks for JavaScript",
	head: [
		["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
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
					{ text: "Recipes", link: "/recipes" },
				],
			},
			{
				text: "API Reference",
				collapsed: false,
				items: [
					{ text: "@zarrita/core", link: "/core" },
					{ text: "@zarrita/storage", link: "/storage" },
					{ text: "@zarrita/indexing", link: "/indexing" },
					{ text: "@zarrita/ndarray", link: "/ndarray" },
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
});
