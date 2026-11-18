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

// Raw wire payloads, so nulls and infinities stay exact: j p n are bigint, e f z numbers, c s latin1 strings.
export type QScalar = boolean | number | bigint | string;

export type QValue =
  | { kind: "atom"; type: number; value: QScalar }
  | { kind: "vector"; type: number; attr: number; items: QScalar[] }
  | { kind: "list"; attr: number; items: QValue[] }
  | { kind: "dict"; sorted: boolean; keys: QValue; values: QValue }
  | { kind: "table"; attr: number; names: string[]; columns: QValue[] }
  | { kind: "lambda"; context: string; source: string }
  | { kind: "primitive"; type: 101 | 102 | 103; code: number }
  | { kind: "projection"; fn: QValue; args: QValue[] }
  | { kind: "composition"; parts: QValue[] }
  | { kind: "derived"; fn: QValue; iterator: string }
  | { kind: "foreign"; type: number }
  | { kind: "error"; message: string };

export type QKind = QValue["kind"];
export type QOf<K extends QKind> = Extract<QValue, { kind: K }>;

export const TYPE_CHARS = " bg xhijefcspmdznuvt";

export const TYPE_NAMES = (
  " boolean guid  byte short int long real float char symbol timestamp month " +
  "date datetime timespan minute second time"
).split(" ");

export const ITERATORS = ["'", "/", "\\", "':", "/:", "\\:"];

const UNARY = (
  ":: +: -: *: %: &: |: ^: =: <: >: $: ,: #: _: ~: !: ?: @: .: 0:: 1:: " +
  "2:: avg last sum prd min max exit getenv abs sqrt log exp sin asin cos " +
  "acos tan atan enlist var dev hopen"
).split(" ");

const BINARY = (
  ": + - * % & | ^ = < > $ , # _ ~ ! ? @ . 0: 1: 2: in within like bin ss " +
  "insert wsum wavg div xexp setenv binr cov cor"
).split(" ");

export const PROJECTION_HOLE = 0xff;

export function primitiveName(p: QOf<"primitive">): string | undefined {
  if (p.type === 101 && p.code === PROJECTION_HOLE) {
    return "";
  }
  return (p.type === 101 ? UNARY : p.type === 102 ? BINARY : ITERATORS)[p.code];
}

export function isIdentity(v: QValue): boolean {
  return v.kind === "primitive" && v.type === 101 && v.code === 0;
}

export function isFunction(v: QValue): boolean {
  return (
    !isIdentity(v) &&
    (v.kind === "lambda" ||
      v.kind === "primitive" ||
      v.kind === "projection" ||
      v.kind === "composition" ||
      v.kind === "derived" ||
      v.kind === "foreign")
  );
}
