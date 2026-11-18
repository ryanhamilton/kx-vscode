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

import { toCells, toConsole, utf8 } from "./text";
import { QOf, QValue, TYPE_NAMES } from "./value";
import {
  StructuredTextColumns,
  StructuredTextResults,
} from "../models/queryResult";

// qStudio QueryManager.java:276-278 byte for byte; some sites detect it.
export const QSTUDIO_WRAPPER =
  '{v:$[`trp in key .Q; .Q.trp[{( (1b;`) ;value x)};x;{((0b;`);x;$[4<count y; .Q.sbt -4 _ y; ""])}]; ((1b;`);value x)]; a:10485760j>@[-22!;v;{0}]; (a;$[a;v;0b];.Q.s v 1)} "';

export function qstudioEscape(query: string): string {
  return query
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

export function qstudioWrap(query: string): string {
  return QSTUDIO_WRAPPER + qstudioEscape(query) + '"';
}

export interface TypedReply {
  console: string;
  value?: QValue;
  tooLarge?: boolean;
  error?: string;
}

export function isTypedReply(result: unknown): result is TypedReply {
  return (
    typeof result === "object" &&
    result !== null &&
    typeof (result as TypedReply).console === "string"
  );
}

const text = (v: QValue | undefined) =>
  v?.kind === "vector" && v.type === 10 ? utf8(v.items.join("")) : undefined;

const isTrue = (v: QValue | undefined) =>
  v?.kind === "atom" && v.type === 1 && v.value === true;

export function fromQStudio(reply: QValue): TypedReply | undefined {
  if (reply.kind === "error") {
    return { console: "", error: reply.message };
  }
  if (reply.kind !== "list" || reply.items.length !== 3) {
    return undefined;
  }
  const [sizeOk, body, shown] = reply.items;
  const console = text(shown);
  if (sizeOk.kind !== "atom" || sizeOk.type !== 1 || console === undefined) {
    return undefined;
  }
  if (!sizeOk.value) {
    return { console, tooLarge: true };
  }
  const [status, result, trace] = body.kind === "list" ? body.items : [];
  if (status?.kind !== "list") {
    return undefined;
  }
  if (isTrue(status.items[0])) {
    return { console, value: result };
  }
  const message = text(result) ?? "";
  const stack = text(trace);
  return { console, error: stack ? `${message}\n${stack}` : message };
}

export function fromNaked(reply: QValue): TypedReply {
  return reply.kind === "error"
    ? { console: "", error: reply.message }
    : { console: toConsole(reply), value: reply };
}

function typeName(v: QValue): string {
  if (v.kind !== "vector") {
    return "general";
  }
  return v.type >= 20 ? "enum" : `${TYPE_NAMES[v.type]}s`;
}

function column(name: string, v: QValue, isKey: boolean) {
  const values = toCells(v);
  const shaped: StructuredTextColumns = {
    name,
    type: typeName(v),
    values,
    order: [],
  };
  return isKey ? { ...shaped, isKey } : shaped;
}

function columns(v: QOf<"table">, isKey: boolean) {
  return v.names.map((name, i) => column(name, v.columns[i], isKey));
}

export function toGrid(
  v: QValue | undefined,
): StructuredTextResults | undefined {
  let shaped: StructuredTextColumns[];
  if (v?.kind === "table") {
    shaped = columns(v, false);
  } else if (v?.kind === "dict") {
    shaped =
      v.keys.kind === "table" && v.values.kind === "table"
        ? [...columns(v.keys, true), ...columns(v.values, false)]
        : [column("key", v.keys, true), column("values", v.values, false)];
  } else {
    return undefined;
  }
  return { count: shaped[0]?.values.length ?? 0, columns: shaped };
}
