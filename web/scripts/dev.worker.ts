// Local development only (scripts/dev.mjs, miniflare on 127.0.0.1 with emulated R2). Runs the deployed
// gateway, asset and /files/ code paths. Cloudflare Access is simulated: the identity is the owner, or the
// X-Dev-Access-Email request header ("none" = not signed in). The deployed Worker has no such header.
import { gateway, serveAsset } from "../src/http.ts";
import { shell } from "../.build/shell.ts";

interface Env { BUCKET: R2Bucket; FILES: R2Bucket; ALLOWED_EMAILS: string; OWNER_EMAIL: string }

export default {
  fetch(request: Request, env: Env) {
    const requested = request.headers.get("X-Dev-Access-Email");
    const email = requested === "none" ? undefined : requested ?? env.OWNER_EMAIL;
    return gateway(request, env, {
      access: { getIdentity: async () => email ? { email } : undefined },
      exports: { Assets: { fetch: (incoming) => serveAsset(incoming, env.BUCKET) } },
    }, shell);
  },
};
