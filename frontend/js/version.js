/** Parse cache-bust build number from a module URL (e.g. app.js?v=66 → 66). */
export function parseBuildFromModuleUrl(moduleUrl) {
  const match = String(moduleUrl).match(/[?&]v=(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** Display label: build 66 → "1.66" */
export function formatAppVersion(build) {
  return `1.${build}`;
}
