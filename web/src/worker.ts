import { WorkerEntrypoint } from "cloudflare:workers";
import { gateway, serveAsset, type GatewayContext, type GatewayEnv } from "./http.ts";
import { shell } from "../.build/shell.ts";

interface Env extends GatewayEnv { BUCKET: R2Bucket }

// Only the default export has a public URL. This entrypoint is invoked after authorization.
export class Assets extends WorkerEntrypoint<Env> {
  fetch(request: Request) { return serveAsset(request, this.env.BUCKET); }
}

export default {
  fetch(request: Request, env: Env, ctx: GatewayContext) {
    return gateway(request, env, ctx, shell);
  },
};
