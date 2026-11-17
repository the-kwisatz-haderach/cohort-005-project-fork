// Fails when a file is too big for an agent to read and edit in one go.
// Tokens are estimated as bytes / 4, which is close enough for code.
// Usage: node scripts/check-file-tokens.js <file>...
//
// A ratchet. A new file must be under the limit. A file that HEAD already
// holds over the limit (legacy) may be edited, but may not grow: a ticket
// that touches one moves out only the part it changes, and the full split is
// a ticket of its own.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;

// Generated files that nobody edits by hand, and workflow files, which
// GitHub reads as one file each and which cannot be split.
const IGNORED = [
  /(^|\/)package-lock\.json$/,
  /^drizzle\//,
  /^\.github\/workflows\/[^/]+\.yml$/,
];

const isBinary = (contents) => contents.subarray(0, 8000).includes(0);

// The size of the file at HEAD in tokens, or null when HEAD does not hold it.
const tokensAtHead = (file) => {
  try {
    const bytes = execFileSync("git", ["cat-file", "-s", `HEAD:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Math.ceil(Number(bytes) / BYTES_PER_TOKEN);
  } catch {
    return null;
  }
};

const oversized = process.argv
  .slice(2)
  .map((file) => file.replaceAll("\\", "/").replace(`${process.cwd()}/`, ""))
  .filter((file) => !IGNORED.some((pattern) => pattern.test(file)))
  .map((file) => ({ file, contents: readFileSync(file) }))
  .filter(({ contents }) => !isBinary(contents))
  .map(({ file, contents }) => ({
    file,
    tokens: Math.ceil(contents.length / BYTES_PER_TOKEN),
  }))
  .filter(({ tokens }) => tokens > MAX_TOKENS)
  .map((entry) => ({ ...entry, before: tokensAtHead(entry.file) }))
  .filter(
    ({ tokens, before }) =>
      before === null || before <= MAX_TOKENS || tokens > before
  );

if (oversized.length > 0) {
  console.error(`These files are over ${MAX_TOKENS} tokens (bytes / 4):\n`);
  for (const { file, tokens, before } of oversized) {
    const growth =
      before === null ? "new file" : `grew from ~${before}, legacy`;
    console.error(`  ${file}: ~${tokens} tokens (${growth})`);
  }
  console.error(`
A new file must be under the limit: split it before you commit.

A legacy file (over the limit at HEAD) may be edited but may not grow. Move
out only the part your change touches, until the file is no bigger than it
was at HEAD. A full split of a legacy file is a ticket of its own: leave the
rest where it is, and say so in the PR body.

Do not delete code or squash it onto fewer lines to get under the limit.
Code you move into a module brings its tests: see app/modules/README.md.

How to move code out:
- Find the seams. Look for groups of functions, components, or tests that
  change together and share little with the rest of the file.
- Route modules (app/routes/*): keep the loader, action, and page component in
  the route file. Move the business logic into a module in app/modules/ and
  sub-components into their own files in app/components/.
- Logic that is already in a module (app/modules/<name>/): split it into more
  files under lib/. Keep the entry points (index.ts, index.server.ts) small. Do
  not add a barrel file. See app/modules/README.md.
- Tests: split by the behaviour under test, one file per area (for example
  <name>.refunds.test.ts, <name>.permissions.test.ts). Move shared fixtures
  into a fixtures file in the same tests/ folder.
- Scripts and seed data: move large data literals into their own files and
  import them.

When you are done, run \`npm run check\` and commit again.`);
  process.exit(1);
}
