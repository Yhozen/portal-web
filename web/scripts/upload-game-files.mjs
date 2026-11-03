#!/usr/bin/env node
// Owner-only, run by hand from the owner's machine. Never part of build or deploy.
//
//   pnpm upload-game-files --from "~/Library/Application Support/Steam/steamapps/common/Portal"
//
// Copies the files the engine reads from YOUR OWN Portal install (same selection as the in-browser
// picker: the five VPK sets, maps, resource/, scripts/, sound/) into the PRIVATE R2 bucket created by
// the stack (scripts/config.mjs gameFilesBucket), then writes manifest.json last. Re-running skips
// files whose size and MD5 already match (resumable). The Worker serves them at /files/ only to the
// owner's Cloudflare Access identity (OWNER_EMAIL). --dry-run lists what would change; --prune
// deletes uploaded files that are no longer selected. --local seeds the local dev emulation instead.
// --s3 uses a bucket-scoped R2 S3 token from R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY
// instead of the Alchemy profile.
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { gameFilesBucket } from "./config.mjs";
import { bindingTarget, restTarget, s3TargetFromEnv, selectGameFiles, syncGameFiles } from "./game-files.mjs";

const { values } = parseArgs({ options: {
  from: { type: "string" }, profile: { type: "string", default: "default" }, bucket: { type: "string", default: gameFilesBucket },
  "dry-run": { type: "boolean", default: false }, prune: { type: "boolean", default: false },
  concurrency: { type: "string", default: "4" }, local: { type: "boolean", default: false },
  s3: { type: "boolean", default: false },
} });
if (!values.from) {
  console.error('Usage: pnpm upload-game-files --from "~/Library/Application Support/Steam/steamapps/common/Portal" [--s3] [--dry-run] [--prune] [--concurrency N]');
  process.exit(2);
}
const from = resolve(values.from.replace(/^~(?=$|\/)/, homedir()));
const files = await selectGameFiles(from);
const options = { dryRun: values["dry-run"], prune: values.prune, concurrency: Math.max(1, Number(values.concurrency) || 4) };

if (values.local) {
  const { openDevR2 } = await import("./dev-r2.mjs");
  const mf = await openDevR2();
  try {
    const r = await syncGameFiles(bindingTarget(await mf.getR2Bucket("FILES")), files, options);
    console.log(values["dry-run"] ? `Dry run: ${r.pending} files would be copied into the local dev bucket` :
      `Local dev bucket: ${r.uploaded} uploaded, ${r.skipped} unchanged; manifest lists ${Object.keys(r.manifest.files).length} files`);
  } finally { await mf.dispose(); }
} else if (values.s3) {
  const target = await s3TargetFromEnv(values.bucket).catch((e) => { console.error(e.message); process.exit(1); });
  console.log(`Uploading from ${from} to private R2 bucket ${values.bucket} over S3 (R2_ENDPOINT)`);
  const r = await syncGameFiles(target, files, options);
  console.log(values["dry-run"] ? `Dry run: ${r.pending} files would be uploaded` :
    `Done: ${r.uploaded} uploaded, ${r.skipped} unchanged; manifest.json lists ${Object.keys(r.manifest.files).length} files (${(r.manifest.total / 1e9).toFixed(2)} GB)`);
} else {
  const { api, profileCredentials } = await import("./cloudflare.ts");
  const credentials = await profileCredentials(values.profile).catch((e) => {
    console.error(`No Cloudflare credentials in Alchemy profile '${values.profile}': ${e.message ?? e}`); process.exit(1);
  });
  console.log(`Uploading from ${from} to private R2 bucket ${values.bucket} (account ${credentials.accountId}, profile ${values.profile})`);
  const r = await syncGameFiles(restTarget(api(credentials), values.bucket), files, options);
  console.log(values["dry-run"] ? `Dry run: ${r.pending} files would be uploaded` :
    `Done: ${r.uploaded} uploaded, ${r.skipped} unchanged; manifest.json lists ${Object.keys(r.manifest.files).length} files (${(r.manifest.total / 1e9).toFixed(2)} GB)`);
}
