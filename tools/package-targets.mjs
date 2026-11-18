#!/usr/bin/env node

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

// Builds dist/: one vsix per bundled target, carrying only that target's
// peachq, and a universal vsix with none. Builds artifacts only; publishes
// nothing.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

import { ASSETS, binaryName, fetchTarget } from "./fetch-peachq.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const { name, publisher, version } = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
);
const ignore = readFileSync(join(ROOT, ".vscodeignore"), "utf8");

function readEntry(zip, central) {
  const local = zip.readUInt32LE(central + 42);
  const start =
    local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(start, start + zip.readUInt32LE(central + 20));
  return zip.readUInt16LE(central + 10) === 8 ? inflateRawSync(data) : data;
}

// The vsix is a zip: read its central directory for names, unix modes and
// a reader for each entry's data.
function listVsix(file) {
  const zip = readFileSync(file);
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${file} is not a zip`);
  const entries = new Map();
  let at = zip.readUInt32LE(end + 16);
  for (let left = zip.readUInt16LE(end + 10); left > 0; left--) {
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    const mode = zip.readUInt32LE(at + 38) >>> 16;
    entries.set(zip.toString("utf8", at + 46, at + 46 + nameLength), {
      mode,
      read: readEntry.bind(null, zip, at),
    });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

function checkIdentity(file, entries, target) {
  const manifest = entries.get("extension.vsixmanifest")?.read().toString();
  const identity = manifest?.match(/<Identity [^>]*>/)?.[0] ?? "";
  const want = {
    Id: name,
    Version: version,
    Publisher: publisher,
    TargetPlatform: target,
  };
  for (const [key, value] of Object.entries(want)) {
    const actual = identity.match(new RegExp(` ${key}="([^"]*)"`))?.[1];
    if (actual !== value) {
      throw new Error(`${file}: manifest ${key} is ${actual}, not ${value}`);
    }
  }
}

function vsce(out, target) {
  const ignoreFile = join(DIST, `.vscodeignore-${target ?? "universal"}`);
  const keep = target ? `!bin/peachq/${target}/**\n` : "";
  writeFileSync(ignoreFile, `${ignore.trimEnd()}\n${keep}`);
  const args = ["vsce", "package", "--ignoreFile", ignoreFile, "--out", out];
  if (target) args.push("--target", target);
  const result = spawnSync("npx", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  rmSync(ignoreFile);
  if (result.status !== 0) {
    throw new Error(`vsce package ${target ?? "(universal)"} failed`);
  }
}

function check(file, target) {
  const entries = listVsix(file);
  if (!entries.has("extension/NOTICE")) {
    throw new Error(`${file} does not carry NOTICE`);
  }
  checkIdentity(file, entries, target);
  const bundled = [...entries.keys()].filter((entry) =>
    entry.startsWith("extension/bin/"),
  );
  if (!target) {
    if (bundled.length) {
      throw new Error(`${file} carries ${bundled.join(", ")}`);
    }
    return;
  }
  const dir = `extension/bin/peachq/${target}/`;
  const expected = [binaryName(target), "LICENSE", "NOTICE", "VERSION"].map(
    (file) => dir + file,
  );
  const missing = expected.filter((entry) => !entries.has(entry));
  const stray = bundled.filter((entry) => !expected.includes(entry));
  if (missing.length || stray.length) {
    throw new Error(
      `${file}: missing [${missing.join(", ")}], unexpected [${stray.join(", ")}]`,
    );
  }
  const { mode } = entries.get(dir + binaryName(target));
  if (!target.startsWith("win32-") && !(mode & 0o111)) {
    throw new Error(`${file}: ${dir}q is not executable (mode ${mode})`);
  }
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
try {
  for (const target of [...Object.keys(ASSETS), undefined]) {
    if (target) await fetchTarget(target);
    const out = join(
      DIST,
      target ? `${name}-${target}-${version}.vsix` : `${name}-${version}.vsix`,
    );
    vsce(out, target);
    check(out, target);
    console.log(`ok ${out}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
