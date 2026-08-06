import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "__MSG_extName__",
  description: "__MSG_extDescription__",
  default_locale: "en",
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
  permissions: ["storage", "alarms"],
  host_permissions: [
    "https://cdn.jsdelivr.net/*",
    "https://hsinte-mail.qazx0931.workers.dev/*",
  ],
});
