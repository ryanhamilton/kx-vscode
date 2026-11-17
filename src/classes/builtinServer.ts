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

import { ChildProcess, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  accessSync,
  chmodSync,
  constants,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { join } from "node:path";

import { ServerDetails } from "../models/connectionsModels";
import { BUILTIN_ALIAS } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";

const logger = "builtinServer";

const BUILTIN_HOST = "127.0.0.1";
const USER = "peachq";
const STARTUP_MS = 10_000;

export interface BuiltinEndpoint {
  connectionString: string;
  credentials: string[];
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, BUILTIN_HOST, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("no free port")),
      );
    });
  });
}

function accepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: BUILTIN_HOST, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** The bundled peachq, run on loopback with throwaway credentials. */
export class BuiltinServer {
  readonly details: ServerDetails = {
    serverName: BUILTIN_HOST,
    serverPort: "",
    serverAlias: BUILTIN_ALIAS,
    auth: false,
    tls: false,
  };

  private process?: ChildProcess;
  private usersFile?: string;

  constructor(
    readonly binary: string,
    private readonly storage: string,
  ) {}

  async start(): Promise<BuiltinEndpoint> {
    this.stop();
    const port = await freePort();
    const password = randomBytes(24).toString("hex");
    const md5 = createHash("md5").update(password).digest("hex");
    mkdirSync(this.storage, { recursive: true });
    const usersFile = join(this.storage, `builtin-${port}.users`);
    this.usersFile = usersFile;
    writeFileSync(usersFile, `${USER}:${md5}\n`, { mode: 0o600 });
    this.ensureExecutable();

    let output = "";
    let ended = "";
    const child = spawn(
      this.binary,
      ["-p", `${BUILTIN_HOST}:${port}`, "-U", usersFile, "-q"],
      { cwd: this.storage, stdio: ["ignore", "pipe", "pipe"] },
    );
    this.process = child;
    // Kept only while starting, for the error; drained unread after that.
    const collect = (chunk: Buffer) =>
      (output = (output + chunk.toString()).slice(-2000));
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    child.once("error", (error) => (ended = error.message));
    child.once("exit", (code, signal) => {
      ended ||= `exited with ${signal ?? code}`;
      if (this.process === child) {
        this.process = undefined;
        this.cleanUp();
      }
    });

    const deadline = Date.now() + STARTUP_MS;
    while (!(await accepts(port))) {
      if (ended || Date.now() > deadline) {
        this.stop();
        const reason = [ended || "timed out", output.trim()];
        throw new Error(
          `The built-in peachq did not start: ${reason.filter(Boolean).join(": ")}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    for (const stream of [child.stdout, child.stderr]) {
      stream?.off("data", collect).resume();
    }
    this.details.serverPort = String(port);
    notify(
      `Built-in peachq started on ${BUILTIN_HOST}:${port} (pid ${child.pid}).`,
      MessageKind.DEBUG,
      { logger },
    );
    return {
      connectionString: `${BUILTIN_HOST}:${port}`,
      credentials: [USER, password],
    };
  }

  stop(): void {
    const child = this.process;
    this.process = undefined;
    if (child && child.exitCode === null) {
      child.kill();
      notify(`Built-in peachq (pid ${child.pid}) stopped.`, MessageKind.DEBUG, {
        logger,
      });
    }
    this.cleanUp();
  }

  private cleanUp(): void {
    this.details.serverPort = "";
    if (this.usersFile) {
      rmSync(this.usersFile, { force: true });
      this.usersFile = undefined;
    }
  }

  // A vsix may be unpacked without the executable bit.
  private ensureExecutable(): void {
    if (process.platform === "win32") {
      return;
    }
    try {
      accessSync(this.binary, constants.X_OK);
    } catch {
      chmodSync(this.binary, 0o755);
    }
  }
}
