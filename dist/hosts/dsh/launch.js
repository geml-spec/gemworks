// The `run` verb: find dsh, make sure this bundle is in the profile, hand the
// task over. It copies no harness logic — every decision below is about
// LOCATING and INVOKING dsh, and the exit code is passed straight through.
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
/**
 * Find an executable on PATH, honouring PATHEXT on Windows.
 *
 * Node has no `which`, and guessing wrong here is the difference between a
 * clear message and a confusing ENOENT from deep inside a spawn.
 */
export function resolveOnPath(name, env = process.env) {
    const paths = (env["PATH"] ?? env["Path"] ?? "").split(delimiter).filter((p) => p.length > 0);
    const exts = process.platform === "win32"
        ? (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((e) => e.length > 0)
        : [""];
    for (const dir of paths) {
        for (const ext of exts) {
            const candidate = join(dir, name + ext);
            try {
                accessSync(candidate, constants.X_OK);
                return candidate;
            }
            catch {
                // Not here, or not executable. Keep looking.
            }
        }
    }
    return undefined;
}
/** Decide how to invoke dsh: the one on PATH, else `npx -y @deepseek-ai/dsh`. */
export function launcherFor(env = process.env) {
    const found = resolveOnPath("dsh", env);
    if (found !== undefined) {
        const shim = /\.(cmd|bat)$/i.test(found);
        return { command: found, prefix: [], shell: shim, how: "PATH" };
    }
    const npx = resolveOnPath("npx", env) ?? "npx";
    return {
        command: npx,
        prefix: ["-y", "@deepseek-ai/dsh"],
        shell: /\.(cmd|bat)$/i.test(npx),
        how: "npx",
    };
}
/**
 * Whether a task will survive the Windows shell unchanged.
 *
 * Only `%` is at issue: quoting protects `&`, `|` and friends, but `cmd.exe`
 * expands `%NAME%` even inside quotes, and there is no escape for it on a
 * command line. The model would then be handed text the user did not write, so
 * this is said out loud rather than silently tolerated.
 */
export function warnAboutPercent(task, shell) {
    if (!shell || !task.includes("%"))
        return undefined;
    return "the task contains `%`, which the Windows shell may expand before dsh sees it; check the text dsh receives, or run the two commands below by hand";
}
/**
 * Add the bundle to the profile, then run the task under it.
 *
 * @returns dsh's own exit code, or 1 when dsh could not be reached at all.
 */
export function run(options) {
    const spawn = options.spawn ?? spawnSync;
    const env = options.env ?? process.env;
    const note = options.note ?? ((line) => process.stderr.write(line + "\n"));
    const launcher = launcherFor(env);
    const dsh = [launcher.command, ...launcher.prefix].join(" ");
    const percent = warnAboutPercent(options.task, launcher.shell);
    if (percent)
        note(`gemworks: ${percent}`);
    const add = spawn(launcher.command, [...launcher.prefix, "plugin", "--profile", options.profile, "add", "@geml/gemworks"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: launcher.shell, env });
    if (add.error !== undefined || add.status !== 0) {
        note(`gemworks: could not add the bundle to profile "${options.profile}" with ${dsh}`);
        if (add.stderr)
            note(String(add.stderr).trimEnd());
        note(`gemworks: run these two by hand instead:`);
        note(`  ${dsh} plugin --profile ${options.profile} add @geml/gemworks`);
        note(`  ${dsh} --profile ${options.profile} "<your task>"`);
        return 1;
    }
    const ran = spawn(launcher.command, [...launcher.prefix, "--profile", options.profile, options.task], { stdio: "inherit", shell: launcher.shell, env });
    if (ran.error !== undefined) {
        note(`gemworks: ${dsh} could not be started: ${ran.error.message}`);
        return 1;
    }
    return ran.status ?? 1;
}
