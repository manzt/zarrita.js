// https://vitepress.dev/guide/custom-theme
import Theme from "vitepress/theme";
import { enhanceAppWithTabs } from "vitepress-plugin-tabs/client";

import "./style.css";

export default {
	...Theme,
	enhanceApp({ app }) {
		enhanceAppWithTabs(app);
	},
};
