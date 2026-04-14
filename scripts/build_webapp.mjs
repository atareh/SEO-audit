import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const webapp = resolve(root, "webapp");
const output = resolve(root, "public");

await mkdir(output, { recursive: true });

await copyFile(resolve(webapp, "index.html"), resolve(output, "index.html"));
await copyFile(resolve(webapp, "styles.css"), resolve(output, "styles.css"));

await esbuild.build({
  entryPoints: [resolve(webapp, "app.js")],
  outfile: resolve(output, "app.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  sourcemap: false,
  minify: false,
});
