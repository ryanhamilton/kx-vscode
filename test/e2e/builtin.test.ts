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
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { activate, focus, terminal, terminalText, until } from "./utils";

// Run by `npm run test:e2e:bare`, in a window test/runE2E.ts opens with an
// empty HOME, PATH and workspace: the bundled peachq is the only q there is.
const BUILTIN = "peachq (built-in)";
const CONSOLE = `peachq ${BUILTIN}`;

function bundledProcess() {
  const lines = execFileSync("/bin/ps", ["-A", "-o", "pid=,args="], {
    encoding: "utf8",
  }).split("\n");
  const line = lines.find((found) =>
    found.includes(`${path.sep}bin${path.sep}peachq${path.sep}`),
  );
  if (!line) {
    return undefined;
  }
  const [pid, ...args] = line.trim().split(/\s+/);
  return { pid: Number(pid), args };
}

function reachable(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

describe("The built-in peachq connection, with no q installed", () => {
  let server: ReturnType<typeof bundledProcess>;

  before(async () => {
    await activate();
  });

  after(async () => {
    await vscode.commands.executeCommand(
      "peachq.connections.disconnect",
      BUILTIN,
    );
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("runs where no q is on HOME, PATH or QHOME", () => {
    assert.strictEqual(process.env.E2E_BARE, "1", "not the bare window");
    assert.strictEqual(process.env.QHOME, undefined);
    assert.ok(!fs.existsSync(path.join(os.homedir(), ".kx")));
    for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
      for (const name of ["q", "q.exe"]) {
        assert.ok(!fs.existsSync(path.join(dir, name)), `${dir} has ${name}`);
      }
    }
    assert.strictEqual(bundledProcess(), undefined, "peachq already running");
  });

  it("connects and answers 1+1 with 2", async () => {
    await vscode.commands.executeCommand("peachq-servers.focus");
    for (let attempt = 0; attempt < 20 && !terminal(CONSOLE); attempt++) {
      await vscode.commands.executeCommand(
        "peachq.connections.connect.via.dialog",
        BUILTIN,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await until(() => !!terminal(CONSOLE), "the built-in console");

    const folder = vscode.workspace.workspaceFolders![0].uri;
    await focus(vscode.Uri.joinPath(folder, "builtin.q"));
    await vscode.commands.executeCommand("peachq.execute.fileQuery");
    await until(
      async () =>
        (await terminalText(CONSOLE))
          .split(/\r?\n/)
          .some((line) => line.trim() === "2"),
      "2 in the built-in console",
    );
  });

  it("listens on 127.0.0.1 only, behind a private users file", async () => {
    server = bundledProcess();
    assert.ok(server, "no bundled peachq is running");
    const flag = server.args.indexOf("-p");
    const listen = /^127\.0\.0\.1:(\d+)$/.exec(server.args[flag + 1] ?? "");
    assert.ok(listen, `listens on ${server.args.join(" ")}`);
    const port = Number(listen[1]);
    assert.ok(await reachable("127.0.0.1", port));

    const external = Object.values(os.networkInterfaces())
      .flat()
      .filter((address) => address && !address.internal)
      .map((address) => address!.address);
    for (const address of external) {
      assert.ok(
        !(await reachable(address, port)),
        `${address}:${port} accepted a connection`,
      );
    }

    const users = server.args[server.args.indexOf("-U") + 1];
    assert.strictEqual(fs.statSync(users).mode & 0o777, 0o600);
  });

  it("stops peachq and removes its users file on disconnect", async () => {
    const users = server!.args[server!.args.indexOf("-U") + 1];
    await vscode.commands.executeCommand(
      "peachq.connections.disconnect",
      BUILTIN,
    );
    await until(() => bundledProcess() === undefined, "peachq to stop");
    assert.ok(!fs.existsSync(users), `${users} is still there`);
  });
});
