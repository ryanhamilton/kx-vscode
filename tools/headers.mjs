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
// `--check` exits 1 if one lacks the peachq header or a KX file lost KX's.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FORK = "654ea443";
const SOURCE = /\.(ts|mts|mjs|js|q|sh)$/;
const DATA = ["test/fixtures/l-diff/", "test/fixtures/q-render/"];
const PEACHQ = "Copyright (c) 2026 peachq contributors";
const KX = /Copyright \(c\) 1998-\d{4} KX Systems Inc\./;
const APACHE =
  /Apache License, Version 2\.0|SPDX-License-Identifier: Apache-2\.0/;

const sources = (paths) =>
  paths.filter((p) => SOURCE.test(p) && !DATA.some((d) => p.startsWith(d)));

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split("\n");

const head = (path) =>
  readFileSync(join(ROOT, path), "utf8").split("\n").slice(0, 16).join("\n");

export function kindOf(path) {
  const text = head(path);
  if (text.includes(PEACHQ) && APACHE.test(text) && !KX.test(text)) {
    return "peachq";
  }
  return KX.test(text) ? "kx" : "none";
}

export function postFork() {
  const atFork = new Set(git("ls-tree", "-r", "--name-only", FORK));
  const now = sources([
    ...git("ls-files"),
    ...git("ls-files", "--others", "--exclude-standard"),
  ]);
  return [...new Set(now)].filter(
    (path) => !atFork.has(path) && existsSync(join(ROOT, path)),
  );
}

export function kxAtFork() {
  const hits = git("grep", "-n", "-F", "KX Systems Inc.", FORK)
    .map((hit) => hit.slice(FORK.length + 1).split(":"))
    .filter(([, line]) => Number(line) <= 3);
  return sources(hits.map(([path]) => path));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
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
  process.exit(check && bad ? 1 : 0);
}
