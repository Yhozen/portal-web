// The only file the hosted build stores in R2: the bundled clean-room engine. No game data, ever.
export const filenames = {
  engine: ["portal-engine.js", "text/javascript"],
};

export function validateRelease(release) {
  if (release?.format !== 1 || !/^[a-f0-9]{64}$/.test(release.id)) {
    throw new Error("Unsupported or invalid release");
  }
  if (Object.keys(release.assets ?? {}).sort().join() !== Object.keys(filenames).sort().join()) {
    throw new Error("Unexpected assets in release");
  }
  for (const [name, [filename, contentType]] of Object.entries(filenames)) {
    const asset = release.assets?.[name];
    if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0 ||
        asset.url !== `/assets/${asset.sha256}/${filename}` || asset.contentType !== contentType ||
        asset.integrity !== `sha256-${sriFromHex(asset.sha256)}`) {
      throw new Error(`Invalid ${name} asset in release`);
    }
  }
  return release;
}

// Subresource Integrity value for a hex SHA-256 (works in Node and browsers).
export function sriFromHex(hex) {
  const bytes = hex.match(/../g).map((b) => parseInt(b, 16));
  return btoa(String.fromCharCode(...bytes));
}
