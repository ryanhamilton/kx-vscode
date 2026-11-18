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

// Renames the extension's public edges from KX.kdb to timestored.peachq.
// Run from anywhere: `node tools/rebrand.mjs` rewrites in place,
// `--check` only reports and exits 1 if anything would change.
// See docs/developer/upstream.md for the upstream merge workflow.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import * as prettier from "prettier";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = [
  "package.json",
  "README.md",
  "src",
  "server/src",
  "test",
  "test/e2e/workspace/fakeq/bin/q",
  "docs",
];
const EXTENSIONS = [".ts", ".mts", ".json", ".md", ".html"];
const SKIP_DIRS = new Set(["node_modules", "out", "out-test", ".vscode-test"]);

// Files that must keep naming the KX extension: compatibility code and fixtures.
const EXCLUDE = [
  "src/utils/kxCompat.ts",
  "test/suite/utils/kxCompat.test.ts",
  "test/suite/rebrand.test.ts",
  "test/e2e/kx.test.ts",
  "test/e2e/fakekx/",
  "docs/developer/upstream.md",
  "docs/developer/decisions.md",
];

// `kdb.<namespace>.` ids: commands, LSP requests, context-key families.
const NAMESPACES = [
  "connections",
  "datasource",
  "execute",
  "file",
  "help",
  "install",
  "ls",
  "notebook",
  "qls",
  "query",
  "queryHistory",
  "repl",
  "results",
  "resultsPanel",
  "scratchpad",
  "show",
];

// `kdb.<id>` leaves: settings, context keys, custom editors, commands.
const IDS = [
  "autoFocusOutputOnEntry",
  "chartEditor",
  "connected",
  "connectionLabels",
  "connectionLabelsMap",
  "connectionMap",
  "createNotebook",
  "dataSourceConverter",
  "dataSourceEditor",
  "defaultTimeout",
  "e2eWebview",
  "hideDetailedConsoleQueryOutput",
  "hideInstallationNotification",
  "hideSourceExpressions",
  "insights",
  "insightsEnterpriseConnections",
  "insightsNodes",
  "kdbNodesWithoutAuth",
  "kdbNodesWithoutTls",
  "kdbQHCopyList",
  "kdbQueryHistoryList",
  "kdbQuickNodes",
  "labelsConnectionMap",
  "linting",
  "local",
  "neverShowQInstallAgain",
  "notebookOnRepl",
  "notebookRowLimit",
  "notebookRowLimitFrom",
  "notebookRowLimitFromValue",
  "notebookRowLimitValue",
  "pythonEnabled",
  "qHomeDirectory",
  "qHomeDirectoryWorkspace",
  "QHOME",
  "queryEditor",
  "refactoring",
  "rootNodes",
  "selectContentNodesContext",
  "servers",
  "showResultsInView",
  "targetMap",
  "timeoutMap",
  "toggleParameterCache",
];

// `kdb-<id>` views, containers and the telemetry output channel.
const DASHED = [
  "datasource-explorer",
  "explorer",
  "help-feedback-view",
  "query-explorer",
  "query-history",
  "results",
  "scratchpad-explorer",
  "servers",
  "telemetry",
];

const LANGUAGES = {
  kxquery: "peachqquery",
  kdbplot: "peachqplot",
  kxnotebook: "peachqnotebook",
};

const alt = (list) => list.join("|");

