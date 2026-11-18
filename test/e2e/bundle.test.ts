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
  "forum.kx.com/c/ideas",
  "KxSystems/kx-vscode/issues",
  "ryanhamilton/kx-vscode",
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

describe("The shipped wording and links", () => {
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const extension = read("out/extension.js");
  const webview = read("out/webview.js");

  for (const word of [
    "code.kx.com/q/kb/ssl",
    "of the kdb server",
    "KDB or Insights server",
    "Welcome to KDB-X",
    "kdb connection",
    "KDB connection",
    "next generation of kdb+",
    "kx_welcome.png",
    "kx_logo.png",
  ]) {
    it(`carry no ${word}`, () => {
      assert.ok(!extension.includes(word), `extension.js has ${word}`);
      assert.ok(!webview.includes(word), `webview.js has ${word}`);
    });
  }

  for (const word of ["developer.kx.com", "Install KDB-X", "<h2>KDB-X</h2>"]) {
    it(`keep ${word} off the welcome page`, () => {
      assert.ok(!webview.includes(word), `webview.js has ${word}`);
    });
  }

  for (const word of [
    "install_kdb",
    "portal.dl.kx.com",
    "nexus.dl.kx.com",
    "downloads.kx.com",
    "kdb-insights-personal-edition-license-download",
    "peachq.install.kdbx",
    "Install KDB-X",
  ]) {
    it(`carry no KDB-X installer: ${word}`, () => {
      assert.ok(!extension.includes(word), `extension.js has ${word}`);
      assert.ok(!webview.includes(word), `webview.js has ${word}`);
    });
  }

  it("point TLS help and the welcome page at peachq.org", () => {
    assert.ok(extension.includes("peachq.org/docs"));
    assert.ok(webview.includes("peachq.org/docs"));
    assert.ok(webview.includes("peachq.org/download"));
  });

  it("show the peachq logo on the welcome page and its tab", () => {
    assert.ok(extension.includes("peachq-logo.png"));
  });

  it("keep the Insights schema URLs", () => {
    assert.ok(
      extension.includes("code.kx.com/insights/enterprise/packaging/schemas"),
    );
  });
});
