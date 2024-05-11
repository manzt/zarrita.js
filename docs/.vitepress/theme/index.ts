import { enhanceAppWithTabs } from "vitepress-plugin-tabs/client";
// https://vitepress.dev/guide/custom-theme
import Theme from "vitepress/theme";

import "./style.css";

export default {
	...Theme,
	enhanceApp({ app }) {
		Theme.enhanceApp({ app });
		enhanceAppWithTabs(app);
	},
};
