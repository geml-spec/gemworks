// What this version brings, for the upgrade dialog: read from the CHANGELOG the
// plugin ships, the section of the running version, a line per entry. Pure.

/** The most entries the dialog lists. */
const MOST = 8;

/**
 * The entries of `version`'s section of a Keep-a-Changelog file (`## [x.y.z] — date`), each as its first sentence,
 * its `**scope**:` prefix and its Markdown marks left out; none when the file has no section for that version.
 */
export function releaseNotesOf(changelog: string, version: string): string[] {
  const lines = changelog.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start < 0) return [];
  const entries: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (/^[-*] /.test(line)) entries.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && entries.length > 0) entries[entries.length - 1] += ` ${line.trim()}`;
  }
  return entries.slice(0, MOST).map((e) => {
    const plain = e.replace(/^\*\*[^*]+\*\*:\s*/, "").replace(/\*\*|`/g, "");
    const end = plain.search(/[.。](\s|$)/);
    return end < 0 ? plain : plain.slice(0, end + 1);
  });
}

/** Whether `candidate` is a later version than `current`: major, minor, patch, each by number (a pre-release tag is not weighed). */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string): number[] => v.split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}
