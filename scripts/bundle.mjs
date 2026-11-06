// One file for the Claude Code plugin: dist/gemworks.mjs is the CLI with
// @geml/geml inlined, so an installed plugin starts it with no dependency
// install. Node's built-ins stay external.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// The parser hands `node …/dist/geml.js` over to its CLI when that file is the
// script being run. Inlined, "that file" is the bundle itself, so the guard
// would fire and start dist/cli.js beside the bundle. The line goes; when it
// moves, the build fails here instead of in a person's session.
const HANDOFF = "if (isCliInvocation()) {";
// The parser reads its version from the package.json above its own file. Inlined,
// its file is the bundle, and the package.json above it is gemworks's: the about
// dialog said the parser was gemworks's version. The version goes in as written
// in the parser's package.json at build time; when the line moves, the build fails.
const PARSER_VERSION_LINE = "export const PARSER_VERSION = (() => {";
const parserFixes = {
  name: "parser-inlined",
  setup(b) {
    b.onLoad({ filter: /[\\/]dist[\\/]geml\.js$/ }, (args) => {
      const src = readFileSync(args.path, "utf8");
      if (!src.includes(HANDOFF)) throw new Error(`${args.path}: the parser's CLI hand-off moved; update scripts/bundle.mjs`);
      if (!src.includes(PARSER_VERSION_LINE)) throw new Error(`${args.path}: the parser's version lookup moved; update scripts/bundle.mjs`);
      const { version } = JSON.parse(readFileSync(join(dirname(args.path), "..", "package.json"), "utf8"));
      if (typeof version !== "string" || version === "") throw new Error(`${args.path}: no version in the parser's package.json`);
      const contents = src
        .replace(HANDOFF, "if (false) {")
        .replace(PARSER_VERSION_LINE, `export const PARSER_VERSION = ${JSON.stringify(version)};\nconst parserVersionLookup = (() => {`);
      return { contents, loader: "js" };
    });
  },
};

await build({
  entryPoints: [`${root}src/cli.ts`],
  outfile: `${root}dist/gemworks.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
  plugins: [parserFixes],
});
