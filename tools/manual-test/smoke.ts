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

// Headless walkthrough: peachq up, a connection made through the UI, a query
// run, its result read from the results webview, a screenshot checked.
//   node smoke.ts            exits non-zero on any failure
//   node smoke.ts --builtin  the same on the bundled peachq (built-in) connection
import { execFileSync, spawnSync } from "node:child_process";
import net from "node:net";
import zlib from "node:zlib";

import { fs, os, path, p } from "./lib/common.ts";

const env = { ...process.env, HEADLESS: "1" } as Record<string, string>;
delete env.DISPLAY;
delete env.WAYLAND_DISPLAY;
delete env.ELECTRON_RUN_AS_NODE;

const run = (script: string, ...args: string[]) =>
  execFileSync(
    process.execPath,
    [path.join(import.meta.dirname, script), ...args],
    {
      env,
      encoding: "utf8",
      timeout: 300000,
    },
  );
const tool = (script: string, ...args: string[]) => {
  console.log(`$ node ${script} ${args.join(" ")}`);
  const out = run(script, ...args);
  console.log(out.trimEnd());
  return out;
};
const cli = (...args: string[]) => tool("cli.ts", ...args);

function check(ok: unknown, what: string) {
  if (!ok) throw new Error("FAILED: " + what);
  console.log("ok: " + what);
}

const freePort = () =>
  new Promise<number>((res) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => res(port));
    });
  });

function refusesFakeQ(port: number) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fakeq-"));
  const fake = path.join(dir, "q");
  fs.writeFileSync(fake, '#!/bin/sh\ncat >/dev/null\necho "KDB+ 4.1"\n', {
    mode: 0o755,
  });
  const r = spawnSync(
    process.execPath,
    [
      path.join(import.meta.dirname, "qserver.ts"),
      "start",
      "--port",
      String(port),
      "--q",
      fake,
    ],
    { env, encoding: "utf8" },
  );
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(r.stderr.trimEnd());
  check(
    r.status !== 0 && /not peachq/.test(r.stderr),
    "qserver refuses a q without .pq.version",
  );
}

/** Width, height and distinct byte values of the PNG's pixel data. */
function pngStats(file: string) {
  const b = fs.readFileSync(file);
  const idat: Buffer[] = [];
  for (let o = 8; o < b.length; ) {
    const len = b.readUInt32BE(o);
    if (b.toString("ascii", o + 4, o + 8) === "IDAT")
      idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const px = zlib.inflateSync(Buffer.concat(idat));
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    distinct: new Set(px).size,
  };
}

/** Connects a node of the connections tree; returns its first context menu. */
function connect(node: string) {
  cli("click", ".activitybar [aria-label^='peachq']", "--settle", "1500");
  const offered = cli("click", node, "--right");
  cli("click", ".monaco-menu .action-label >> text='Connect server'");
  const menu = cli("click", node, "--right");
  check(/CONTEXT MENU: Disconnect/.test(menu), "connected");
  cli("esc", "--no-snap");
  return offered;
}

function connectBuiltin() {
  cli("start");
  const offered = connect("peachq (built-in)");
  check(!/Edit connection|Remove connection/.test(offered), "not editable");
}

async function connectToQServer(port: number) {
  console.log(`$ node qserver.ts start --port ${port}`);
  const q = JSON.parse(run("qserver.ts", "start", "--port", String(port)));
  console.log(`peachq ${q.version} on ${port}, user ${q.user}`);
  cli("start");
  cli("palette", "peachq: New Connection", "--settle", "3000");
  cli("click", ".tab[aria-label*='New Connection']", "--settle", "1500");
  cli("wv.click", "0", "Authentication & TLS", "--no-snap");
  const fill = (label: string, v: string) =>
    cli("wv.fill", "0", "label:" + label, v, "--no-snap");
  fill("Connection Name", "smoke");
  fill("Define connection address", "127.0.0.1");
  fill("Set port number", String(port));
  fill("Username", q.user);
  console.log("$ node cli.ts wv.fill 0 label:Password *** --no-snap");
  run("cli.ts", "wv.fill", "0", "label:Password", q.password, "--no-snap");
  cli("wv.click", "0", "Create Connection", "--settle", "3000");
  connect(`smoke [127.0.0.1:${port}]`);
}

async function main() {
  const builtin = process.argv.includes("--builtin");
  const port = await freePort();
  refusesFakeQ(port);

  try {
    if (builtin) connectBuiltin();
    else await connectToQServer(port);

    fs.writeFileSync(p("workspace", "smoke.q"), "([]a:1 2 3; b:`x`y`z)\n");
    cli("file.open", "smoke.q", "--settle", "1000");
    cli("click", ".editor-actions [aria-label*='Output Destination']");
    cli("click", ".monaco-menu .action-label >> text='peachq Results View'");
    cli("click", ".tab[aria-label='smoke.q']", "--no-snap");
    cli("palette", "peachq: Execute Entire File", "--settle", "3000");
    cli("wait", "webview", "`z", "--timeout", "20000");
    const grid = cli("wv.text").trim();
    for (const t of ["a", "b", "1", "2", "3", "`x", "`y", "`z"])
      check(grid.split(" | ").includes(t), `results webview shows ${t}`);

    cli("click", "[aria-label^='Maximize Panel']", "--no-snap");
    const shot = cli("shot", "smoke").trim();
    const s = pngStats(shot);
    check(s.width === 1600 && s.height === 1000, `screenshot is 1600x1000`);
    // A blank frame inflates to a handful of byte values.
    check(s.distinct > 64, `screenshot is not blank (${s.distinct} values)`);
    console.log("SMOKE PASSED " + shot);
  } finally {
    try {
      cli("stop");
    } catch {
      // driver already gone
    }
    const { stopped } = JSON.parse(
      tool("qserver.ts", "stop", "--port", String(port)),
    );
    if (!builtin && !stopped.map(Number).includes(port)) {
      console.error(`FAILED: peachq on port ${port} was not stopped`);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
