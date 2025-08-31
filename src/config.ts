import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "陈不丢的地盘",
	subtitle: "Demo Site",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "不丢容器",
			url: "https://www.budiuyun.net", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/chenbudiu.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "陈不丢",
	bio: "时刻分享自己的学习所得",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/saicaca/fuwari",
		},
		{
			name: "哔哩哔哩",
			icon: "fa6-brands:bilibili",
			url: "https://space.bilibili.com/317029711",
		},
		{
			name: "官方群",
			icon: "fa6-brands:qq",
			url: "https://qun.qq.com/universal-share/share?ac=1&authKey=VCeO%2Fpdfvk10khrKQUD1L3s22splbbTLfXOeWaS3WuWTdtGraJ3vntvemQ9c5%2BeR&busi_data=eyJncm91cENvZGUiOiIxMTAxNzIzNzc4IiwidG9rZW4iOiJCbFFpcVFaQXNsZzNUT29QYTAxN0FXdlZIcE9UV0VZU3czRzltNjg0cmN0M1J0dE1FWW4rbnJ5WjN1bmxvbEVYIiwidWluIjoiMTc5ODY2NDk1In0%3D&data=e2Q4UQMqTNzUthj4S4pWMPWxTvAOA-N-UcnGWLFktGlPz3djWf-Qq-GEIusB4CjIh_M4esFVZpf7VS1Onh75Tw&svctype=4&tempid=h5_group_info",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
