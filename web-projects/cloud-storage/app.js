// Entry point for the Cloud storage page.
//
// The page is the full settings panel and a short explanation. Everything the
// panel does lives in `cloudSettingsPanel.js`; this file mounts it, maps the
// site's design tokens onto the panel's, and writes the "deployed at" line.

import { mountCloudSettings } from "./cloudSettingsPanel.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { escapeHtml, say } from "./cloudMessages.js";

const PROJECT_PATH = "web-projects/cloud-storage";

mountCloudSettings(document.getElementById("cloud-settings"), { mode: "full", pageHref: "./" });
renderDeployLine(document.getElementById("deploy-line"), readStamp(document), "en", say, escapeHtml, PROJECT_PATH);
