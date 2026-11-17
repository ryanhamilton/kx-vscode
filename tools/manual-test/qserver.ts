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

// Start/stop peachq processes for manual testing. A listening port ALWAYS gets
// a -U users file: this tool refuses to start an unauthenticated q, or any q
// that is not peachq.
//
//   node qserver.ts start [--port 5000] [--user tester] [--password pw] [--q <path>]
//   node qserver.ts stop [--port 5000]      (no --port: stop all)
//   node qserver.ts list
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";

import {
  fs,
  path,
  p,
  ensure,
  readJson,
  sleep,
  isAlive,
  parseArgs,
  type ParsedArgs,
} from "./lib/common.ts";

const dir = () => ensure(p("q"));
const stateFile = (port: number | string) => path.join(dir(), `q-${port}.json`);

function findQ(explicit?: string) {
  let q = explicit || process.env.PEACHQ_Q;
  if (!q)
    try {
      q = execFileSync(
        process.platform === "win32" ? "where" : "which",
        ["q"],
        { encoding: "utf8" },
      )
        .split(/\r?\n/)[0]
        .trim();
    } catch {
      // q is not on PATH
    }
  if (!q) throw new Error("q not found: pass --q <path> or set PEACHQ_Q");
  if (!fs.existsSync(q)) throw new Error(`q not found at ${q}`);
  let version = "";
  try {
    version = execFileSync(q, ["-q"], {
      input: '-1 "pq:",.pq.version;exit 0\n',
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    // did not start or did not exit: not peachq either way
  }
  const m = version.match(/^pq:(\S+)/m);
  if (!m)
    throw new Error(
      `${q} is not peachq (no .pq.version); refusing to start it. Install peachq: see tools/manual-test/README.md`,
    );
  return { q, version: m[1] };
}

function probe(port: number | string) {
  return new Promise<boolean>((res) => {
    const s = net.connect(Number(port), "127.0.0.1");
    s.once("connect", () => (s.destroy(), res(true)));
    s.once("error", () => res(false));
  });
}

async function start(a: ParsedArgs) {
  const port = Number(a.port || 5000);
  if (readJson(stateFile(port)) && isAlive(readJson(stateFile(port)).keeper))
    throw new Error(`a q is already managed on port ${port}; stop it first`);
  if (await probe(port)) throw new Error(`port ${port} is already in use`);
  const { q, version } = findQ(a.q);
  const user = a.user || "tester";
  const password = a.password || "pw" + Math.random().toString(36).slice(2, 10);
  const users = path.join(dir(), `users-${port}.txt`);
  // q's -U file takes user:md5(password): keep the plain password off disk.
  const md5 = crypto.createHash("md5").update(password).digest("hex");
  fs.writeFileSync(users, `${user}:${md5}\n`, { mode: 0o600 });
  const keeper = spawn(
    process.execPath,
    [import.meta.filename, "_keeper", String(port), q, users],
    { detached: true, stdio: "ignore", cwd: dir(), windowsHide: true },
  );
  keeper.unref();
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await probe(port)) {
      const st = readJson(stateFile(port));
      return {
        port,
        user,
        password,
        q,
        version,
        pid: st && st.pid,
        host: "127.0.0.1",
      };
    }
  }
  // Never leave the credentials behind when q failed to come up.
  fs.rmSync(users, { force: true });
  fs.rmSync(stateFile(port), { force: true });
  throw new Error("q did not start listening within 10s");
}

// Long-lived parent that owns q's stdin, so q does not exit on EOF.
function keeper(port: string, q: string, users: string) {
  const child = spawn(q, ["-p", port, "-U", users], {
    stdio: ["pipe", "ignore", "ignore"],
    cwd: dir(),
    windowsHide: true,
  });
  fs.writeFileSync(
    stateFile(port),
    JSON.stringify({ port, keeper: process.pid, pid: child.pid, users }),
  );
  // A bad q path emits "error" (not "exit"); without a handler the keeper
  // would crash and leave its state and users files behind.
  child.on("error", () => {
    fs.rmSync(stateFile(port), { force: true });
    fs.rmSync(users, { force: true });
    process.exit(1);
  });
  child.on("exit", () => {
    fs.rmSync(stateFile(port), { force: true });
    process.exit(0);
  });
  process.on("SIGTERM", () => child.kill());
  setInterval(() => {}, 1 << 30);
}

async function stop(a: ParsedArgs) {
  const files = fs.readdirSync(dir()).filter((f) => /^q-\d+\.json$/.test(f));
  const out: number[] = [];
  for (const f of files) {
    const st = readJson(path.join(dir(), f));
    if (!st || (a.port && Number(a.port) !== Number(st.port))) continue;
    // The keeper deletes the state file when q exits, so a state file whose
    // keeper is gone or whose port is not listening is stale and its pids may
    // have been reused by unrelated processes: clean up, but never kill.
    if (isAlive(st.keeper) && (await probe(st.port)))
      for (const pid of [st.pid, st.keeper])
        try {
          process.kill(pid);
        } catch {
          // already gone
        }
    fs.rmSync(path.join(dir(), f), { force: true });
    fs.rmSync(st.users, { force: true });
    out.push(st.port);
  }
  return { stopped: out };
}

function list() {
  return fs
    .readdirSync(dir())
    .filter((f) => /^q-\d+\.json$/.test(f))
    .map((f) => readJson(path.join(dir(), f)))
    .filter((s) => s && isAlive(s.pid))
    .map((s) => ({ port: s.port, pid: s.pid }));
}

const [cmd, ...rest] = process.argv.slice(2);
const a = parseArgs(rest);
if (cmd === "_keeper") keeper(rest[0], rest[1], rest[2]);
else
  Promise.resolve(
    cmd === "start" ? start(a) : cmd === "stop" ? stop(a) : list(),
  )
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => (console.error("ERR " + e.message), process.exit(1)));
