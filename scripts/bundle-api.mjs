import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "apps/api/src/vercel-handler.ts")],
  bundle: true,
  platform: "node",
  target: ["node20"],
  outfile: resolve(root, "api/handler.js"),
  format: "cjs",
  // Node.js built-ins (fs, path, http, etc.) are auto-excluded with platform: node
});

console.log("✓ Bundled apps/api/src/vercel-handler.ts → api/handler.js");
