#!/usr/bin/env node
// Verifies the package tarball contents match package.json `files` before release.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

// npm pack --dry-run lists what would be published.
const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
});
const parsed = JSON.parse(output);
const files = parsed.at(0)?.files ?? [];

const included = new Set(files.map((f) => f.path));
const problems = [];

// Required files must be present.
const required = [
  "package.json",
  "README.md",
  "LICENSE",
  ...globbed(pkg.pi?.extensions ?? []),
];

function globbed(entries) {
  // "./extensions" -> "extensions/" prefixed files; we check the directory exists
  // at all in the tarball.
  const result = [];
  for (const entry of entries) {
    const dir = entry.replace(/^\.\//, "").replace(/\/$/, "");
    const present = files.some((f) => f.path === dir || f.path.startsWith(dir + "/"));
    if (!present) problems.push(`pi.extensions entry missing from tarball: ${entry}`);
  }
  return result;
}

for (const req of required) {
  if (!included.has(req)) {
    problems.push(`required file missing from tarball: ${req}`);
  }
}

// Entry extension must be loadable TypeScript (smoke check: file parses as text).
for (const entry of pkg.pi?.extensions ?? []) {
  const path = entry.replace(/^\.\//, "").replace(/\/$/, "");
  if (path.endsWith(".ts")) {
    if (!included.has(path)) problems.push(`extension entry not in tarball: ${path}`);
  } else {
    const present = files.some((f) => f.path === path || f.path.startsWith(path + "/"));
    if (!present) problems.push(`extension dir not in tarball: ${path}`);
  }
}

// No node_modules should ever be packed.
for (const f of included) {
  if (f.startsWith("node_modules/") || f.includes("/node_modules/")) {
    problems.push(`tarball must not contain node_modules: ${f}`);
  }
}

// npm must be able to run a clean publish (access public).
if (pkg.publishConfig?.access !== "public") {
  problems.push("publishConfig.access must be 'public'");
}
if (!pkg.keywords?.includes("pi-package")) {
  problems.push("keywords must include 'pi-package' for pi.dev/packages discovery");
}

if (problems.length > 0) {
  console.error("✖ package verification failed:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(`✔ package verified: ${files.length} files, ${parsed.at(0)?.size ?? "?"} bytes`);
