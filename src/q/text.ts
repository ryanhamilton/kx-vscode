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

import {
  isFunction,
  isIdentity,
  primitiveName,
  QOf,
  QScalar,
  QValue,
  TYPE_CHARS,
  TYPE_NAMES,
} from "./value";

const MAX_LINE_CHARS = 200_000;
const CLIP_SLACK = 64;
const PRECISION = 7;
const ALIGNABLE = "hijefscdtpuvnz";
const MAX_GRID_COLUMNS = 64;
const INT_MAX = 2147483647;
const LONG_MAX = 9223372036854775807n;
const NS_PER_DAY = 86400000000000n;
const MS_PER_DAY = 86400000;
const MS_2000 = Date.UTC(2000, 0, 1);

type List = QOf<"list">;
type Vector = QOf<"vector">;
type Atom = QOf<"atom">;
type Table = QOf<"table">;
type Seq = List | Vector;

class Buf {
  s = "";
}

const isList = (v: QValue): v is List => v.kind === "list";
const isVector = (v: QValue): v is Vector => v.kind === "vector";
const isSeq = (v: QValue): v is Seq => isList(v) || isVector(v);
const isAtom = (v: QValue): v is Atom => v.kind === "atom";
const isChar = (v: QValue) => isAtom(v) && v.type === 10;
const isString = (v: QValue): v is Vector => isVector(v) && v.type === 10;
const isSymbol = (v: QValue) => isAtom(v) && v.type === 11;
const len = (v: Seq) => v.items.length;
const typeChar = (type: number) => TYPE_CHARS[type];

function item(v: Seq, i: number): QValue {
  return isList(v)
    ? v.items[i]
    : { kind: "atom", type: v.type, value: v.items[i] };
}

function count(v: QValue): number {
  if (v.kind === "table") {
    return v.columns.length === 0 ? 0 : count(v.columns[0]);
  }
  return isSeq(v) ? len(v) : 1;
}

const pad = (s: string, w: number) => s.padEnd(w);
const rtrim = (s: string) => s.replace(/ +$/, "");
export const utf8 = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));

class QText {
  constructor(
    private rows: number,
    readonly cols: number,
    private maxElementLength: number,
  ) {}

  clip(body: string): string {
    const lines = body.split("\n");
    const shown =
      lines.length - 1 >= this.rows - 2 ? this.rows - 3 : lines.length;
    const out = lines.slice(0, Math.max(shown, 0)).map((l) => this.cut(l));
    if (shown < lines.length) {
      out.push("..");
    }
    return out.join("\n");
  }

  cut(l: string): string {
    return l.length > this.cols - 1 ? l.slice(0, this.cols - 3) + ".." : l;
  }

  krepr(o: QValue): string {
    const sb = new Buf();
    this.kreprTo(o, sb);
    return sb.s.length > this.maxElementLength
      ? sb.s.slice(0, this.maxElementLength) + ".."
      : sb.s;
  }

  full(sb: Buf) {
    return sb.s.length > this.maxElementLength;
  }

  kreprTo(o: QValue, sb: Buf) {
    if (isString(o)) {
      sb.s += len(o) === 1 ? "," : "";
      this.quote(sb, o.items as string[]);
    } else if (o.kind === "table") {
      sb.s += "+";
      this.kreprDict(tableKeys(o), tableValues(o), sb);
    } else if (o.kind === "dict") {
      this.kreprDict(collapse(o.keys), collapse(o.values), sb);
    } else if (isList(o)) {
      const a = o.items;
      if (a.length === 0) {
        sb.s += "()";
      } else if (a.length === 1) {
        sb.s += ",";
        this.kreprTo(a[0], sb);
      } else {
        sb.s += "(";
        for (let i = 0; i < a.length && !this.full(sb); i++) {
          sb.s += i === 0 ? "" : ";";
          this.kreprTo(a[i], sb);
        }
        sb.s += ")";
      }
    } else {
      this.renderTo(o, sb);
    }
  }

  kreprDict(keys: QValue, vals: QValue, sb: Buf) {
    const kb = new Buf();
    this.kreprTo(keys, kb);
    const k = kb.s;
    const brackets = k.startsWith(",") || k.startsWith("+") || k.includes("$");
    sb.s += (brackets ? "(" + k + ")" : k) + "!";
    this.kreprTo(vals, sb);
  }

