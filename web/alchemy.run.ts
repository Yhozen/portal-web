import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { readFile } from "node:fs/promises";
import { api } from "./scripts/cloudflare.ts";
import { allowedEmails, domain, gameFilesBucket, ownerEmail, workerName } from "./scripts/config.mjs";
import { uploadAssets } from "./scripts/artifacts.mjs";
import { guardBuild } from "./scripts/guard.mjs";

interface Upload {
  releaseId: string;
  files: { key: string; path: string; sha256: string; md5: string; size: number; contentType: string }[];
}

// Uploads only the content-addressed engine bundle. guardBuild/uploadAssets refuse any game file.
const PublishAssets = Alchemy.Action("PublishAssets", Effect.gen(function* () {
  const credentials = yield* Cloudflare.CloudflareEnvironment.current;
  return (input: Upload & { bucket: string }) => Effect.tryPromise(async () => {
    await uploadAssets(api(credentials), input.bucket, input.files);
    return { releaseId: input.releaseId };
  });
}));

export default Alchemy.Stack("PortalWeb", {
  providers: Cloudflare.providers(), state: Cloudflare.state(),
}, Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  if (stage !== "preview") return yield* Effect.die(new Error("Deploy this stack with --stage preview"));
  const upload = yield* Effect.tryPromise(async () => {
    await guardBuild(new URL(".", import.meta.url).pathname);
    return JSON.parse(await readFile(new URL("./.build/upload.json", import.meta.url), "utf8")) as Upload;
  }).pipe(Effect.orDie);
  // Private bucket for engine builds only (no r2.dev URL). Old builds stay for rollback.
  const bucket = yield* Cloudflare.R2.Bucket("Engine", { publicAccess: false });
  // Second private bucket: the owner's own Portal files. The stack only creates it (empty); it is filled
  // from the owner's Mac by `pnpm upload-game-files`, never by build or deploy. No r2.dev URL, no custom
  // domain, no CORS: the only way in is the Worker's owner-only /files/ route (or the owner's API token).
  // Destroying the stack fails while it holds objects (forceDestroy stays off).
  const gameFiles = yield* Cloudflare.R2.Bucket("GameFiles", { name: gameFilesBucket, publicAccess: false, domains: [], cors: [] });
  // The account's one-time PIN login is a singleton already managed by the HorizonWeb stack: look it up
  // instead of creating (or adopting, and later deleting) it here.
  const login = Cloudflare.Access.getIdentityProvider({ type: "onetimepin" });
  const published = yield* PublishAssets({ ...upload, bucket: bucket.bucketName });
  const game = yield* Cloudflare.Worker("Game", {
    name: workerName,
    domain,
    main: "./src/worker.ts",
    compatibility: { date: "2026-10-24" },
    workersDev: { enabled: true, previewsEnabled: false },
    access: {
      name: "Portal private preview", allowedIdps: [login.identityProviderId.as<string>()], autoRedirectToIdentity: true,
      sessionDuration: "24h", policies: [{ decision: "allow", include: allowedEmails.map((email) => ({ email })) }],
    },
    cache: { enabled: true, crossVersionCache: true },
    entrypoints: { default: { cache: { enabled: false } }, Assets: { cache: { enabled: true } } },
    env: { BUCKET: bucket, FILES: gameFiles, ALLOWED_EMAILS: allowedEmails.join(","), OWNER_EMAIL: ownerEmail,
      RELEASE_ID: published.releaseId },
    observability: { enabled: true },
  });
  return { url: game.url, bucketName: bucket.bucketName, gameFilesBucket: gameFiles.bucketName, releaseId: published.releaseId };
}));
