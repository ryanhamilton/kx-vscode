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

import * as assert from "assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const prose = (file: string) => read(file).replace(/\s+/g, " ");

describe("Release", () => {
  const pkg = JSON.parse(read("package.json"));

  it("is published by timestored as peachq", () => {
    assert.strictEqual(pkg.publisher, "timestored");
    assert.strictEqual(pkg.name, "peachq");
  });

  it("has a full Marketplace listing", () => {
    const repo = "https://github.com/timestored/vscode-peachq";
    assert.strictEqual(pkg.displayName, "peachq – q & kdb+ IDE");
    assert.match(pkg.galleryBanner.color, /^#[0-9A-Fa-f]{6}$/);
    assert.match(pkg.galleryBanner.theme, /^(dark|light)$/);
    assert.strictEqual(pkg.bugs.url, `${repo}/issues`);
    assert.match(pkg.qna, /^https:\/\//);
    assert.strictEqual(pkg.homepage, "https://peachq.org");
    assert.ok(pkg.keywords.length <= 30);
    for (const k of ["q", "kdb+", "peachq", "qlang", "kdb"]) {
      assert.ok(pkg.keywords.includes(k), k);
    }
  });

  it("links README images absolutely, so the Marketplace can show them", () => {
    const readme = read("README.md");
    const images = [
      ...readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g),
      ...readme.matchAll(/<img[^>]*\ssrc=["']([^"']+)/g),
    ].map((m) => m[1]);
    assert.ok(images.length > 0);
    for (const src of images) assert.match(src, /^https:\/\//, src);
  });

  it("links the install page and the Marketplace from the README", () => {
    const readme = read("README.md");
    const id = `${pkg.publisher}.${pkg.name}`;
    assert.ok(readme.includes(`vscode:extension/${id}`));
    assert.ok(
      readme.includes(
        `https://marketplace.visualstudio.com/items?itemName=${id}`,
      ),
    );
  });

  it("is licensed Apache-2.0, as LICENSE and every header say", () => {
    assert.strictEqual(pkg.license, "Apache-2.0");
    assert.match(read("LICENSE"), /Apache License\s+Version 2\.0/);
  });

  it("is version 1.30.0 in package.json, its lockfile and CHANGELOG", () => {
    const lock = JSON.parse(read("package-lock.json"));
    assert.strictEqual(pkg.version, "1.30.0");
    assert.strictEqual(lock.version, "1.30.0");
    assert.strictEqual(lock.packages[""].version, "1.30.0");
    assert.match(read("CHANGELOG.md"), /^## 1\.30\.0\b/m);
    assert.doesNotMatch(read("CHANGELOG.md"), /^## Unreleased/m);
  });

  it("points at timestored/vscode-peachq, not the repository's old name", () => {
    for (const file of ["package.json", "README.md", "NOTICE"]) {
      assert.doesNotMatch(read(file), /ryanhamilton\/kx-vscode/, file);
    }
    assert.strictEqual(
      pkg.repository.url,
      "https://github.com/timestored/vscode-peachq.git",
    );
  });

  it("has a NOTICE naming the upstream work and the trademarks", () => {
    const notice = prose("NOTICE");
    assert.match(notice, /modified version of the kdb VS Code extension/);
    assert.match(notice, /KX Systems, Inc\./);
    assert.match(notice, /Apache License 2\.0/);
    assert.match(notice, /not affiliated with or endorsed by KX/);
    assert.match(prose("README.md"), /not affiliated with or endorsed by KX/);
  });

  it("heads new files peachq's and ends modified KX files with the trailer", () => {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "tools", "headers.mjs"), "--check"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      },
    );
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  });
});