  render(o: QValue): string {
    const sb = new Buf();
    this.renderTo(o, sb);
    return sb.s;
  }

  renderTo(o: QValue, sb: Buf) {
    if (isVector(o) && o.attr > 0 && o.attr < 5) {
      sb.s += "`" + " supg"[o.attr] + "#";
    }
    this.body(o, sb);
  }

  body(o: QValue, sb: Buf) {
    if (isIdentity(o)) {
      sb.s += "::";
    } else if (isFunction(o)) {
      this.func(o, sb);
    } else if (isChar(o)) {
      this.quote(sb, [(o as Atom).value as string]);
    } else if (isString(o)) {
      sb.s += len(o) === 1 ? "," : "";
      this.quote(sb, o.items as string[]);
    } else if (isSymbol(o)) {
      sb.s += "`" + (o as Atom).value;
    } else if (isVector(o)) {
      this.vector(o, sb);
    } else if (isAtom(o)) {
      sb.s += atom(o, true);
    } else if (o.kind === "table") {
      if (o.names.length === 0) {
        sb.s += "+`!()";
      } else {
        this.grid(o, undefined, sb);
      }
    } else if (o.kind === "dict") {
      const sides = [o.keys, o.values];
      if (
        sides.some((s) => s.kind === "table") &&
        sides.every((s) => s.kind === "table" || isSeq(s))
      ) {
        this.grid(o.keys, o.values, sb);
      } else {
        this.dict(o, sb);
      }
    } else if (isList(o)) {
      this.list(o.items, sb);
    } else if (o.kind === "error") {
      sb.s += "'" + o.message;
    }
  }

  func(f: QValue, sb: Buf) {
    switch (f.kind) {
      case "lambda":
        sb.s += f.source;
        break;
      case "primitive":
        sb.s += primitiveName(f) ?? "func";
        break;
      case "projection":
        this.renderTo(f.fn, sb);
        sb.s += "[";
        f.args.forEach((a, i) => {
          sb.s += i === 0 ? "" : ";";
          if (isFunction(a)) {
            this.renderTo(a, sb);
          } else {
            this.kreprTo(a, sb);
          }
        });
        sb.s += "]";
        break;
      case "composition":
        for (const part of f.parts) {
          const name =
            part.kind === "primitive" &&
            !isIdentity(part) &&
            primitiveName(part);
          if (name) {
            const unary = (part as QOf<"primitive">).type === 101;
            sb.s +=
              unary && name.length > 1 && name.endsWith(":")
                ? name.slice(0, -1)
                : name;
          } else {
            this.renderTo(part, sb);
          }
        }
        break;
      case "derived":
        this.renderTo(f.fn, sb);
        sb.s += f.iterator;
        break;
    }
  }

  list(e: QValue[], sb: Buf) {
    const n = e.length;
    if (n === 0) {
      sb.s += "()";
    } else if (isMatrix(e)) {
      this.matrix(e, sb);
    } else if (n === 1 && showsNothing(e[0])) {
      return;
    } else if (n === 1 && isIdentity(e[0])) {
      sb.s += "::";
    } else if (
      n === 1 &&
      !isString(e[0]) &&
      !isFunction(e[0]) &&
      !(isVector(e[0]) && len(e[0]) === 0)
    ) {
      sb.s += "," + this.listItem(e[0]);
    } else {
      for (let i = 0; i < Math.min(n, this.rows); i++) {
        sb.s += (i === 0 ? "" : "\n") + this.listItem(e[i]);
      }
    }
  }

  listItem(o: QValue): string {
    return isFunction(o) ? this.render(o) : this.krepr(o);
  }

