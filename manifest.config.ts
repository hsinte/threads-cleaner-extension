import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: "public/logo.png",
  },
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  content_scripts: [
    {
      js: ["src/content/index.ts"],
      css: ["src/content/style.css"],
      matches: ["https://www.threads.com/*"],
    },
  ],
  permissions: ["storage"],
  host_permissions: ["https://cdn.jsdelivr.net/*"],
});
