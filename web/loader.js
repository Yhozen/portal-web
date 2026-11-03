import { validateRelease } from "./release.js";

// Game files come from the player's own install, copied into this browser (see src/localfs.ts).
window.PORTAL_FILES = "local";
const status = document.getElementById("status");
const say = (text) => { status.textContent = text; window.portalStatus = text; };
try {
  const response = await fetch("./release.json", { cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(`Could not load release (${response.status})`);
  const release = validateRelease(await response.json());
  const engine = release.assets.engine;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = engine.url; script.integrity = engine.integrity; // the browser verifies the hash
    script.onload = resolve; script.onerror = () => reject(new Error("Could not load the engine"));
    document.body.appendChild(script);
  });
  window.portalRelease = release.id;
  status.remove();
} catch (error) {
  say("Failed: " + (error?.message ?? error));
  window.loadError = String(error?.message ?? error);
  console.error(error);
}