  dict(d: QOf<"dict">, sb: Buf) {
    const k = d.keys;
    const v = d.values;
    if (!isSeq(k) || !isSeq(v)) {
      this.kreprTo(d, sb);
      return;
    }
    const n = len(k);
    const shown = Math.min(n, this.rows);
    const keys: string[] = [];
    for (let i = 0; i < shown; i++) {
      keys.push(this.dictElement(k, item(k, i)));
    }
    const maxk = keys.reduce((w, s) => Math.max(w, s.length), 0);
    let widths: number[] | undefined;
    if (isList(v) && len(v) === n && isMatrix(v.items)) {
      widths = this.matrixWidths(
        v.items,
        shown,
        len(v.items[0] as Seq),
        true,
        this.cols === 0 ? 0 : this.cols + CLIP_SLACK,
      );
    } else if (isList(v) && len(v) === n && n > 0 && allEmptyLists(v.items)) {
      widths = [];
    }
    for (let i = 0; i < shown; i++) {
      let val: string;
      if (widths) {
        val =
          widths.length === 0
            ? ""
            : this.matrixRow((v as List).items[i], widths);
      } else {
        const ve = item(v, i);
        val = isFunction(ve) ? this.render(ve) : this.dictElement(v, ve);
      }
      sb.s += (i === 0 ? "" : "\n") + pad(keys[i], maxk) + "| " + val;
    }
  }

  dictElement(col: Seq, e: QValue): string {
    if (colUniformType(col)) {
      if (isChar(e)) {
        return escape((e as Atom).value as string);
      }
      const tok = atom(e, false);
      if (tok !== undefined) {
        return tok;
      }
    }
    return this.elementInline(e);
  }

  grid(keySide: QValue, valueSide: QValue | undefined, sb: Buf) {
    const nr = valueSide
      ? Math.min(count(keySide), count(valueSide))
      : count(keySide);
    const shown = Math.min(nr, this.rows);
    const sides = [keySide, valueSide]
      .filter((s): s is QValue => !!s)
      .map((s) => new Grid(this, s, shown));
    const line = (f: (g: Grid) => string) => sides.map(f).join("| ");
    sb.s += line((g) => g.header()) + "\n" + line((g) => g.rule());
    for (let r = 0; r < shown; r++) {
      sb.s += "\n" + line((g) => g.row(r));
    }
  }

  cellText(col: Seq, row: number, blankNull: boolean): string {
    if (isString(col)) {
      return col.items[row] === "\0" ? " " : (col.items[row] as string);
    }
    const e = item(col, row);
    if (blankNull && isList(e) && len(e) === 0) {
      return "";
    }
    if (blankNull && !isSymbol(e) && isNullAtom(e)) {
      return "";
    }
    if (colUniformType(col)) {
      const tok = atom(e, false);
      if (tok !== undefined) {
        return tok;
      }
    }
    const s = this.elementInline(e);
    return s.startsWith(",") && colUniformSingleton(col) ? s.slice(1) : s;
  }

  elementInline(e: QValue): string {
    return isIdentity(e) || isAtom(e) ? this.render(e) : this.krepr(e);
  }

  matrixCell(row: QValue, c: number, bare: boolean, blankNull: boolean) {
    if (isVector(row)) {
      return this.cellText(row, c, blankNull);
    }
    const a = (row as List).items[c];
    if (isSymbol(a)) {
      return (bare ? "" : "`") + (a as Atom).value;
    } else if (isChar(a)) {
      return quoted([(a as Atom).value as string]);
    } else if (isString(a)) {
      return (len(a) === 1 ? "," : "") + quoted(a.items as string[]);
    }
    return this.elementInline(a);
  }

  matrixWidths(
    e: QValue[],
    nr: number,
    nc: number,
    blankNull: boolean,
    lim: number,
  ): number[] {
    const cap = lim > 0 && lim < nc ? lim : nc;
    const w: number[] = [];
    for (let c = 0, start = 0; c < cap && (lim === 0 || start < lim); c++) {
      w.push(0);
      for (let r = 0; r < nr; r++) {
        const cell = this.matrixCell(e[r], c, rowAllSym(e[r]), blankNull);
        w[c] = Math.max(w[c], cell.length);
      }
      start += w[c] + 1;
    }
    return w;
  }

  matrixRow(row: QValue, widths: number[]): string {
    const bare = rowAllSym(row);
    return rtrim(
      widths
        .map((w, c) => pad(this.matrixCell(row, c, bare, true), w))
        .join(" "),
    );
  }

  matrix(e: QValue[], sb: Buf) {
    const nr = Math.min(e.length, this.rows);
    const nc = len(e[0] as Seq);
    const widths = this.matrixWidths(e, nr, nc, false, this.cols);
    for (let r = 0; r < nr; r++) {
      const bare = rowAllSym(e[r]);
      let line = widths
        .map((w, c) => pad(this.matrixCell(e[r], c, bare, false), w))
        .join(" ");
      for (let c = widths.length; c < nc; c++) {
        const s = this.matrixCell(e[r], c, bare, false);
        if (s.trim() !== "") {
          line += " " + s;
          break;
        }
      }
      sb.s += (r === 0 ? "" : "\n") + rtrim(line);
    }
  }

