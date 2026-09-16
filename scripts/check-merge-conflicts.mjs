import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".css",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".py",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)(?: .*)?$/;

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()));

const matches = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (conflictMarker.test(lines[index])) {
      matches.push(`${file}:${index + 1}: ${lines[index]}`);
    }
  }
}

if (matches.length > 0) {
  console.error("Git conflict markers found in source files:");
  for (const match of matches) {
    console.error(`  ${match}`);
  }
  process.exit(1);
}

console.log(`No Git conflict markers found in ${files.length} source files.`);