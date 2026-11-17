#!/usr/bin/env node
// Builds dist/: one vsix per bundled target, carrying only that target's
// peachq, and a universal vsix with none. Builds artifacts only; publishes
// nothing.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSETS, binaryName, fetchTarget } from "./fetch-peachq.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const { name, version } = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
);
const ignore = readFileSync(join(ROOT, ".vscodeignore"), "utf8");

// The vsix is a zip: read its central directory for names and unix modes.
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
    entries.set(zip.toString("utf8", at + 46, at + 46 + nameLength), mode);
    at += 46 + nameLength + extra + comment;
  }
  return entries;
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
  const mode = entries.get(dir + binaryName(target));
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
