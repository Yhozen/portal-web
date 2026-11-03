// Same Access allowlist as Horizon's preview (horizon web/scripts/config.mjs). Keep the two in sync.
export const allowedEmails = ["gabriel@garox.org", "vichudo@gmail.com", "zneel.yevenes@gmail.com"];
export const domain = "portal.rccpr.tech";
export const workerName = "portal-web-preview";
// Owner of the private game-files bucket: the only identity the Worker serves /files/ to. Gabriel's entry in
// Horizon's allowlist (it has no gabrielgarox@gmail.com; gabriel@garox.org is his).
export const ownerEmail = "gabriel@garox.org";
// Private R2 bucket holding the owner's own Portal files (filled only by `pnpm upload-game-files`).
export const gameFilesBucket = "portal-web-preview-game-files";
if (!allowedEmails.includes(ownerEmail)) throw new Error("ownerEmail must also be in allowedEmails");