  vector(v: Vector, sb: Buf) {
    const t = typeChar(v.type);
    const n = len(v);
    if (n === 0) {
      sb.s += "`" + TYPE_NAMES[v.type] + "$()";
      return;
    }
    sb.s += n === 1 ? "," : "";
    if (t === "b") {
      for (let i = 0; i < n && !this.full(sb); i++) {
        sb.s += v.items[i] ? "1" : "0";
      }
      sb.s += "b";
    } else if (t === "x") {
      sb.s += "0x";
      for (let i = 0; i < n && !this.full(sb); i++) {
        sb.s += hex2(v.items[i] as number);
      }
    } else if (t === "s") {
      for (let i = 0; i < n && !this.full(sb); i++) {
        sb.s += "`" + v.items[i];
      }
    } else if (t === "e" || t === "f") {
      let allWhole = true;
      for (let i = 0; i < n && !this.full(sb); i++) {
        let tok = floatToken(v.items[i] as number, t === "e");
        if (t === "e") {
          tok = tok.slice(0, -1);
        }
        allWhole &&= isBareInt(tok);
        sb.s += (i === 0 ? "" : " ") + tok;
      }
      sb.s += t === "e" ? "e" : allWhole ? "f" : "";
    } else {
      let allSentinel = true;
      for (let i = 0; i < n && !this.full(sb); i++) {
        const s = sentinel(v.type, v.items[i]);
        allSentinel &&= s !== undefined;
        sb.s += (i === 0 ? "" : " ") + (s ?? payload(v.type, v.items[i]));
      }
      if ("him".includes(t) || (allSentinel && "dtpuvnz".includes(t))) {
        sb.s += t;
      }
    }
  }

  quote(sb: Buf, chars: string[]) {
    sb.s += '"';
    for (let i = 0; i < chars.length && !this.full(sb); i++) {
      sb.s += escape(chars[i]);
    }
    sb.s += '"';
  }
}

class Grid {
  names: string[];
  columns: QValue[];
  widths: number[] = [];
  cells: string[][] = [];

  constructor(q: QText, side: QValue, shownRows: number) {
    if (side.kind === "table") {
      this.names = side.names.slice(0, MAX_GRID_COLUMNS);
      this.columns = side.columns.slice(0, MAX_GRID_COLUMNS);
    } else {
      this.names = [""];
      this.columns = [side];
    }
    this.columns.forEach((column, c) => {
      const col = column as Seq;
      const mw =
        isList(col) &&
        len(col) > 0 &&
        col.items.every(isVector) &&
        isMatrix(col.items)
          ? q.matrixWidths(
              col.items,
              shownRows,
              len(col.items[0] as Seq),
              true,
              q.cols === 0 ? 0 : q.cols + CLIP_SLACK,
            )
          : undefined;
      this.cells[c] = [];
      for (let r = 0; r < shownRows; r++) {
        this.cells[c].push(
          mw
            ? q.matrixRow(col.items[r] as QValue, mw)
            : q.cellText(col, r, true),
        );
      }
      this.widths[c] = this.cells[c].reduce(
        (w, s) => Math.max(w, s.length),
        this.names[c].length,
      );
    });
  }

  cell(c: number, r: number): string {
    return this.cells[c][r];
  }

  header() {
    return this.names.map((n, c) => pad(n, this.widths[c])).join(" ");
  }

  rule() {
    const total =
      this.names.length - 1 + this.widths.reduce((a, b) => a + b, 0);
    return "-".repeat(total);
  }

  row(r: number) {
    return this.names
      .map((_, c) => pad(this.cell(c, r), this.widths[c]))
      .join(" ");
  }
}

function tableKeys(t: Table): QValue {
  return { kind: "vector", type: 11, attr: 0, items: t.names };
}

function tableValues(t: Table): QValue {
  return { kind: "list", attr: 0, items: t.columns };
}

