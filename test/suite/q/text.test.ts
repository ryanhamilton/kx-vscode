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

import * as assert from "assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { decode } from "../../../src/q/decode";
import { toCell, toCells, toConsole, toOneLine } from "../../../src/q/text";
import { QValue } from "../../../src/q/value";

const dir = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "test/fixtures/q-render",
);

const unescape = (s: string) =>
  s.replace(/\\(.)/g, (_, c) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c,
  );

function table(file: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(resolve(dir, file), "utf8")
    .split("\n")
    .filter((l) => l !== "");
  const names = header.split("\t");
  return lines.map((l) => {
    const cells = l.split("\t");
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ""]));
  });
}

const rows = table("expected.tsv");

const renderers: Record<string, (v: QValue) => string> = {
  console: (v) => toConsole(v),
  consoleSmall: (v) => toConsole(v, 40, 10),
  consoleWide: (v) => toConsole(v, 2000),
  oneLine: (v) => toOneLine(v),
  cell: (v) => toCell(v, 2000).replace(/ +$/, ""),
};

function mismatches(column: string, render: (v: QValue) => string) {
  return rows
    .map((r) => ({
      r,
      want: unescape(r[column]),
      got: render(decode(Buffer.from(r.hex, "hex"))),
    }))
    .filter(({ want, got }) => want !== got)
    .map(
      ({ r, want, got }) =>
        `${r.expr}\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`,
    );
}

describe("q value text", () => {
  it("has the whole corpus", () => {
    assert.ok(rows.length > 400, `${rows.length} rows`);
    assert.ok(
      rows.some((r) => r.qdocs !== ""),
      "a row marked as qdocs",
    );
  });

  for (const [column, render] of Object.entries(renderers)) {
    it(`renders every fixture row as q's ${column} text`, () => {
      const bad = mismatches(column, render);
      assert.strictEqual(
        bad.length,
        0,
        `${bad.length}/${rows.length}\n${bad.join("\n")}`,
      );
    });
  }

  it("fails most rows when rendered naively from node-q's decoding", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeq = require("node-q/lib/c.js");
    const naive = (hex: string) => {
      const v = nodeq.deserialize(Buffer.from(hex, "hex"), false);
      return typeof v === "string" ? v : JSON.stringify(v);
    };
    const passing = rows.filter((r) => {
      try {
        return naive(r.hex) === unescape(r.oneLine);
      } catch {
        return false;
      }
    });
    assert.ok(
      passing.length < rows.length / 4,
      `${passing.length}/${rows.length}`,
    );
  });

  it("renders a long general column in linear time", () => {
    const n = 50_000;
    const column: QValue = {
      kind: "list",
      attr: 0,
      items: Array.from({ length: n }, (_, i) => ({
        kind: "atom",
        type: 7,
        value: BigInt(i),
      })),
    };
    const cells = toCells(column);
    assert.strictEqual(cells.length, n);
    assert.strictEqual(cells[n - 1], String(n - 1));
  });

  it("gives the cells of a column as q's table shows them", () => {
    const column = decode(
      Buffer.from(rows.find((r) => r.expr === "(1;`a)")!.hex, "hex"),
    );
    assert.deepStrictEqual(toCells(column), ["1", "`a"]);
    const typed = decode(
      Buffer.from(rows.find((r) => r.expr === "`a`b`c")!.hex, "hex"),
    );
    assert.deepStrictEqual(toCells(typed), ["a", "b", "c"]);
  });
});

describe("q IPC decode", () => {
  const documented: [string, string][] = [
    ["0x010000000d000000fa01000000", "1i"],
    ["0x010000001200000006000100000001000000", ",1i"],
    ["0x01000000130000000400050000000001020304", "0x0001020304"],
    ["0x01000000190000000000010000000400050000000001020304", ",0x0001020304"],
    [
      "0x0100000021000000630b0002000000610062000600020000000200000003000000",
      "`a`b!2 3i",
    ],
    [
      "0x01000000210000007f0b0102000000610062000600020000000200000003000000",
      "`s#`a`b!2 3i",
    ],
    [
      "0x010000002d000000630b0002000000610062000000020000000600010000000200000006000100000003000000",
      "`a`b!(,2i;,3i)",
    ],
    [
      "0x010000002f0000006200630b0002000000610062000000020000000600010000000200000006000100000003000000",
      "+`a`b!(,2i;,3i)",
    ],
    [
      "0x010000003f000000636200630b00010000006100000001000000060001000000020000006200630b0001000000620000000100000006000100000003000000",
      "(+(,`a)!,,2i)!+(,`b)!,,3i",
    ],
    ["0x010000001500000064000a00050000007b782b797d", "{x+y}"],
    ["0x01000000160000006464000a00050000007b782b797d", "{x+y}"],
  ];

  it("decodes the qdocs serialization examples (kb/serialization.md)", () => {
    for (const [hex, text] of documented) {
      assert.strictEqual(
        toOneLine(decode(Buffer.from(hex.slice(2), "hex"))),
        text,
        hex,
      );
    }
  });

  it("keeps the context of a lambda defined outside the root", () => {
    const f = decode(
      Buffer.from("01000000160000006464000a00050000007b782b797d", "hex"),
    );
    assert.deepStrictEqual(f, {
      kind: "lambda",
      context: "d",
      source: "{x+y}",
    });
  });

  it("uncompresses what q compresses", () => {
    for (const r of table("compressed.tsv")) {
      assert.strictEqual(r.compressed.slice(4, 6), "01", r.expr);
      assert.deepStrictEqual(
        decode(Buffer.from(r.compressed, "hex")),
        decode(Buffer.from(r.plain, "hex")),
        r.expr,
      );
    }
  });
});
