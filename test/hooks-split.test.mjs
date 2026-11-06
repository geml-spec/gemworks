import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => readFileSync(join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

test("act.tsx declares each atom it uses exactly as register.tsx does: one plugin and key, one value", () => {
  const register = new Set(read("hooks/register.tsx").split("\n").filter((l) => /^const \w+Atom = atom\(/.test(l)));
  const act = read("hooks/act.tsx").split("\n").filter((l) => /^const \w+Atom = atom\(/.test(l));
  assert.ok(act.length > 0);
  for (const line of act) assert.ok(register.has(line), `act.tsx declares an atom register.tsx does not, or differently: ${line}`);
});

// Anthropic's plugin directory holds a version for a reviewer when a file other than an image or a font reaches
// 256 KiB, or when the plugin passes 512 files. The package's files, as package.json's files[] and npm name them.
test("every file the package ships is under 256 KiB, and the package under 512 files", () => {
  const pkg = JSON.parse(read("package.json"));
  const files = [];
  const walk = (rel) => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) if (f !== "node_modules" && f !== ".DS_Store") walk(`${rel}/${f}`); }
    else files.push(rel);
  };
  for (const f of [...pkg.files, "package.json", "README.md", "README.zh.md"]) walk(f);
  assert.ok(files.includes("dist/gemworks.mjs"), "dist/ is built (npm run build) before this runs");
  const IMAGE_OR_FONT = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf)$/i;
  const over = files.filter((f) => !IMAGE_OR_FONT.test(f) && statSync(join(ROOT, f)).size >= 256 * 1024);
  assert.deepEqual(over, [], "split them: scripts/bundle.mjs for the bundle, a module of its own beside hooks/register.tsx");
  assert.ok(files.length <= 512, `${files.length} files`);
});
