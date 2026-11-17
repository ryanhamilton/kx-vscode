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

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "../../..");
const FORBIDDEN = [
  "applicationinsights",
  "InstrumentationKey",
  "7efda3fc",
  "extension-telemetry",
  "maze.co",
  "userevidence",
  "newsletter",
];

for (const file of ["out/extension.js", "package.json"]) {
  describe(`The shipped ${file}`, () => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8").toLowerCase();

    for (const word of FORBIDDEN) {
      it(`carries no ${word}`, () => {
        assert.ok(!text.includes(word.toLowerCase()), `found ${word}`);
      });
    }
  });
}
