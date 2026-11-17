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
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { lintQ, probeLsp } from "../../../src/utils/qlint";

function script(body: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qlint-"));
  const file = path.join(dir, "q");
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
}

describe("qlint", () => {
  describe("lintQ", () => {
    const bundled = () => "/bundled/q";

    it("prefers the setting, then PEACHQ_LSP_Q, then the bundled peachq", () => {
      assert.strictEqual(lintQ("/set/q", "/env/q", bundled), "/set/q");
      assert.strictEqual(lintQ("", "/env/q", bundled), "/env/q");
      assert.strictEqual(lintQ("", undefined, bundled), "/bundled/q");
    });

    it("has no q at all rather than one from QHOME or PATH", () => {
      assert.strictEqual(
        lintQ("", undefined, () => undefined),
        undefined,
      );
    });
  });

  describe("probeLsp", function () {
    if (process.platform === "win32") {
      return;
    }

    it("turns down a q that answers with a REPL prompt", async () => {
      const result = await probeLsp(script("printf 'q)'; cat >/dev/null"));

      assert.strictEqual(result.name, undefined);
      assert.match(result.reason!, /not a language server/);
    });

    it("gives up on a q that never answers", async () => {
      const result = await probeLsp(script("sleep 5"), 200);

      assert.strictEqual(result.reason, "no reply");
    });

    it("reads serverInfo from the initialize reply", async () => {
      const body =
        '{"jsonrpc":"2.0","id":1,"result":{"capabilities":{},"serverInfo":{"name":"qlint","version":"9"}}}';
      const result = await probeLsp(
        script(
          `printf 'Content-Length: ${body.length}\\r\\n\\r\\n%s' '${body}'; sleep 5`,
        ),
      );

      assert.deepStrictEqual(result, { name: "qlint", version: "9" });
    });
  });
});
