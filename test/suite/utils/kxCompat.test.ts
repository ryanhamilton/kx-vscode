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
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as kx from "../../../src/utils/kxCompat";

class FakeMemento implements vscode.Memento {
  readonly values = new Map<string, unknown>();
  keys = () => [...this.values.keys()];
  get = (key: string) => this.values.get(key) as any;
  update = async (key: string, value: unknown) => {
    this.values.set(key, value);
  };
}

interface Layer {
  globalValue?: unknown;
  workspaceValue?: unknown;
}

// Stands in for the user and workspace settings of both sections.
function settings(sections: Record<string, Record<string, Layer>>) {
  const writes: [string, string, unknown, unknown][] = [];
  sinon.stub(vscode.workspace, "getConfiguration").callsFake(((
    section: string,
  ) => {
    const values = (sections[section] ??= {});
    return {
      get: (key: string, fallback?: unknown) =>
        values[key]?.workspaceValue ?? values[key]?.globalValue ?? fallback,
      inspect: (key: string) => ({ key, ...values[key] }),
      update: async (key: string, value: unknown, target: unknown) => {
        writes.push([section, key, value, target]);
        values[key] = { ...values[key], globalValue: value };
      },
    };
  }) as any);
  return writes;
}

describe("kxCompat", () => {
  let info: sinon.SinonStub;

  beforeEach(() => {
    ext.outputChannel = vscode.window.createOutputChannel("peachq", {
      log: true,
    });
    info = sinon.stub(vscode.window, "showInformationMessage");
  });

  afterEach(() => sinon.restore());

  describe("shouldDeferToKx", () => {
    const kxInstalled = (installed: boolean) =>
      sinon
        .stub(vscode.extensions, "getExtension")
        .withArgs(kx.KX_EXTENSION_ID)
        .returns(installed ? <any>{ id: kx.KX_EXTENSION_ID } : undefined);

    it("defers when the KX extension is enabled", () => {
      settings({});
      kxInstalled(true);
      assert.strictEqual(kx.shouldDeferToKx(), true);
    });

    it("does not defer without it", () => {
      settings({});
      kxInstalled(false);
      assert.strictEqual(kx.shouldDeferToKx(), false);
    });

    it("never defers when peachq.deferToKx is never", () => {
      settings({ peachq: { deferToKx: { globalValue: "never" } } });
      kxInstalled(true);
      assert.strictEqual(kx.shouldDeferToKx(), false);
    });
  });

  describe("promptDeferToKx", () => {
    it("asks once per workspace", async () => {
      const state = new FakeMemento();
      info.resolves(undefined);
      await kx.promptDeferToKx(state);
      await kx.promptDeferToKx(state);
      sinon.assert.calledOnceWithExactly(
        info,
        kx.PAUSED,
        kx.USE_PEACHQ,
        kx.KEEP_KX,
      );
    });

    it("remembers Keep KX", async () => {
      const state = new FakeMemento();
      info.resolves(kx.KEEP_KX);
      await kx.promptDeferToKx(state);
      assert.ok(state.values.has("peachq.kxDeferAnswer"));
      assert.strictEqual(state.get("peachq.kxDeferAnswer"), kx.KEEP_KX);
    });

    it("opens the KX extension for Use peachq here", async () => {
      const execute = sinon.stub(vscode.commands, "executeCommand");
      info.resolves(kx.USE_PEACHQ);
      await kx.promptDeferToKx(new FakeMemento());
      sinon.assert.calledWith(execute, "extension.open", kx.KX_EXTENSION_ID);
    });
  });

  describe("importing", () => {
    const KEYS = ["servers", "connectionLabels", "qHomeDirectory"];
    const SERVERS = {
      A: { serverAlias: "A", serverName: "h", serverPort: "1", auth: true },
    };

    it("lists the user settings only KX has", () => {
      settings({
        kdb: {
          servers: { globalValue: SERVERS },
          connectionLabels: { globalValue: [] },
          qHomeDirectory: { workspaceValue: "/q" },
        },
        peachq: { connectionLabels: { globalValue: [{ name: "x" }] } },
      });
      assert.deepStrictEqual(kx.pendingImports(KEYS), ["servers"]);
    });

    it("copies them to the user peachq settings", async () => {
      const writes = settings({ kdb: { servers: { globalValue: SERVERS } } });
      const refreshed = sinon.spy();
      const imported = await kx.runImportFromKx(KEYS, refreshed);
      assert.deepStrictEqual(imported, ["servers"]);
      assert.deepStrictEqual(writes, [
        ["peachq", "servers", SERVERS, vscode.ConfigurationTarget.Global],
      ]);
      sinon.assert.calledOnce(refreshed);
      assert.match(info.firstCall.args[0], /asked for each one on first/);
      assert.deepStrictEqual(kx.pendingImports(KEYS), []);
    });

    it("offers nothing when there is nothing to import", async () => {
      settings({});
      await kx.offerImportFromKx(new FakeMemento(), KEYS, () => {});
      sinon.assert.notCalled(info);
    });

    it("stops offering after Never", async () => {
      settings({ kdb: { servers: { globalValue: SERVERS } } });
      const state = new FakeMemento();
      info.resolves(kx.NEVER);
      await kx.offerImportFromKx(state, KEYS, () => {});
      await kx.offerImportFromKx(state, KEYS, () => {});
      sinon.assert.calledOnceWithExactly(
        info,
        kx.IMPORT_QUESTION,
        kx.IMPORT,
        kx.NOT_NOW,
        kx.NEVER,
      );
    });

    it("imports when asked to", async () => {
      const writes = settings({ kdb: { servers: { globalValue: SERVERS } } });
      info.onFirstCall().resolves(kx.IMPORT);
      await kx.offerImportFromKx(new FakeMemento(), KEYS, () => {});
      assert.strictEqual(writes.length, 1);
    });

    it("takes its keys from the contributed peachq settings", () => {
      const keys = kx.importableKeys({
        contributes: {
          configuration: {
            properties: { "peachq.servers": {}, "peachq.deferToKx": {} },
          },
        },
      });
      assert.deepStrictEqual(keys, ["servers"]);
    });
  });

  describe("kxMapEntry", () => {
    it("reads a workspace kdb map", () => {
      settings({
        kdb: { connectionMap: { workspaceValue: { "a.q": "SERVER" } } },
      });
      const uri = vscode.Uri.file("/w/a.q");
      assert.strictEqual(kx.kxMapEntry("connectionMap", uri, "a.q"), "SERVER");
      assert.strictEqual(kx.kxMapEntry("connectionMap", uri, "b.q"), undefined);
    });
  });
});
