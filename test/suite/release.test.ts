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

  it("has a NOTICE naming the upstream work and the trademarks", () => {
    const notice = prose("NOTICE");
    assert.match(notice, /modified version of the kdb VS Code extension/);
    assert.match(notice, /KX Systems, Inc\./);
    assert.match(notice, /Apache License 2\.0/);
    assert.match(notice, /not affiliated with or endorsed by KX/);
    assert.match(prose("README.md"), /not affiliated with or endorsed by KX/);
  });

  it("gives every file added since the fork the peachq header", () => {
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