function collapse(o: QValue): QValue {
  if (!isList(o) || !colUniformType(o)) {
    return o;
  }
  return {
    kind: "vector",
    type: (o.items[0] as Atom).type,
    attr: 0,
    items: o.items.map((e) => (e as Atom).value),
  };
}

function isParseTree(k: QValue, depth = 0): boolean {
  if (!isList(k) || len(k) === 0 || depth > 64) {
    return false;
  }
  const h = k.items[0];
  return (
    (h.kind === "primitive" && !isIdentity(h) && h.type !== 103) ||
    isParseTree(h, depth + 1)
  );
}

function showsNothing(v: QValue): boolean {
  while (isList(v) && len(v) === 1) {
    v = v.items[0];
  }
  return isList(v) && len(v) === 0;
}

function allEmptyLists(v: QValue[]): boolean {
  return v.every((o) => isList(o) && len(o) === 0);
}

const uniformity = new WeakMap<Seq, { type: boolean; singleton: boolean }>();

function uniform(col: Seq) {
  let u = uniformity.get(col);
  if (!u) {
    const items = (col as List).items;
    const n = items.length;
    u = {
      type:
        isVector(col) ||
        (n > 0 &&
          items.every(
            (o) => isAtom(o) && isAtom(items[0]) && o.type === items[0].type,
          )),
      singleton:
        isList(col) && n > 0 && items.every((o) => isSeq(o) && len(o) === 1),
    };
    uniformity.set(col, u);
  }
  return u;
}

const colUniformType = (col: Seq) => uniform(col).type;
const colUniformSingleton = (col: Seq) => uniform(col).singleton;

function isMatrix(e: QValue[]): boolean {
  const n = e.length;
  const general = e.some(isList);
  if (n < 1 || !matrixRowOk(e[0], general)) {
    return false;
  }
  const w = len(e[0] as Seq);
  if (w === 0) {
    return false;
  }
  if (n === 1 && isList(e[0])) {
    if (!e[0].items.every((x) => isAtom(x) || isString(x))) {
      return false;
    }
  }
  let allChars = isString(e[0]);
  for (let i = 1; i < n; i++) {
    if (!matrixRowOk(e[i], general) || len(e[i] as Seq) !== w) {
      return false;
    }
    allChars &&= isString(e[i]);
  }
  return !allChars;
}

// kdb aligns rows that mix atoms and lists, and boolean rows beside general ones: qdocs basics/atomic.md:93,
// basics/implicit-iteration.md:117, ref/vs.md:197.
function matrixRowOk(r: QValue, general: boolean): boolean {
  if (isVector(r)) {
    return (general ? "bx" + ALIGNABLE : ALIGNABLE).includes(typeChar(r.type));
  }
  return (
    isList(r) &&
    r.items.every(
      (o) => !isIdentity(o) && (isSeq(o) || isAtom(o) || isFunction(o)),
    )
  );
}

function rowAllSym(v: QValue): boolean {
  if (isVector(v)) {
    return v.type === 11;
  }
  return isList(v) && len(v) > 0 && v.items.every(isSymbol);
}

function atom(a: QValue, suffixed: boolean): string | undefined {
  if (!isAtom(a)) {
    return undefined;
  }
  const t = typeChar(a.type);
  const v = a.value;
  switch (t) {
    case "b":
      return (v ? "1" : "0") + (suffixed ? "b" : "");
    case "x":
      return "0x" + hex2(v as number);
    case "g":
    case "s":
      return v as string;
    case "h":
      return (v === -32768 ? "0N" : String(v)) + (suffixed ? "h" : "");
    case "i":
    case "j":
      return (
        (sentinel(a.type, v) ?? String(v)) + (suffixed && t === "i" ? "i" : "")
      );
    case "e": {
      const tok = floatToken(v as number, true);
      return !suffixed && Number.isFinite(v) ? tok.slice(0, -1) : tok;
    }
    case "f": {
      const tok = floatToken(v as number, false);
      return suffixed && isBareInt(tok) ? tok + "f" : tok;
    }
    case "c":
      return undefined;
  }
  const s = sentinel(a.type, v);
  const tok = s ?? payload(a.type, v);
  return tok + ((t === "m" ? suffixed : s !== undefined) ? t : "");
}

