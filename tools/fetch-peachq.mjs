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

// Downloads the peachq release pinned in .peachq-version into
// bin/peachq/<vsce target>/, verified against the release's sha256.
// `node tools/fetch-peachq.mjs` fetches the host's target, `--all` every
// bundled one, or name targets (linux-x64 linux-arm64 darwin-arm64 win32-x64).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "peachq-org/peachq";

export const ASSETS = {
  "linux-x64": "peachq-linux-x86_64.tar.gz",
  "linux-arm64": "peachq-linux-arm64.tar.gz",
  "darwin-arm64": "peachq-macos-arm64.tar.gz",
  "win32-x64": "peachq-windows-x86_64.zip",
};

export const version = () =>
  readFileSync(join(ROOT, ".peachq-version"), "utf8").trim();

export const binaryName = (target) =>
  target.startsWith("win32-") ? "q.exe" : "q";

export const targetDir = (target) => join(ROOT, "bin", "peachq", target);

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extract(archive, into) {
  const zip = archive.endsWith(".zip");
  const command =
    zip && process.platform !== "win32"
      ? ["unzip", ["-q", archive, "-d", into]]
      : ["tar", [zip ? "-xf" : "-xzf", archive, "-C", into]];
  const result = spawnSync(command[0], command[1], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command[0]} could not extract ${archive}`);
  }
}

export async function fetchTarget(target) {
  const asset = ASSETS[target];
  if (!asset) {
    throw new Error(`no peachq build for target ${target}`);
  }
  const tag = `v${version()}`;
  const dir = targetDir(target);
  const stamp = join(dir, "VERSION");
  const binary = join(dir, binaryName(target));
  if (
    existsSync(binary) &&
    existsSync(stamp) &&
    readFileSync(stamp, "utf8").startsWith(`${tag} `)
  ) {
    return binary;
  }

  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  const [archive, checksum] = await Promise.all([
    download(`${base}/${asset}`),
    download(`${base}/${asset}.sha256`),
  ]);
  const expected = checksum.toString("utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `${asset} ${tag}: sha256 ${actual} does not match the release's ${expected}`,
    );
  }

  const work = mkdtempSync(join(tmpdir(), "peachq-"));
  try {
    const file = join(work, asset);
    const unpacked = join(work, "unpacked");
    mkdirSync(unpacked);
    writeFileSync(file, archive);
    extract(file, unpacked);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const name of [binaryName(target), "LICENSE", "NOTICE"]) {
      copyFileSync(join(unpacked, name), join(dir, name));
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  writeFileSync(
    stamp,
    `${tag} ${asset} sha256:${actual}\nhttps://github.com/${REPO}/releases/tag/${tag}\n`,
  );
  console.log(`peachq ${tag} for ${target} -> ${binary}`);
  return binary;
}

export const hostTarget = () =>
  ASSETS[`${process.platform}-${process.arch}`]
    ? `${process.platform}-${process.arch}`
    : undefined;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const targets = args.includes("--all")
    ? Object.keys(ASSETS)
    : args.length
      ? args
      : [hostTarget()].filter(Boolean);
  if (!targets.length) {
    console.log(
      `No bundled peachq for ${process.platform}-${process.arch}; nothing fetched.`,
    );
  }
  try {
    for (const target of targets) {
      await fetchTarget(target);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