// Each rule: [pattern, replacement]; `kdb\.` in a regex literal counts too.
// `(?<![\w.$/-])` keeps file names such as `.kdb.q` and
// `sample-kx-notebooks.md` and members such as `qserver.kdb` intact.
export const RULES = [
  [/(?<!itemName=)\bKX\.kdb(?![\w-])/g, "timestored.peachq"],
  [
    new RegExp(
      `(?<![\\w.$/-])kdb(\\\\?)\\.(?=(?:${alt(NAMESPACES)})\\\\?\\.|(?:${alt(IDS)})(?!\\w))`,
      "g",
    ),
    "peachq$1.",
  ],
  [
    /\b(getConfiguration|createOutputChannel|createDiagnosticCollection)\(\s*"kdb"/g,
    '$1("peachq"',
  ],
  [/\bsection: "kdb"/g, 'section: "peachq"'],
  [
    new RegExp(`(?<![\\w.$/-])kdb-(${alt(DASHED)})(?![\\w-])`, "g"),
    "peachq-$1",
  ],
  [/(?<![\w.$/-])kx-notebook(?![\w.])/g, "peachq-notebook"],
  [
    new RegExp(`(["'])(${alt(Object.keys(LANGUAGES))})\\1`, "g"),
    (_, q, id) => q + LANGUAGES[id] + q,
  ],
  [/"(category|title)": "KX"/g, '"$1": "peachq"'],
  [/\bKX(: | REPL| Notebook| notebook| \$\{)/g, "peachq$1"],
  [/(["'`])KX (?=[\w$])/g, "$1peachq "],
  [/\bKDB Results\b/g, "peachq Results"],
  [
    /\bkdb (Results View|extension is now active|LangServer|Language Server)/g,
    "peachq $1",
  ],
];

const DEFER_WHEN = "!peachq.deferringToKx";

export const METADATA = {
  name: "peachq",
  displayName: "peachq – q & kdb+ IDE",
  publisher: "timestored",
  description:
    "q language support: run, chart and lint q against any kdb+ process, or with built-in peachq — no licence needed",
  icon: "resources/images/peachq-logo.png",
  repository: {
    type: "git",
    url: "https://github.com/timestored/vscode-peachq.git",
  },
  homepage: "https://peachq.org",
  bugs: { url: "https://github.com/timestored/vscode-peachq/issues" },
  qna: "https://github.com/timestored/vscode-peachq/issues",
  galleryBanner: { color: "#2B1D1A", theme: "dark" },
  categories: [
    "Programming Languages",
    "Data Science",
    "Notebooks",
    "Snippets",
  ],
  keywords: [
    "q",
    "kdb+",
    "peachq",
    "qlang",
    "kdb",
    "q language",
    "qsql",
    "time series",
  ],
};
const ACTIVITY_ICON = "resources/images/peachq-icon.svg";

export function rewrite(text) {
  return RULES.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

function rewritePackage(text) {
  const pkg = JSON.parse(rewrite(text));
  const contributes = pkg.contributes;
  Object.assign(pkg, METADATA);
  contributes.configuration.title = "peachq";
  for (const containers of Object.values(contributes.viewsContainers)) {
    for (const container of containers) container.icon = ACTIVITY_ICON;
  }
  for (const binding of contributes.keybindings) {
    if (!binding.when?.includes(DEFER_WHEN)) {
      binding.when = binding.when
        ? `${binding.when} && ${DEFER_WHEN}`
        : DEFER_WHEN;
    }
  }
  return JSON.stringify(pkg, null, 2) + "\n";
}

// Every contributed id or category still carrying the KX prefix.
export function unmappedIds(pkg) {
  const c = pkg.contributes;
  const found = [
    ...c.commands.flatMap((x) => [x.command, x.category]),
    ...c.keybindings.map((x) => x.command),
    ...Object.keys(c.configuration.properties),
    ...Object.keys(c.viewsContainers),
    ...Object.values(c.viewsContainers)
      .flat()
      .map((x) => x.id),
    ...Object.keys(c.views),
    ...Object.values(c.views)
      .flat()
      .map((x) => x.id),
    ...c.notebooks.map((x) => x.type),
    ...c.customEditors.map((x) => x.viewType),
    ...c.languages.map((x) => x.id),
  ];
  return found.filter((id) => typeof id === "string" && /^(kdb|kx)/i.test(id));
}

function* walk(path, named = true) {
  if (statSync(path).isFile()) {
    if (named || EXTENSIONS.some((ext) => path.endsWith(ext))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!SKIP_DIRS.has(entry)) yield* walk(join(path, entry), false);
  }
}

function excluded(path) {
  const rel = relative(ROOT, path).split(sep).join("/");
  return EXCLUDE.some((x) => (x.endsWith("/") ? rel.startsWith(x) : rel === x));
}

// Prettier realigns what the renames lengthened (code lines, Markdown tables).
async function format(path, text) {
  if (!/\.(ts|md)$/.test(path)) return text;
  const options = await prettier.resolveConfig(path);
  return prettier.format(text, { ...options, filepath: path });
}

export async function run({ check }) {
  const changed = [];
  for (const top of SCAN) {
    for (const path of walk(join(ROOT, top))) {
      if (excluded(path)) continue;
      const before = readFileSync(path, "utf8");
      const after =
        top === "package.json" ? rewritePackage(before) : rewrite(before);
      if (after === before) continue;
      changed.push(relative(ROOT, path));
      if (!check) writeFileSync(path, await format(path, after));
    }
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const changed = await run({ check });
  for (const path of changed)
    console.log(`${check ? "would rewrite" : "rewrote"} ${path}`);
  const pkg = rewritePackage(readFileSync(join(ROOT, "package.json"), "utf8"));
  const unmapped = unmappedIds(JSON.parse(pkg));
  for (const id of unmapped)
    console.error(
      `unmapped KX id in package.json: ${id} (add it to tools/rebrand.mjs)`,
    );
  process.exit(unmapped.length ? 2 : check && changed.length ? 1 : 0);
}
