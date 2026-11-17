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

import {
  ConfigurationTarget,
  Disposable,
  Memento,
  StatusBarAlignment,
  Uri,
  commands,
  extensions,
  window,
  workspace,
} from "vscode";

import { MessageKind, notify } from "./notifications";

// tools/rebrand.mjs skips this file: it is where the KX extension keeps its name.
export const KX_EXTENSION_ID = "KX.kdb";
const KX_SECTION = "kdb";
const SECTION = "peachq";

export const DEFER_CONTEXT = "peachq.deferringToKx";
const DEFER_ANSWER = "peachq.kxDeferAnswer";
const IMPORT_ANSWER = "peachq.kxImportAnswer";

export const PAUSED =
  "The KX extension is active, so peachq's q features are paused here.";
export const USE_PEACHQ = "Use peachq here";
export const KEEP_KX = "Keep KX";

export const IMPORT_QUESTION =
  "Import your KX extension connections and settings?";
export const IMPORT = "Import";
export const NOT_NOW = "Not now";
export const NEVER = "Never";

const logger = "kxCompat";

export function shouldDeferToKx(): boolean {
  return (
    workspace.getConfiguration(SECTION).get<string>("deferToKx", "auto") !==
      "never" && !!extensions.getExtension(KX_EXTENSION_ID)
  );
}

export function showDeferStatus(): Disposable {
  const item = window.createStatusBarItem(StatusBarAlignment.Left);
  item.text = "$(debug-pause) peachq paused";
  item.tooltip = `${PAUSED} Click to manage the KX extension.`;
  item.command = {
    title: "Manage the KX extension",
    command: "extension.open",
    arguments: [KX_EXTENSION_ID],
  };
  item.show();
  return item;
}

export async function promptDeferToKx(state: Memento): Promise<void> {
  if (state.get(DEFER_ANSWER) !== undefined) {
    return;
  }
  await state.update(DEFER_ANSWER, "asked");
  const answer = await notify(
    PAUSED,
    MessageKind.INFO,
    { logger },
    USE_PEACHQ,
    KEEP_KX,
  );
  if (answer) {
    await state.update(DEFER_ANSWER, answer);
  }
  if (answer === USE_PEACHQ) {
    // There is no API to disable another extension; this opens its page.
    await commands.executeCommand("extension.open", KX_EXTENSION_ID);
  }
}

export function importableKeys(packageJSON: {
  contributes: { configuration: { properties: object } };
}): string[] {
  return Object.keys(packageJSON.contributes.configuration.properties)
    .map((key) => key.slice(SECTION.length + 1))
    .filter((key) => key !== "deferToKx");
}

export function pendingImports(keys: string[]): string[] {
  const kx = workspace.getConfiguration(KX_SECTION);
  const ours = workspace.getConfiguration(SECTION);
  return keys.filter(
    (key) =>
      kx.inspect(key)?.globalValue !== undefined &&
      ours.inspect(key)?.globalValue === undefined,
  );
}

export async function importFromKx(keys: string[]): Promise<string[]> {
  const kx = workspace.getConfiguration(KX_SECTION);
  const ours = workspace.getConfiguration(SECTION);
  const imported = pendingImports(keys);
  for (const key of imported) {
    await ours.update(
      key,
      kx.inspect(key)!.globalValue,
      ConfigurationTarget.Global,
    );
  }
  return imported;
}

function needsPasswords(): boolean {
  const servers = workspace
    .getConfiguration(KX_SECTION)
    .inspect<Record<string, { auth?: boolean }>>("servers")?.globalValue;
  return Object.values(servers ?? {}).some((server) => server?.auth);
}

export async function runImportFromKx(
  keys: string[],
  onImported: () => void,
): Promise<string[]> {
  const passwords = needsPasswords();
  const imported = await importFromKx(keys);
  if (imported.length === 0) {
    notify(
      "Nothing to import: no KX extension user settings without a peachq value.",
      MessageKind.INFO,
      { logger },
    );
    return imported;
  }
  onImported();
  notify(
    `Imported ${imported.join(", ")} from the KX extension.` +
      (passwords
        ? " Passwords stay in the KX extension's secret storage, which peachq cannot read: you will be asked for each one on first connect."
        : ""),
    MessageKind.INFO,
    { logger },
  );
  return imported;
}

export async function offerImportFromKx(
  state: Memento,
  keys: string[],
  onImported: () => void,
): Promise<void> {
  if (state.get(IMPORT_ANSWER) === NEVER || !pendingImports(keys).length) {
    return;
  }
  const answer = await notify(
    IMPORT_QUESTION,
    MessageKind.INFO,
    { logger },
    IMPORT,
    NOT_NOW,
    NEVER,
  );
  if (answer === NEVER) {
    await state.update(IMPORT_ANSWER, NEVER);
  } else if (answer === IMPORT) {
    await runImportFromKx(keys, onImported);
  }
}

type KxMap = "connectionMap" | "targetMap" | "timeoutMap";

// A team repo may still map files under kdb.*: read those until it migrates.
export function kxMapEntry<T>(
  setting: KxMap,
  uri: Uri,
  path: string,
): T | undefined {
  return workspace
    .getConfiguration(KX_SECTION, uri)
    .get<Record<string, T | undefined>>(setting)?.[path];
}

// What clearing a peachq entry stores, so the kdb.* one stays hidden.
export function kxClearedEntry<T>(
  setting: KxMap,
  uri: Uri,
  path: string,
  cleared: T,
): T | undefined {
  return kxMapEntry(setting, uri, path) === undefined ? undefined : cleared;
}