function sentinel(type: number, v: QScalar): string | undefined {
  const t = typeChar(type);
  if (t === "h") {
    return v === -32768 ? "0N" : undefined;
  }
  if (t === "z") {
    const f = v as number;
    return Number.isNaN(f)
      ? "0N"
      : f === Infinity
        ? "0w"
        : f === -Infinity
          ? "-0w"
          : undefined;
  }
  if ("jpn".includes(t)) {
    const j = v as bigint;
    return j === -LONG_MAX - 1n
      ? "0N"
      : j === LONG_MAX
        ? "0W"
        : j === -LONG_MAX
          ? "-0W"
          : undefined;
  }
  if ("imduvt".includes(t)) {
    return v === -INT_MAX - 1
      ? "0N"
      : v === INT_MAX
        ? "0W"
        : v === -INT_MAX
          ? "-0W"
          : undefined;
  }
  return undefined;
}

function isNullAtom(a: QValue): boolean {
  if (!isAtom(a)) {
    return false;
  }
  if (a.type === 8 || a.type === 9) {
    return Number.isNaN(a.value);
  }
  if (a.type === 2) {
    return /^[0-]+$/.test(a.value as string);
  }
  return sentinel(a.type, a.value) === "0N";
}

const d2 = (n: number | bigint) => String(n).padStart(2, "0");
const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function ymd(days: number, sep = "."): string {
  if (days < -730119 || days > 2921939) {
    return "0000.00.00";
  }
  const d = new Date(MS_2000 + days * MS_PER_DAY);
  return (
    String(d.getUTCFullYear()).padStart(4, "0") +
    sep +
    d2(d.getUTCMonth() + 1) +
    sep +
    d2(d.getUTCDate())
  );
}

function clock(ms: number, withMs: boolean): string {
  const s = Math.floor(ms / 1000);
  return (
    d2(Math.floor(s / 3600)) +
    ":" +
    d2(Math.floor(s / 60) % 60) +
    ":" +
    d2(s % 60) +
    (withMs ? "." + String(ms % 1000).padStart(3, "0") : "")
  );
}

function nanoClock(ns: bigint): string {
  const s = ns / 1000000000n;
  return (
    d2(s / 3600n) +
    ":" +
    d2((s / 60n) % 60n) +
    ":" +
    d2(s % 60n) +
    "." +
    String(ns % 1000000000n).padStart(9, "0")
  );
}

function payload(type: number, a: QScalar): string {
  switch (typeChar(type)) {
    case "d":
      return ymd(a as number);
    case "m": {
      const p = a as number;
      const y = 2000 + Math.floor(p / 12);
      return y < 0 || y > 9999
        ? "0000.00"
        : String(y).padStart(4, "0") + "." + d2(1 + (((p % 12) + 12) % 12));
    }
    case "z": {
      const ms = Math.round((a as number) * MS_PER_DAY);
      const days = Math.floor(ms / MS_PER_DAY);
      const date = ymd(days);
      return date === "0000.00.00"
        ? "0000.00.00T00:00:00.000"
        : date + "T" + clock(ms - days * MS_PER_DAY, true);
    }
    case "p": {
      const j = a as bigint;
      const days =
        j < 0n ? -((-j + NS_PER_DAY - 1n) / NS_PER_DAY) : j / NS_PER_DAY;
      return ymd(Number(days)) + "D" + nanoClock(j - days * NS_PER_DAY);
    }
    case "n": {
      const j = a as bigint;
      const x = j < 0n ? -j : j;
      return (
        (j < 0n ? "-" : "") +
        String(x / NS_PER_DAY) +
        "D" +
        nanoClock(x % NS_PER_DAY)
      );
    }
    case "u": {
      const v = a as number;
      const x = Math.abs(v);
      return x >= 6000
        ? "**:" + d2(x % 60)
        : (v < 0 ? "-" : "") + d2(Math.floor(x / 60)) + ":" + d2(x % 60);
    }
    case "v": {
      const v = a as number;
      return (v < 0 ? "-" : "") + clock(Math.abs(v) * 1000, false);
    }
    case "t": {
      const v = a as number;
      return (v < 0 ? "-" : "") + clock(Math.abs(v), true);
    }
  }
  return String(a);
}

