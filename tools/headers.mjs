#!/usr/bin/env node

/*
 * Copyright (c) 2026 peachq contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

// Lists the source files added since the fork with their copyright header;
// `--check` exits 1 if one lacks the peachq header, a KX file lost KX's, or a
// KX file's last line does not say whether we modified it. `--fix` sets that.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORK = "654ea443";
const SOURCE = /\.(ts|mts|mjs|js|q|sh)$/;
const DATA = ["test/fixtures/l-diff/", "test/fixtures/q-render/"];
const PEACHQ = "Copyright (c) 2026 peachq contributors";
const KX = /Copyright \(c\) 1998-\d{4} KX Systems Inc\./;
const APACHE =
  /Apache License, Version 2\.0|SPDX-License-Identifier: Apache-2\.0/;

const MODIFIED = "Modified by peachq contributors; see NOTICE.";
const UNMARKED = /\.(json|md|png|svg|jpg|gif|ico|ttf|woff2?|lock)$/;

// The comment the trailer takes in a file, or none where it has no place.
function trailer(path) {
  if (UNMARKED.test(path) || path.startsWith("docs/")) return;
  if (DATA.some((d) => path.startsWith(d))) return;
  if (/\.(ts|mts|js|mjs)$/.test(path)) return `// ${MODIFIED}`;
  if (path.endsWith(".q")) return `/ ${MODIFIED}`;
  if (/\.(sh|ya?ml)$|(^|\/)\.[\w-]+$/.test(path)) return `# ${MODIFIED}`;
  const first = readFileSync(join(ROOT, path), "utf8").split("\n")[0];
  if (first.startsWith("#!")) {
    return first.includes("node") ? `// ${MODIFIED}` : `# ${MODIFIED}`;
  }
}

const sources = (paths) =>
  paths.filter((p) => SOURCE.test(p) && !DATA.some((d) => p.startsWith(d)));

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split("\n");

const head = (path) =>
  readFileSync(join(ROOT, path), "utf8").split("\n").slice(0, 16).join("\n");

function kindOf(path) {
  const text = head(path);
  if (text.includes(PEACHQ) && APACHE.test(text) && !KX.test(text)) {
    return "peachq";
  }
  return KX.test(text) ? "kx" : "none";
}

function postFork() {
  const atFork = new Set(git("ls-tree", "-r", "--name-only", FORK));
  const now = sources([
    ...git("ls-files"),
    ...git("ls-files", "--others", "--exclude-standard"),
  ]);
  return [...new Set(now)].filter(
    (path) => !atFork.has(path) && existsSync(join(ROOT, path)),
  );
}

function kxAtFork() {
  const hits = git("grep", "-n", "-F", "KX Systems Inc.", FORK)
    .map((hit) => hit.slice(FORK.length + 1).split(":"))
    .filter(([, line]) => Number(line) <= 3);
  return sources(hits.map(([path]) => path));
}

// KX files changed since the fork, compared with the fork minus any trailer.
function kxTrailers() {
  const atFork = new Set(git("ls-tree", "-r", "--name-only", FORK));
  const changed = git("diff", "--no-renames", "--name-only", FORK).filter(
    (path) => path && atFork.has(path) && existsSync(join(ROOT, path)),
  );
  return changed.flatMap((path) => {
    const line = trailer(path);
    if (!line) return [];
    const text = readFileSync(join(ROOT, path), "utf8");
    const marked = text.endsWith(`\n${line}\n`);
    const bare = marked ? text.slice(0, -line.length - 1) : text;
    const before = execFileSync("git", ["show", `${FORK}:${path}`], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return [{ path, line, marked, bare, modified: bare !== before }];
  });
}

const check = process.argv.includes("--check");
const fix = process.argv.includes("--fix");
let bad = 0;
for (const path of postFork().sort()) {
  const kind = kindOf(path);
  if (kind !== "peachq") bad++;
  if (!check || kind !== "peachq") console.log(`${kind}\t${path}`);
}
for (const path of kxAtFork()) {
  if (existsSync(join(ROOT, path)) && kindOf(path) !== "kx") {
    bad++;
    console.log(`lost KX header\t${path}`);
  }
}
for (const { path, line, marked, bare, modified } of kxTrailers()) {
  if (marked === modified) continue;
  if (fix) {
    const end = bare.endsWith("\n") ? "" : "\n";
    const text = modified ? `${bare}${end}${line}\n` : bare;
    writeFileSync(join(ROOT, path), text);
    console.log(`${modified ? "marked" : "unmarked"}\t${path}`);
  } else {
    bad++;
    console.log(`${modified ? "unmarked" : "marked"} KX file\t${path}`);
  }
}
process.exit(check && bad ? 1 : 0);
