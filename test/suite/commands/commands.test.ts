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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Commands", () => {
  const commands = new Map();
  let palette: any;
  let keybindings: any;

  before(() => {
    const config = JSON.parse(
      readFileSync(resolve(__dirname, "..", "..", "..", "..", "package.json"), {
        encoding: "utf8",
      }),
    );
    config.contributes.commands.forEach((cmd: any) =>
      commands.set(cmd.command, cmd.title),
    );
    palette = config.contributes.menus.commandPalette;
    keybindings = config.contributes.keybindings;
  });

  describe("Command Palette", () => {
    it("should include all commands", () => {
      assert.strictEqual(palette.length, commands.size);
      for (const cmd of palette) {
        assert.ok(commands.get(cmd.command));
      }
    });
    it("should have certain always visible commands", () => {
      const visible = [
        "peachq.show.welcome",
        "peachq.install.kdbx",
        "peachq.connections.export.all",
        "peachq.connections.import",
        "peachq.scratchpad.create",
        "peachq.scratchpad.python.create",
        "peachq.scratchpad.sql.create",
        "peachq.connections.add",
        "peachq.repl.start",
        "peachq.createNotebook",
        "peachq.query.create",
        "peachq.query.convert",
      ];
      const shown = palette.filter((cmd: any) => cmd.when === "true");
      assert.strictEqual(shown.length, visible.length);
      for (let i = 0; i < visible.length; i++) {
        assert.strictEqual(visible[i], shown[i].command);
      }
    });
    it("should have certain visible commands depending on context", () => {
      const visible = [
        "peachq.file.pickConnection",
        "peachq.file.pickTarget",
        "peachq.file.populateScratchpad",
        "peachq.scratchpad.editor.reset",
        "peachq.execute.selectedQuery",
        "peachq.execute.fileQuery",
        "peachq.scratchpad.python.run",
        "peachq.scratchpad.python.run.file",
        "peachq.execute.block",
        "peachq.toggleParameterCache",
        "peachq.notebook.rowLimit",
        "peachq.notebook.rowLimitFrom.first",
      ];
      const shown = palette.filter(
        (cmd: any) => cmd.when !== "true" && cmd.when !== "false",
      );
      assert.strictEqual(shown.length, visible.length);
      for (let i = 0; i < visible.length; i++) {
        assert.strictEqual(visible[i], shown[i].command);
      }
    });
  });

  describe("Keybindings", () => {
    it("should have a valid command", () => {
      for (const cmd of keybindings) {
        assert.ok(commands.get(cmd.command));
      }
    });
    it("should exist for certain commands", () => {
      const bindings = [
        "peachq.execute.selectedQuery",
        "peachq.execute.selectedQuery",
        "peachq.execute.fileQuery",
        "peachq.scratchpad.python.run",
        "peachq.scratchpad.python.run.file",
        "peachq.scratchpad.editor.reset",
        "peachq.file.populateScratchpad",
        "peachq.execute.block",
        "peachq.toggleParameterCache",
        "peachq.file.pickTarget",
      ];
      assert.strictEqual(bindings.length, keybindings.length);
      for (let i = 0; i < bindings.length; i++) {
        assert.strictEqual(bindings[i], keybindings[i].command);
      }
    });
  });
});
