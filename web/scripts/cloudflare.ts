import { CloudflareApiLive } from "@alchemy.run/cloudflare";
import type { CloudflareAuthConfig, CloudflareResolvedCredentials } from "@alchemy.run/cloudflare/Auth/AuthConfig";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AuthError, AuthProviders, getAuthProvider } from "alchemy/Auth/AuthProvider";
import { ProfileStore } from "alchemy/Auth/Profile";
import { layerNonInteractive } from "alchemy/Interaction";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/http/FetchHttpClient";

// Read through Alchemy so stored secrets and OAuth refresh keep their normal behavior.
// Explicitly select the profile: inherited environment tokens must not shadow it.
export async function profileCredentials(profile = "default") {
  return Effect.runPromise(Effect.gen(function* () {
    const store = yield* ProfileStore;
    const auth = yield* getAuthProvider<CloudflareAuthConfig, CloudflareResolvedCredentials>("Cloudflare");
    const config = yield* store.loadProviderConfig(auth, profile);
    return yield* auth.read(profile, config, (updated) => store.setProviderConfig(profile, "Cloudflare", updated)
      .pipe(Effect.mapError((cause) => AuthError.make({ message: "Could not save refreshed Cloudflare credentials", cause }))));
  }).pipe(Effect.provide(CloudflareApiLive()), Effect.provide(layerNonInteractive()),
    Effect.provide(NodeServices.layer), Effect.provide(FetchHttpClient.layer),
    Effect.provideService(AuthProviders, {})));
}

export function api(credentials: CloudflareResolvedCredentials) {
  return async (path: string, init: RequestInit & { duplex?: "half" } = {}) => {
    const headers = new Headers(init.headers);
    if (credentials.type === "apiKey") {
      headers.set("X-Auth-Key", Redacted.value(credentials.apiKey));
      headers.set("X-Auth-Email", Redacted.value(credentials.email));
    } else {
      headers.set("Authorization", `Bearer ${Redacted.value(credentials.type === "oauth"
        ? credentials.accessToken : credentials.apiToken)}`);
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/${path}`,
      { ...init, headers, redirect: "error" });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { errors?: { message: string }[] };
      throw new Error(`Cloudflare ${response.status}: ${detail.errors?.map((e) => e.message).join("; ") ?? "request failed"}`);
    }
    return response;
  };
}
