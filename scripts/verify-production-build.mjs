import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const clientAssetsDir = path.join(root, "dist", "client", "assets");
const serverAssetsDir = path.join(root, "dist", "server", "assets");

async function exists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(clientAssetsDir)) || !(await exists(serverAssetsDir))) {
  throw new Error("Missing production build. Run `npm run build` before starting the app.");
}

const serverFiles = await readdir(serverAssetsDir);
const manifestFile = serverFiles.find((file) => file.startsWith("_tanstack-start-manifest"));
if (!manifestFile) {
  throw new Error("Production build is missing the TanStack Start asset manifest.");
}

const manifest = await readFile(path.join(serverAssetsDir, manifestFile), "utf8");
const referencedAssets = [...manifest.matchAll(/\/assets\/([^"']+)/g)].map((match) => match[1]);
const missingAssets = [];

for (const asset of new Set(referencedAssets)) {
  if (!(await exists(path.join(clientAssetsDir, asset)))) missingAssets.push(asset);
}

if (missingAssets.length) {
  throw new Error(
    `Production build is inconsistent: the server manifest references missing client assets: ${missingAssets.join(", ")}`,
  );
}

console.log(`Production build verified (${new Set(referencedAssets).size} client assets).`);
