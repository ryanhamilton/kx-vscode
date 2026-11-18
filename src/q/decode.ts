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

import { ITERATORS, QScalar, QValue } from "./value";

class Reader {
  private view: DataView;
  private little: boolean;
  pos = 8;

  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    this.little = bytes[0] === 1;
  }

  byte() {
    return this.bytes[this.pos++];
  }

  int8() {
    return this.view.getInt8(this.pos++);
  }

  int16() {
    const v = this.view.getInt16(this.pos, this.little);
    this.pos += 2;
    return v;
  }

  int32() {
    const v = this.view.getInt32(this.pos, this.little);
    this.pos += 4;
    return v;
  }

  int64() {
    const v = this.view.getBigInt64(this.pos, this.little);
    this.pos += 8;
    return v;
  }

  float32() {
    const v = this.view.getFloat32(this.pos, this.little);
    this.pos += 4;
    return v;
  }

  float64() {
    const v = this.view.getFloat64(this.pos, this.little);
    this.pos += 8;
    return v;
  }

  latin1(n: number) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += String.fromCharCode(this.bytes[this.pos + i]);
    }
    this.pos += n;
    return s;
  }

  symbol() {
    const end = this.bytes.indexOf(0, this.pos);
    const s = this.latin1(end - this.pos);
    this.pos++;
    return s;
  }

  guid() {
    let s = "";
    for (let i = 0; i < 16; i++) {
      s +=
        (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
        this.byte().toString(16).padStart(2, "0");
    }
    return s;
  }

  scalar(type: number): QScalar {
    switch (type) {
      case 1:
        return this.byte() !== 0;
      case 2:
        return this.guid();
      case 4:
        return this.byte();
      case 5:
        return this.int16();
      case 7:
      case 12:
      case 16:
        return this.int64();
      case 8:
        return this.float32();
      case 9:
      case 15:
        return this.float64();
      case 10:
        return this.latin1(1);
      case 11:
        return this.symbol();
      case 6:
      case 13:
      case 14:
      case 17:
      case 18:
      case 19:
        return this.int32();
    }
    throw new Error(`q decode: type ${type} is not sent over IPC`);
  }

  value(): QValue {
    const t = this.int8();
    if (t < 0) {
      if (t === -128) {
        return { kind: "error", message: this.symbol() };
      }
      return { kind: "atom", type: -t, value: this.scalar(-t) };
    }
    if (t === 99 || t === 127) {
      return {
        kind: "dict",
        sorted: t === 127,
        keys: this.value(),
        values: this.value(),
      };
    }
    if (t >= 100) {
      return this.func(t);
    }
    const attr = this.byte();
    if (t === 98) {
      const d = this.value();
      if (
        d.kind !== "dict" ||
        d.keys.kind !== "vector" ||
        d.values.kind !== "list"
      ) {
        throw new Error("q decode: a table is not a dictionary of columns");
      }
      return {
        kind: "table",
        attr,
        names: d.keys.items as string[],
        columns: d.values.items,
      };
    }
    const n = this.int32();
    if (t === 0) {
      const items: QValue[] = [];
      for (let i = 0; i < n; i++) {
        items.push(this.value());
      }
      return { kind: "list", attr, items };
    }
    if (t === 10) {
      return { kind: "vector", type: t, attr, items: this.latin1(n).split("") };
    }
    const items: QScalar[] = [];
    for (let i = 0; i < n; i++) {
      items.push(this.scalar(t));
    }
    return { kind: "vector", type: t, attr, items };
  }

  func(t: number): QValue {
    if (t === 100) {
      const context = this.symbol();
      const body = this.value();
      return {
        kind: "lambda",
        context,
        source: body.kind === "vector" ? body.items.join("") : "",
      };
    }
    if (t <= 103) {
      return {
        kind: "primitive",
        type: t as 101 | 102 | 103,
        code: this.byte(),
      };
    }
    if (t === 104 || t === 105) {
      const parts: QValue[] = [];
      for (let n = this.int32(), i = 0; i < n; i++) {
        parts.push(this.value());
      }
      return t === 105
        ? { kind: "composition", parts }
        : { kind: "projection", fn: parts[0], args: parts.slice(1) };
    }
    if (t <= 111) {
      return {
        kind: "derived",
        fn: this.value(),
        iterator: ITERATORS[t - 106],
      };
    }
    this.value();
    return { kind: "foreign", type: t };
  }
}

function uncompress(b: Uint8Array, little: boolean): Uint8Array {
  const size = new DataView(b.buffer, b.byteOffset + 8, 4).getInt32(0, little);
  const dst = new Uint8Array(size);
  dst.set(b.subarray(0, 8));
  dst[2] = 0;
  const aa = new Int32Array(256);
  let n = 0,
    r = 0,
    f = 0,
    s = 8,
    p = 8,
    i = 0,
    d = 12;
  while (s < size) {
    if (i === 0) {
      f = b[d++];
      i = 1;
    }
    if (f & i) {
      r = aa[b[d++]];
      dst[s++] = dst[r++];
      dst[s++] = dst[r++];
      n = b[d++];
      for (let m = 0; m < n; m++) {
        dst[s + m] = dst[r + m];
      }
    } else {
      dst[s++] = b[d++];
    }
    while (p < s - 1) {
      aa[dst[p] ^ dst[p + 1]] = p++;
    }
    if (f & i) {
      p = s += n;
    }
    i = (i * 2) & 0xff;
  }
  return dst;
}

export function decode(message: Uint8Array): QValue {
  const bytes =
    message[2] === 1 ? uncompress(message, message[0] === 1) : message;
  return new Reader(bytes).value();
}
