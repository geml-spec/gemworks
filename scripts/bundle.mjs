// The CLI as the Claude Code plugin starts it, with no dependency install: dist/gemworks.mjs and the
// dist/gemworks-*.mjs it loads are gemworks' own code bundled, and @geml/geml, which they import, is the parser's
// published files copied unchanged into dist/vendor/geml/. Node's built-ins stay external.
//
// No file may reach 256 KiB: Anthropic's plugin directory holds a version for a reviewer when one does, and reads
// the plugin's files as they are, so they stay readable (not minified). That is why the parser is not bundled: its
// core (geml.js, code-graph.js, render.js import each other) would land in one chunk of over 220 KB. gemworks' own
// code is split at its largest modules. The build fails here when a file it writes is too large.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const vendor = join(dist, "vendor", "geml");
const LIMIT = 256 * 1024;

// Where gemworks' own code is cut into files of its own: the modules large enough that, left in one file with the
// rest, they would take it past the limit.
const SPLIT = ["src/hosts/claude-code/text.ts", "src/bridge.ts", "src/workspace.ts", "src/core/command-line.ts", "src/host-git.ts"];

// The parser, copied: every module reachable from the ones gemworks imports, through the parser's own relative
// imports. Its CLI (cli.js) is reached only by a hand-off that fires when geml.js itself is the script being run,
// which it never is here.
const parserDir = dirname(createRequire(import.meta.url).resolve("@geml/geml"));
const parserPkg = JSON.parse(readFileSync(join(parserDir, "..", "package.json"), "utf8"));
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.\/[^"']+)["']/g;
const parserFiles = new Set();
const reach = (name) => {
  if (parserFiles.has(name)) return;
  parserFiles.add(name);
  for (const m of readFileSync(join(parserDir, name), "utf8").matchAll(IMPORT)) reach(m[1].slice(2));
};

// `@geml/geml` and `@geml/geml/dist/<file>` become imports of the copy beside the bundle.
const vendored = {
  name: "vendored-parser",
  setup(b) {
    b.onResolve({ filter: /^@geml\/geml(\/|$)/ }, (args) => {
      const file = args.path === "@geml/geml" ? "geml.js" : args.path.replace(/^@geml\/geml\/dist\//, "");
      if (file.includes("/") || !file.endsWith(".js")) throw new Error(`${args.importer}: ${args.path} is not a parser module scripts/bundle.mjs can copy`);
      reach(file);
      return { path: `./vendor/geml/${file}`, external: true };
    });
  },
};

// What an earlier build wrote goes first: the chunks' names change with their content.
for (const f of readdirSync(dist)) if (f === "gemworks.mjs" || /^gemworks-.*\.mjs$/.test(f)) rmSync(join(dist, f));
rmSync(vendor, { recursive: true, force: true });

// dist/gemworks.mjs turns on Node's compile cache before it loads the CLI, so a request after the first reads the
// files' compiled code instead of compiling them again: split and unbundled, the parser costs about 85 ms a start
// without it, about 45 with it. The cache is Node's own, in the temp directory.
const START = "gemworks-start";
const start = {
  name: "start",
  setup(b) {
    b.onResolve({ filter: new RegExp(`^${START}$`) }, () => ({ path: START, namespace: START }));
    b.onLoad({ filter: /.*/, namespace: START }, () => ({
      contents: 'import { enableCompileCache } from "node:module";\ntry { enableCompileCache?.(); } catch {}\nawait import("./cli.ts");\n',
      resolveDir: join(root, "src"),
      loader: "ts",
    }));
  },
};

const entryPoints = { gemworks: START };
for (const m of SPLIT) entryPoints[`gemworks-${m.replace(/^src\//, "").replace(/\.ts$/, "").replace(/\//g, "-")}`] = join(root, m);
const result = await build({
  entryPoints,
  outdir: dist,
  splitting: true,
  chunkNames: "gemworks-chunk-[hash]",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
  metafile: true,
  plugins: [start, vendored],
});

mkdirSync(vendor, { recursive: true });
for (const f of parserFiles) copyFileSync(join(parserDir, f), join(vendor, f));
copyFileSync(join(parserDir, "..", "LICENSE"), join(vendor, "LICENSE"));
// The copy's own package.json: its .js files are ES modules, and it says which release they came from. The parser
// reads its version from it (PARSER_VERSION looks beside and above geml.js), so the about dialog says the parser's.
writeFileSync(join(vendor, "package.json"), `${JSON.stringify({ name: parserPkg.name, version: parserPkg.version, type: "module", license: parserPkg.license }, null, 2)}\n`);

const written = [...Object.keys(result.metafile.outputs).map((o) => resolve(o)), ...[...parserFiles].map((f) => join(vendor, f))];
const over = written.filter((f) => statSync(f).size >= LIMIT);
if (over.length > 0) throw new Error(`over 256 KiB, split further (SPLIT in scripts/bundle.mjs): ${over.map((f) => `${f} ${statSync(f).size}`).join(", ")}`);
