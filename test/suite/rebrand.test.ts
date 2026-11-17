/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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
const KX_PREFIX = /^(kdb|kx)/i;

describe("Rebrand", () => {
  it("tools/rebrand.mjs --check finds nothing left to rewrite", () => {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "tools", "rebrand.mjs"), "--check"],
      {
        encoding: "utf8",
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      },
    );
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  });

  describe("package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const c = pkg.contributes;

    it("is peachq.peachq", () => {
      assert.strictEqual(pkg.publisher, "peachq");
      assert.strictEqual(pkg.name, "peachq");
      assert.strictEqual(pkg.displayName, "peachq");
    });

    const contributed: [string, string[]][] = [
      ["command", c.commands.map((x) => x.command)],
      ["category", c.commands.map((x) => x.category).filter(Boolean)],
      ["setting", Object.keys(c.configuration.properties)],
      ["container", Object.keys(c.viewsContainers)],
      [
        "container id",
        Object.values<{ id: string }[]>(c.viewsContainers)
          .flat()
          .map((x) => x.id),
      ],
      [
        "view",
        Object.values<{ id: string }[]>(c.views)
          .flat()
          .map((x) => x.id)
          .concat(Object.keys(c.views)),
      ],
      ["notebook", c.notebooks.map((x) => x.type)],
      ["custom editor", c.customEditors.map((x) => x.viewType)],
      ["keybinding", c.keybindings.map((x) => x.command)],
      ["language", c.languages.map((x) => x.id)],
    ];
    for (const [kind, ids] of contributed) {
      it(`contributes no ${kind} with a KX prefix`, () => {
        assert.ok(ids.length > 0);
        assert.deepStrictEqual(
          ids.filter((id) => KX_PREFIX.test(id)),
          [],
        );
      });
    }

    it("turns every keybinding off while deferring to KX", () => {
      for (const binding of c.keybindings) {
        assert.ok(
          binding.when.includes("!peachq.deferringToKx"),
          binding.command,
        );
      }
    });
  });
});
