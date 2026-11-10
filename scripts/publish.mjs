// Publish this package twice, the same build under two names in the geml organization: `@geml/gemworks`; and
// `@geml/gemwork`, so that the name typed without its last letter installs it too. Either name brings the commands
// `gemworks` and `gwx`. The name is changed in package.json for the later publish and always put back.
// Usage: node scripts/publish.mjs [npm publish options…]   (e.g. --dry-run, --tag beta, --otp 123456)
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NAMES = ["@geml/gemworks", "@geml/gemwork"];
const file = new URL("../package.json", import.meta.url);
const original = readFileSync(file, "utf8");
const pkg = JSON.parse(original);
if (pkg.name !== NAMES[0]) throw new Error(`package.json names ${pkg.name}, not ${NAMES[0]}`);

const npm = (args) => {
  const r = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`npm ${args.join(" ")} exited ${r.status}`);
};

const extra = process.argv.slice(2);
npm(["run", "build"]);
try {
  for (const name of NAMES) {
    writeFileSync(file, original.replace(`"name": "${NAMES[0]}"`, `"name": "${name}"`));
    console.log(`\n=== ${name}@${pkg.version}`);
    // The build is done once, above: the second name publishes the same files.
    npm(["publish", "--ignore-scripts", ...extra]);
  }
} finally {
  writeFileSync(file, original);
}
