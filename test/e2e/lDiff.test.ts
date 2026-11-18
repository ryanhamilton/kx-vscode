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

import { globSync } from "glob";
import * as nodeq from "node-q";
import * as assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { reachable, until } from "./utils";
import { LocalConnection } from "../../src/classes/localConnection";
import { getConextForRerunQuery } from "../../src/commands/serverCommand";
import { ext } from "../../src/extensionVariables";

// `npm run test:l-diff`: each script loaded with \l in one fresh peachq and
// sent by the whole-file command's own runScript to another, then compared.
const REPO = path.resolve(__dirname, "..", "..", "..");
const FIXTURES = path.join(REPO, "test", "fixtures", "l-diff");
const EXPECTED = path.join(FIXTURES, "expected.tsv");
const CORPUS = [
  ...[
    "main.q",
    "trades.q",
    "lang.q",
    "plain.q",
    "active.q",
    "pinned.q",
    "folderA/a.q",
    "folderB/b.q",
  ].map((name) => `test/e2e/workspace/${name}`),
  "test/suite/server/fixtures/mod/bar.q",
  ...globSync("test/fixtures/l-diff/**/*.q", { cwd: REPO }).sort(),
];
const IGNORED = "`q`Q`h`z`o`j`m`pq`help`axq";
const DUMP = [
  '-1 "@@OUT@@"',
  '-1 "@@D@@",string system "d"',
  'system "d ."',
  'system "c 2000 2000"',
  `{-1 "@@V@@",x,"\\t",ssr[-3!value y;"\\n";"\\\\n"]}'[string each r;r:(key\`.),raze {$[99h<>type v:value x;enlist x;(\`)~first key v;raze .z.s each \` sv/: x,/:1_key v;enlist x]} each \` sv/: \`,/:key[\`] except ${IGNORED}]`,
  '-1 "@@END@@";',
].join(";");

interface Run {
  printed: string;
  error: string;
  ctx: string;
  state: Map<string, string>;
}

let port = 25400;
const processes: ChildProcess[] = [];

function peachq(cwd: string, listen?: number) {
  const args = [
    "-q",
    "-classic",
    ...(listen ? ["-p", `127.0.0.1:${listen}`] : []),
  ];
  const child = spawn(process.env.PEACHQ_Q!, args, { cwd });
  processes.push(child);
  let out = "";
  child.stdout.on("data", (data) => (out += data));
  child.stderr.on("data", (data) => (out += data));
  return { child, out: () => out };
}

async function dumped(q: ReturnType<typeof peachq>, error = "") {
  q.child.stdin!.write(`${DUMP}\n`);
  await until(() => q.out().includes("@@END@@"), "the state dump");
  q.child.kill();
  const [before, after] = q.out().split("@@OUT@@\n");
  const state = new Map<string, string>();
  let ctx = "";
  for (const line of after.split("\n")) {
    if (line.startsWith("@@D@@")) ctx = line.slice(5);
    if (line.startsWith("@@V@@")) {
      const [name, ...value] = line.slice(5).split("\t");
      state.set(name, value.join("\t"));
    }
  }
  const loadError = /^'(.*)\n\s*\[\d+\]\s+\S+?:(\d+): /m.exec(before);
  return {
    printed: loadError ? before.slice(0, loadError.index) : before,
    error: loadError ? `${loadError[1]} at line ${loadError[2]}` : error,
    ctx,
    state,
  };
}

function loaded(file: string): Promise<Run> {
  const q = peachq(path.dirname(file));
  q.child.stdin!.write(`\\l ${file}\n`);
  return dumped(q);
}

// The innermost frame of the lambda's trace is the statement that failed.
function errorOf(text: string, reply: unknown) {
  if (typeof reply !== "string" || !reply.startsWith("Error: ")) return "";
  const [message, ...trace] = reply.slice(7).split("\n");
  const frames = trace
    .map((line) => /^\s*\[(\d+)\]\s+(.*)$/.exec(line))
    .filter((frame): frame is RegExpExecArray => !!frame)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const statement = frames[0]?.[2].trim();
  const line = statement
    ? text.split("\n").findIndex((each) => each.trim().startsWith(statement))
    : -1;
  return `${message} at line ${line < 0 ? "?" : line + 1}`;
}

async function sent(file: string): Promise<Run> {
  const listen = port++;
  const q = peachq(path.dirname(file), listen);
  await until(() => reachable("127.0.0.1", listen), `peachq on ${listen}`);
  const connection = await new Promise<nodeq.Connection>((resolve, reject) =>
    nodeq.connect({ host: "127.0.0.1", port: listen }, (error, conn) =>
      error ? reject(error) : resolve(conn),
    ),
  );
  const text = fs.readFileSync(file, "utf8");
  const conn = Object.assign(Object.create(LocalConnection.prototype), {
    connection,
    useAPI: false,
    updateGlobal: () => undefined,
  }) as LocalConnection;
  const reply = await conn.runScript(text, getConextForRerunQuery(text));
  connection.close();
  return dumped(q, errorOf(text, reply));
}

const cell = (value?: string) =>
  value === undefined
    ? "<absent>"
    : JSON.stringify(value).slice(1, -1).slice(0, 160);

function differences(script: string, a: Run, b: Run): string[][] {
  const rows: string[][] = [];
  for (const aspect of ["printed", "error", "ctx"] as const) {
    if (a[aspect] !== b[aspect]) {
      rows.push([script, aspect, cell(a[aspect]), cell(b[aspect])]);
    }
  }
  for (const name of new Set([...a.state.keys(), ...b.state.keys()])) {
    if (a.state.get(name) !== b.state.get(name)) {
      rows.push([
        script,
        `state ${name}`,
        cell(a.state.get(name)),
        cell(b.state.get(name)),
      ]);
    }
  }
  return rows;
}

const HEADER = [
  "script",
  "aspect",
  "loaded with \\l",
  "whole-file command",
  "cause",
];

function expectedRows() {
  return fs
    .readFileSync(EXPECTED, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

describe("\\l against the whole-file command on peachq", function () {
  const found: string[][] = [];

  before(function () {
    if (!process.env.PEACHQ_Q) {
      this.skip();
    }
    ext.context = {
      asAbsolutePath: (relative: string) => path.join(REPO, relative),
    } as vscode.ExtensionContext;
  });

  after(() => {
    for (const child of processes) {
      child.kill();
    }
    if (!process.env.PEACHQ_Q) return;
    const causes = new Map(
      expectedRows().map((row) => [`${row[0]}\t${row[1]}`, row[4]]),
    );
    const rows = found.map((row) => [
      ...row,
      causes.get(`${row[0]}\t${row[1]}`) ?? "?",
    ]);
    const table = [HEADER, ...rows].map((row) => row.join("\t")).join("\n");
    if (process.env.L_DIFF_WRITE) {
      fs.writeFileSync(EXPECTED, `${table}\n`);
    }
    const byCause = new Map<string, number>();
    for (const row of rows) {
      byCause.set(row[4], (byCause.get(row[4]) ?? 0) + 1);
    }
    console.log(`\\l differences over ${CORPUS.length} scripts, by cause:`);
    for (const [cause, count] of byCause) {
      console.log(`  ${count}\t${cause}`);
    }
  });

  for (const script of CORPUS) {
    it(script, async () => {
      const file = path.join(REPO, script);
      const rows = differences(script, await loaded(file), await sent(file));
      found.push(...rows);
      if (process.env.L_DIFF_WRITE) return;
      assert.deepStrictEqual(
        rows,
        expectedRows()
          .filter((row) => row[0] === script)
          .map((row) => row.slice(0, 4)),
      );
    });
  }
});