function floatToken(v: number, isReal: boolean): string {
  const e = isReal ? "e" : "";
  if (Object.is(v, -0)) {
    return "-0" + e;
  } else if (Number.isNaN(v)) {
    return isReal ? "0Ne" : "0n";
  } else if (!Number.isFinite(v)) {
    return (v < 0 ? "-0w" : "0w") + e;
  } else if (Number.isInteger(v) && Math.abs(v) < 1e7) {
    return String(v) + e;
  }
  return formatG(v, PRECISION) + e;
}

function formatG(v: number, precision: number): string {
  let [digits, exp] = roundedDigits(Math.abs(v), precision);
  const sign = v < 0 ? "-" : "";
  if (exp < -4 || exp >= precision) {
    const mantissa = stripZeros(digits[0] + "." + digits.slice(1));
    const x = Math.abs(exp);
    return sign + mantissa + "e" + (exp < 0 ? "-" : "+") + d2(x);
  }
  if (exp < 0) {
    digits = "0".repeat(-exp) + digits;
    exp = 0;
  }
  return (
    sign + stripZeros(digits.slice(0, exp + 1) + "." + digits.slice(exp + 1))
  );
}

// C's %g rounds the exact binary value half to even; toExponential rounds ties up, so exact ties go the slow way.
function roundedDigits(v: number, precision: number): [string, number] {
  const wide = v.toExponential(20);
  const rest = wide.slice(precision + 1, 22);
  const tie = /^50*$/.test(rest);
  const s = tie
    ? exactExponential(v, precision)
    : v.toExponential(precision - 1);
  const [m, x] = s.split("e");
  return [m.replace(".", ""), Number(x)];
}

function exactExponential(v: number, precision: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, v);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  const m = biased === 0 ? frac : frac | (1n << 52n);
  const e = biased === 0 ? -1074 : biased - 1075;
  const digits =
    e >= 0 ? (m << BigInt(e)).toString() : (m * 5n ** BigInt(-e)).toString();
  const exp = digits.length - 1 + Math.min(e, 0);
  const exact = digits.padEnd(precision, "0");
  let keep = BigInt(exact.slice(0, precision));
  const rest = exact.slice(precision);
  const up =
    rest[0] > "5" ||
    (rest[0] === "5" && (/[1-9]/.test(rest.slice(1)) || keep % 2n === 1n));
  keep += up ? 1n : 0n;
  const k = keep.toString();
  const shift = k.length > precision ? 1 : 0;
  return k[0] + "." + k.slice(1, precision) + "e" + (exp + shift);
}

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function isBareInt(tok: string): boolean {
  return /^-?\d+$/.test(tok);
}

function quoted(chars: string[]): string {
  return '"' + chars.map(escape).join("") + '"';
}

function escape(ch: string): string {
  switch (ch) {
    case '"':
      return '\\"';
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\t":
      return "\\t";
    case "\r":
      return "\\r";
  }
  const c = ch.charCodeAt(0);
  return c >= 32 && c <= 126 ? ch : "\\" + c.toString(8).padStart(3, "0");
}

export function toConsole(v: QValue, width = 80, height = 25): string {
  if (isIdentity(v) || (isList(v) && len(v) === 0)) {
    return "";
  }
  const q = new QText(height, width, width + CLIP_SLACK);
  const body = q.render(v);
  return utf8((isParseTree(v) ? body : q.clip(body)) + "\n");
}

export function toOneLine(v: QValue, width = 80): string {
  const s = new QText(Number.MAX_SAFE_INTEGER, 0, MAX_LINE_CHARS).krepr(v);
  return utf8(
    width > 0 && s.length > width - 1 ? s.slice(0, width - 3) + ".." : s,
  );
}

export function toCells(column: QValue, width = 0): string[] {
  if (!isSeq(column)) {
    return [toOneLine(column, width)];
  }
  const q = new QText(
    Number.MAX_SAFE_INTEGER,
    width,
    width ? width + CLIP_SLACK : MAX_LINE_CHARS,
  );
  const g = new Grid(q, column, len(column));
  return column.items.map((_, r) =>
    utf8(width ? q.cut(g.cell(0, r)) : g.cell(0, r)),
  );
}

export function toCell(v: QValue, width = 0): string {
  const column: QValue = isAtom(v)
    ? { kind: "vector", type: v.type, attr: 0, items: [v.value] }
    : { kind: "list", attr: 0, items: [v] };
  return toCells(column, width)[0];
}
