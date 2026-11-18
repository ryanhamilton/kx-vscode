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

import { decode } from "../../../src/q/decode";
import {
  fromNaked,
  fromQStudio,
  qstudioWrap,
  toGrid,
} from "../../../src/q/reply";
import { PEACHQ_REPLIES } from "../../fixtures/qReplies";

const reply = (name: keyof typeof PEACHQ_REPLIES) =>
  decode(Buffer.from(PEACHQ_REPLIES[name], "hex"));

describe("the qStudio wrapper", () => {
  it("is QueryManager.java:276-278 with the 10 MB cap, escaped in qStudio's order", () => {
    assert.strictEqual(
      qstudioWrap('a:"x\\y"\tb\r\nc'),
      '{v:$[`trp in key .Q; .Q.trp[{( (1b;`) ;value x)};x;{((0b;`);x;$[4<count y; .Q.sbt -4 _ y; ""])}]; ((1b;`);value x)]; a:10485760j>@[-22!;v;{0}]; (a;$[a;v;0b];.Q.s v 1)} "a:\\"x\\\\y\\"\\tb\\r\\nc"',
    );
  });

  it("sends a plain query as one string ending in its closing quote", () => {
    assert.ok(qstudioWrap("til 3").endsWith('} "til 3"'));
  });
});

describe("a qStudio reply", () => {
  it("carries the server's console text and the typed value", () => {
    const got = fromQStudio(reply("table"))!;
    assert.strictEqual(got.console, "a b\n---\n1 x\n2 y\n3 z\n");
    assert.strictEqual(got.value?.kind, "table");
    assert.strictEqual(got.error, undefined);
  });

  it("over the size cap carries text only", () => {
    const got = fromQStudio(reply("big"))!;
    assert.strictEqual(got.tooLarge, true);
    assert.strictEqual(got.value, undefined);
    assert.ok(got.console.startsWith("0 1 2 3"));
  });

  it("an assignment has no console text", () => {
    assert.strictEqual(fromQStudio(reply("assign"))!.console, "");
  });

  it("a failure carries the message and the trace", () => {
    const got = fromQStudio(reply("error"))!;
    assert.strictEqual(got.value, undefined);
    assert.ok(got.error?.startsWith("type\n  [7]  1+`a"), got.error);
    assert.strictEqual(got.console, '"type"\n');
  });

  it("a q error is the server refusing the whole message", () => {
    assert.deepStrictEqual(fromQStudio({ kind: "error", message: "access" }), {
      console: "",
      error: "access",
    });
  });

  it("something else is unreadable", () => {
    assert.strictEqual(fromQStudio(reply("naked")), undefined);
  });
});

describe("a naked reply", () => {
  it("renders its console text from the typed value", () => {
    const got = fromNaked(reply("naked"));
    assert.strictEqual(got.console, "a b\n---\n1 x\n2 y\n3 z\n");
    assert.strictEqual(got.value?.kind, "table");
  });
});

describe("the grid of a typed value", () => {
  it("shows a table's cells as q prints them in a column", () => {
    const grid = toGrid(fromQStudio(reply("table"))!.value)!;
    assert.strictEqual(grid.count, 3);
    assert.deepStrictEqual(grid.columns, [
      { name: "a", type: "longs", values: ["1", "2", "3"], order: [] },
      { name: "b", type: "symbols", values: ["x", "y", "z"], order: [] },
    ]);
  });

  it("marks a keyed table's key columns", () => {
    const grid = toGrid(fromQStudio(reply("keyed"))!.value)!;
    assert.deepStrictEqual(
      (grid.columns as { name: string; isKey?: boolean }[]).map((c) => [
        c.name,
        !!c.isKey,
      ]),
      [
        ["k", true],
        ["v", false],
      ],
    );
  });

  it("lays a dictionary out as key and values", () => {
    const grid = toGrid(fromQStudio(reply("dict"))!.value)!;
    assert.deepStrictEqual(grid.columns, [
      {
        name: "key",
        type: "symbols",
        values: ["a", "b"],
        order: [],
        isKey: true,
      },
      { name: "values", type: "longs", values: ["1", "2"], order: [] },
    ]);
  });

  it("has nothing for an atom", () => {
    assert.strictEqual(toGrid(fromQStudio(reply("atom"))!.value), undefined);
  });
});
