// Fails when a change adds a lint exemption. The exemptions are a ratchet:
// entries come off as files are fixed, and none go on.
// Usage: node scripts/check-lint-exemptions.js
//
// Compares the work tree against the base of the branch (the merge base with
// origin/main, then main, then HEAD), so it catches an exemption added in any
// commit of the branch, not only the one being made. Two kinds count:
//
// - A file or glob added to an `overrides` entry of .oxlintrc.json that turns
//   a rule off.
// - An added line with an inline disable of a size-limit rule
//   (`// oxlint-disable-next-line max-lines-per-function`, and the like).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONFIG = ".oxlintrc.json";
const SIZE_RULES = [
  "max-lines",
  "max-lines-per-function",
  "max-params",
  "max-depth",
];

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

const findBase = () => {
  for (const ref of ["origin/main", "main"]) {
    try {
      return git("merge-base", "HEAD", ref).trim();
    } catch {
      // try the next ref
    }
  }
  return "HEAD";
};

// .oxlintrc.json is JSONC: drop comments outside strings, then trailing commas.
const parseJsonc = (text) => {
  let out = "";
  let inString = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      out += char;
      if (char === "\\") out += text[++index];
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index++;
      out += "\n";
    } else if (char === "/" && text[index + 1] === "*") {
      index = text.indexOf("*/", index + 2) + 1;
    } else {
      out += char;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
};

// "rule\tfile" for every file an override exempts from a rule.
const exemptions = (config) =>
  new Set(
    (config.overrides ?? []).flatMap(({ files = [], rules = {} }) =>
      Object.entries(rules)
        .filter(([, setting]) =>
          [setting, setting?.[0]].some(
            (value) => value === "off" || value === 0
          )
        )
        .flatMap(([rule]) => files.map((file) => `${rule}\t${file}`))
    )
  );

const base = findBase();
const problems = [];

let before = new Set();
try {
  before = exemptions(parseJsonc(git("show", `${base}:${CONFIG}`)));
} catch {
  // the base has no config: every exemption is new
}
for (const entry of exemptions(parseJsonc(readFileSync(CONFIG, "utf8")))) {
  if (before.has(entry)) continue;
  const [rule, file] = entry.split("\t");
  problems.push(`${CONFIG}: ${file} added to the "${rule}": "off" override`);
}

// A directive: a line that opens with the disable comment (//, /* or {/*).
const inlineDisable = new RegExp(
  `^\\s*(//|/\\*|\\{/\\*)\\s*(oxlint|eslint)-disable[^\\n]*\\b(${SIZE_RULES.join("|")})\\b`
);
let file = "";
for (const line of git(
  "diff",
  "--unified=0",
  base,
  "--",
  "app",
  "scripts",
  "request-logger",
  "lint-rules"
).split("\n")) {
  if (line.startsWith("+++ ")) file = line.slice(6);
  else if (line.startsWith("+") && inlineDisable.test(line.slice(1))) {
    problems.push(`${file}: adds an inline disable: ${line.slice(1).trim()}`);
  }
}

if (problems.length > 0) {
  console.error(
    `This change adds lint exemptions (compared with ${base.slice(0, 7)}):\n`
  );
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`
Exemptions only come off. Make the code meet the rule instead: split the long
function, or pass an options object instead of a fourth parameter. Code that
was exempt where it used to live is not exempt once it moves: a moved
function that breaks a size rule gets split as part of the move.

If a file you split had an exemption, remove its entry. Do not move the entry
to the new files.`);
  process.exit(1);
}
