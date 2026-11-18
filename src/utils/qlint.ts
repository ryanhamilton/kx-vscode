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

import { spawn } from "node:child_process";
import { workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerCapabilities,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import { bundledQ } from "./core";
import { ext } from "../extensionVariables";

export const QLINT_SERVER = "qlint";
const PROBE_TIMEOUT = 3000;

let client: LanguageClient | undefined;

export const qlintActive = () => client?.isRunning() ?? false;

export const qlintProvides = (capability: keyof ServerCapabilities) =>
  qlintActive() && !!client?.initializeResult?.capabilities[capability];

// Never the user's QHOME or PATH q: that may be KX q, which has no -lsp.
export function lintQ(
  setting = workspace.getConfiguration("peachq.lint").get<string>("qPath"),
  fromEnv = process.env.PEACHQ_LSP_Q,
  bundled = bundledQ,
): string | undefined {
  return setting || fromEnv || bundled();
}

function frame(body: object) {
  const text = JSON.stringify(body);
  return `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`;
}

// A q without -lsp starts a REPL and evaluates stdin, so the probe sends only
// an empty initialize and kills the process on the first byte that is not a
// frame header.
export function probeLsp(
  binary: string,
  timeout = PROBE_TIMEOUT,
): Promise<{ name?: string; version?: string; reason?: string }> {
  return new Promise((resolve) => {
    const child = spawn(binary, ["-lsp"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let out = Buffer.alloc(0);
    const done = (result: {
      name?: string;
      version?: string;
      reason?: string;
    }) => {
      clearTimeout(timer);
      child.kill();
      resolve(result);
    };
    const timer = setTimeout(() => done({ reason: "no reply" }), timeout);
    child.on("error", (error) => done({ reason: error.message }));
    child.on("exit", (code) => done({ reason: `exited with ${code}` }));
    child.stdout.on("data", (data: Buffer) => {
      out = Buffer.concat([out, data]);
      const head = out.toString("latin1", 0, 16);
      if (
        !"Content-Length: ".startsWith(head) &&
        !head.startsWith("Content-Length:")
      ) {
        return done({
          reason: `not a language server (${JSON.stringify(head)})`,
        });
      }
      const end = out.indexOf("\r\n\r\n");
      const length = /Content-Length: *(\d+)/.exec(
        out.toString("latin1", 0, end),
      );
      if (end < 0 || !length || out.length < end + 4 + +length[1]) {
        return;
      }
      try {
        const reply = JSON.parse(
          out.toString("utf8", end + 4, end + 4 + +length[1]),
        );
        done({ ...reply.result?.serverInfo });
      } catch {
        done({ reason: "unreadable initialize reply" });
      }
    });
    child.stdin.on("error", () => undefined);
    child.stdin.write(
      frame({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { processId: null, rootUri: null, capabilities: {} },
      }),
    );
  });
}

export async function startQlint(): Promise<LanguageClient | undefined> {
  const log = (message: string) => ext.outputChannel.info(`[qlint] ${message}`);
  if (
    !workspace.getConfiguration("peachq.lint").get<boolean>("enabled", true)
  ) {
    return undefined;
  }
  const binary = lintQ();
  if (!binary) {
    log("off: no peachq that serves -lsp (set peachq.lint.qPath)");
    return undefined;
  }
  const probe = await probeLsp(binary);
  if (probe.name !== QLINT_SERVER) {
    log(`off: ${binary} -lsp is not qlint: ${probe.reason ?? probe.name}`);
    return undefined;
  }
  const serverOptions: ServerOptions = {
    command: binary,
    args: ["-lsp"],
    transport: TransportKind.stdio,
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "q", scheme: "file" },
      { language: "q", scheme: "untitled" },
      { language: "q", notebook: { notebookType: "peachq-notebook" } },
    ],
    revealOutputChannelOn: RevealOutputChannelOn.Never,
  };
  // No utf-8 offer: vscode-languageclient 9 throws on any reply but utf-16.
  client = new LanguageClient(
    "peachq.qlint",
    "peachq qlint",
    serverOptions,
    clientOptions,
  );
  await client.start();
  log(`on: ${binary} (${probe.name} ${probe.version})`);
  return client;
}

export async function stopQlint() {
  await client?.stop();
  client = undefined;
}
