// Fails when a module in app/modules/ ships an entry point no test reaches.
// Usage: node scripts/check-module-tests.js
//
// A module's entry points are its root files (see app/modules/README.md).
// Each one must be imported by at least one test in the module's own tests/
// folder, as `../<entry>` or `~/modules/<name>/<entry>`. A folder with no
// source files at all is not a module yet, and is skipped.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "app/modules";
const isSource = (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
const isTest = (name) => /\.test\.tsx?$/.test(name);

const filesBelow = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesBelow(join(dir, entry.name))
      : [join(dir, entry.name)]
  );

const problems = [];

for (const module of readdirSync(ROOT, { withFileTypes: true })) {
  if (!module.isDirectory()) continue;
  const dir = join(ROOT, module.name);
  if (!filesBelow(dir).some((file) => isSource(file))) continue;

  const testsDir = join(dir, "tests");
  const tests = existsSync(testsDir)
    ? filesBelow(testsDir).filter((file) => isTest(file))
    : [];
  const testSource = tests.map((file) => readFileSync(file, "utf8")).join("\n");

  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isSource(entry.name))
    .map((entry) => entry.name.replace(/\.tsx?$/, ""));

  for (const entry of entries) {
    const specifiers = [`../${entry}`, `~/modules/${module.name}/${entry}`];
    const imported = specifiers.some((specifier) =>
      new RegExp(
        `from\\s+["']${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
      ).test(testSource)
    );
    if (!imported)
      problems.push(`${dir}/${entry}: no test in ${testsDir}/ imports it`);
  }
}

if (problems.length > 0) {
  console.error("These module entry points have no test:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`
Every entry point of a module ships with a test in the module's tests/ folder
that imports it, including code moved in from a route. A function that reads
the global db cannot be tested: have the module take the db as a parameter
(a factory, like createInstructorAnalytics or createCoursePermissions) and
test it with createTestDb() from ~/test/setup.`);
  process.exit(1);
}
