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

import Path from "path";
import {
  CodeLens,
  CodeLensProvider,
  Command,
  EventEmitter,
  FileType,
  Range,
  StatusBarAlignment,
  TabInputNotebook,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";

import { ext } from "../extensionVariables";
import {
  ensureQuickConnection,
  runQuery,
  setQuickPassword,
} from "./serverCommand";
import { getActiveTarget } from "../classes/activeTarget";
import { LocalConnection } from "../classes/localConnection";
import { QNotFoundError, ReplConnection } from "../classes/replConnection";
import { ExecutionTypes } from "../models/execution";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { KdbNode, LabelNode } from "../services/kdbTreeProvider";
import {
  getBasename,
  isQuick,
  isQuickAlias,
  offerConnectAction,
} from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import {
  RunFlag,
  getPythonWrapper,
  getSQLWrapper,
  notifyExecution,
} from "../utils/queryUtils";
import { errorMessage } from "../utils/shared";
import { showInputPicker } from "../utils/widgets";

const logger = "workspaceCommand";

function setRealActiveTextEditor(editor?: TextEditor | undefined) {
  if (editor) {
    const scheme = editor.document.uri.scheme;
    if (scheme !== "output") {
      ext.activeTextEditor = editor;
    }
  } else {
    ext.activeTextEditor = undefined;
  }
}

// What the notebook toolbar hands its commands.
type NotebookToolbarContext = { notebookEditor?: { notebookUri?: Uri } };

/**
 * The file the connection picker acts on. A notebook has
 * no active text editor until one of its cells is focused, so the toolbar
 * context it passes comes first, then the frontmost tab, and only then the
 * active text editor.
 */
export function getActiveFileUri(context?: unknown): Uri | undefined {
  const fromToolbar = (context as NotebookToolbarContext)?.notebookEditor
    ?.notebookUri;
  if (fromToolbar) {
    return fromToolbar;
  }

  const tab = window.tabGroups.activeTabGroup.activeTab?.input;
  if (tab instanceof TabInputNotebook) {
    return tab.uri;
  }

  return ext.activeTextEditor?.document.uri;
}

function activeEditorChanged(editor?: TextEditor | undefined) {
  setRealActiveTextEditor(editor);
  updateStatusBarItems();
}

/**
 * Points the connection status bar item at the file in front,
 * which is a notebook when its tab is frontmost and the active text editor
 * otherwise.
 */
export async function updateStatusBarItems() {
  const uri = getActiveFileUri();
  const runItem = ext.runScratchpadItem;

  if (uri) {
    const server = getServerForUri(uri);
    if (server || isConnectableFile(uri)) {
      setRunScratchpadItemText(uri, server || "(active)");
      runItem.show();
    } else {
      runItem.hide();
    }
  } else {
    runItem.hide();
  }
}

const REPL_LABEL = new RegExp(`^${ext.REPL} \\((.+)\\)$`, "s");

export function replServer(label: string) {
  return `${ext.REPL} (${label})`;
}

export function isRepl(server?: string): boolean {
  return server === ext.REPL || (!!server && REPL_LABEL.test(server));
}

export function replLabelOf(server?: string) {
  return server ? REPL_LABEL.exec(server)?.[1] : undefined;
}

export function replChoices(server?: string) {
  const choices = ReplConnection.labels().map(replServer);
  if (server && isRepl(server) && !choices.includes(server)) {
    choices.push(server);
  }
  return choices;
}

export function runItemText(text: string) {
  const active = ReplConnection.activeLabel;
  return text === ext.REPL && active ? `${ext.REPL} → ${active}` : text;
}

function setRunScratchpadItemText(uri: Uri, text: string) {
  ext.runScratchpadItem.text = `$(cloud) ${runItemText(text)}`;
  ext.runScratchpadItem.tooltip = `peachq: Choose connection for '${getBasename(uri)}'`;
}

function getServers() {
  const conf = workspace.getConfiguration("peachq");
  const servers = conf.get<{ [key: string]: { serverAlias: string } }>(
    "servers",
    {},
  );

  return [
    ...Object.values(servers)
      .map(({ serverAlias }) => serverAlias)
      .sort((a, b) => a.localeCompare(b)),
  ];
}

const quickServers: string[] = [];

function getQuickServers(uri: Uri) {
  const conf = workspace.getConfiguration("peachq", uri);
  const connections = conf.get<{ [key: string]: string }>("connectionMap", {});
  const size = quickServers.length;
  const targets = [
    ...Object.values(connections),
    ...sessionConnectionMap.values(),
  ];
  targets.forEach((target) => {
    if (isQuick(target) && !quickServers.includes(target)) {
      quickServers.push(target);
    }
  });
  return size !== quickServers.length ? quickServers.sort() : quickServers;
}

export async function getConnectionForServer(
  server: string,
): Promise<KdbNode | undefined> {
  /* c8 ignore start */
  if (server) {
    const nodes = await ext.serverProvider.getChildren();
    const orphan = nodes.find(
      (node) => node instanceof KdbNode && node.details.serverAlias === server,
    ) as KdbNode;
    if (orphan) {
      return orphan;
    }
    const labels = nodes.filter((server) => server instanceof LabelNode);
    for (const label of labels) {
      const item = (label as LabelNode).children.find(
        (node) =>
          node instanceof KdbNode && node.details.serverAlias === server,
      ) as KdbNode;
      if (item) {
        return item;
      }
    }
  }
  /* c8 ignore stop */
}

function relativePath(uri: Uri) {
  return workspace.asRelativePath(uri, false);
}

// Assignments for files outside the workspace cannot be persisted in the
// peachq.connectionMap setting, which is keyed by
// workspace relative path. They are kept in memory for the session instead.
const sessionConnectionMap = new Map<string, string>();

const sessionMapChangedEmitter = new EventEmitter<void>();

// Session assignments don't change the configuration, so consumers relying on
// peachq.connectionMap changes need this event to know when to refresh.
export const onDidChangeSessionMaps = sessionMapChangedEmitter.event;

function isOutsideWorkspace(uri: Uri) {
  return !workspace.getWorkspaceFolder(uri);
}

function sessionKey(uri: Uri) {
  return uri.toString();
}

function setSessionValue<T>(
  map: Map<string, T>,
  uri: Uri,
  value: T | undefined,
) {
  if (value === undefined) {
    map.delete(sessionKey(uri));
  } else {
    map.set(sessionKey(uri), value);
  }
  sessionMapChangedEmitter.fire();
}

export async function setServerForUri(uri: Uri, server: string | undefined) {
  uri = Uri.file(uri.path);
  if (isOutsideWorkspace(uri)) {
    setSessionValue(sessionConnectionMap, uri, server);
    return;
  }
  const conf = workspace.getConfiguration("peachq", uri);
  const map = conf.get<{ [key: string]: string | undefined }>(
    "connectionMap",
    {},
  );
  map[relativePath(uri)] = server;
  await conf.update("connectionMap", map);
}

export function getServerForUri(uri: Uri) {
  uri = Uri.file(uri.path);
  let server: string | undefined;

  if (isOutsideWorkspace(uri)) {
    server = sessionConnectionMap.get(sessionKey(uri));
  } else {
    const conf = workspace.getConfiguration("peachq", uri);
    const map = conf.get<{ [key: string]: string | undefined }>(
      "connectionMap",
      {},
    );
    server = map[relativePath(uri)];
  }

  const servers = getServers();

  return isQuick(server) ||
    (server && (isRepl(server) || servers.includes(server)))
    ? server
    : undefined;
}

export function getConnectionForUri(uri: Uri) {
  const server = getServerForUri(uri);
  if (server) {
    if (isQuick(server)) {
      const [host, port, user] = server.split(":");
      return ext.connectionsList.find(
        (item) =>
          item instanceof KdbNode &&
          host === item.details.serverName &&
          port === item.details.serverPort &&
          user === item.details.username,
      );
    }
    return ext.connectionsList.find(
      (item) => item.details.serverAlias === server,
    );
  }
}

export async function pickConnection(uri: Uri) {
  /* c8 ignore start */
  const server = getServerForUri(uri);
  const items = [
    "(active)",
    ...replChoices(server),
    ...getServers(),
    ...getQuickServers(uri),
  ];

  let picked = await showInputPicker(items, {
    title: `Choose a connection or enter a quick connection string for ${getBasename(uri)}`,
    placeHolder: server,
  });

  if (picked === undefined) return undefined;

  if (isQuick(picked)) {
    const [host, port, user, pass] = picked.split(":");
    if (host && port && /^\d+$/s.test(port)) {
      if (user) {
        picked = `${host}:${port}:${user}`;
        if (pass !== undefined) await setQuickPassword(host, port, user, pass);
      } else {
        picked = `${host}:${port}`;
      }
    } else {
      notify(`Connection string (${picked}) is not valid.`, MessageKind.ERROR, {
        logger,
      });
      return undefined;
    }
  } else if (picked === "(active)") {
    picked = undefined;
  } else if (!items.includes(picked)) {
    notify(`Connection "${picked}" is not found.`, MessageKind.ERROR, {
      logger,
    });
    return undefined;
  }

  if (picked || isConnectableFile(uri)) {
    setRunScratchpadItemText(uri, picked || "(active)");
    ext.runScratchpadItem.show();
  } else {
    ext.runScratchpadItem.hide();
  }
  await setServerForUri(uri, picked);

  return picked;
  /* c8 ignore stop */
}

function isQuke(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".quke");
}

function isSql(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".sql");
}

function isPython(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".py");
}

function isWorkbook(uri: Uri | undefined) {
  return (
    uri &&
    (uri.path.endsWith(".kdb.q") ||
      uri.path.endsWith(".kdb.py") ||
      uri.path.endsWith(".kdb.sql"))
  );
}

// A file that can be run against a connection (q/quke/Python/SQL, including
// workbooks, and notebooks). Used to decide whether to offer the status-bar
// connection selector, even when the file is not yet assigned to a connection.
function isConnectableFile(uri: Uri | undefined) {
  return (
    !!uri &&
    (uri.path.endsWith(".q") ||
      uri.path.endsWith(".quke") ||
      uri.path.endsWith(".py") ||
      uri.path.endsWith(".sql") ||
      uri.path.endsWith(".kxnb"))
  );
}

function isKxFolder(uri: Uri | undefined) {
  return uri && Path.basename(uri.path) === ".kx";
}

export function reportReplError(error: unknown) {
  if (error instanceof QNotFoundError) return;
  notify(errorMessage(error), MessageKind.ERROR, { logger, params: error });
}

async function launchRepl(open: () => Promise<ReplConnection>) {
  let instance: ReplConnection;
  try {
    instance = await open();
  } catch (error) {
    reportReplError(error);
    return;
  }
  instance.start();
  notify("REPL started.", MessageKind.DEBUG, { logger });
}

export function startRepl() {
  return launchRepl(() => ReplConnection.getOrCreateInstance());
}

export async function startReplInFolder(uri?: Uri) {
  if (!uri) {
    return startRepl();
  }
  let base = uri;
  try {
    const stat = await workspace.fs.stat(uri);
    if (!(stat.type & FileType.Directory)) {
      base = Uri.file(Path.dirname(uri.fsPath));
    }
  } catch {
    // Unable to stat the resource; fall back to using it as the base directory.
  }
  return launchRepl(() => ReplConnection.openInFolder(base));
}

export async function runOnRepl(
  editor: TextEditor,
  type?: ExecutionTypes,
  label?: string,
) {
  const uri = editor.document.uri;
  const basename = getBasename(uri);

  let text: string;

  switch (type) {
    case ExecutionTypes.QueryFile:
    case ExecutionTypes.PythonQueryFile:
      text = editor.document.getText();
      break;
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection:
      text = editor.selection.isEmpty
        ? editor.document.lineAt(editor.selection.active.line).text
        : editor.document.getText(editor.selection);
      break;
    default:
      notify(
        `Executing ${basename} on ${ext.REPL} is not supported.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
  }

  // Nothing to run. Checked before wrapping, because the SQL and Python
  // wrappers turn empty text into a non-empty statement the REPL would send.
  if (!text.trim()) {
    return;
  }

  try {
    const repl = label
      ? await ReplConnection.forLabel(label)
      : await ReplConnection.getOrCreateInstance(uri);
    repl.show();
    await repl.executeQuery(
      isPython(uri)
        ? getPythonWrapper(text, "serialized")
        : isSql(uri)
          ? getSQLWrapper(text)
          : text,
      undefined,
      isPython(uri) ? text : undefined,
    );
  } catch (error) {
    reportReplError(error);
  }
}

export type RunTarget =
  | { kind: "repl"; label?: string }
  | { kind: "connection"; conn: LocalConnection };

/**
 * Decides where a q/Python/SQL file runs. Precedence:
 *   1. persisted assignment (peachq.connectionMap): an explicit REPL assignment is
 *      sticky; an explicit connection is resolved (offering to connect);
 *   2. otherwise the active target — the last-focused KX terminal (REPL or a
 *      connection console);
 *   3. otherwise the REPL (getOrCreateInstance picks the active REPL or spawns
 *      one for the workspace).
 */
export async function resolveRunTarget(
  uri: Uri,
): Promise<RunTarget | undefined> {
  const server = getServerForUri(uri);

  if (isRepl(server)) {
    const label = replLabelOf(server);
    return label ? { kind: "repl", label } : { kind: "repl" };
  }

  if (server !== undefined) {
    const conn = await findConnection(uri);
    return conn ? { kind: "connection", conn } : undefined;
  }

  const active = getActiveTarget();
  if (active?.kind === "connection") {
    const conn = new ConnectionManagementService().retrieveConnectedConnection(
      active.connLabel,
    );
    if (conn) {
      return { kind: "connection", conn };
    }
  }

  return { kind: "repl" };
}

export async function runActiveEditor(type?: ExecutionTypes) {
  /* c8 ignore start */
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const runTarget = await resolveRunTarget(uri);
    if (!runTarget) {
      return;
    }
    if (runTarget.kind === "repl") {
      await runOnRepl(ext.activeTextEditor, type, runTarget.label);
      notifyExecution(
        RunFlag.Run |
          RunFlag.Repl |
          (isWorkbook(uri) ? RunFlag.Workbook : 0) |
          (isPython(uri) ? RunFlag.Python : 0) |
          (isSql(uri) ? RunFlag.Sql : 0) |
          (isQuke(uri) ? RunFlag.Quke : 0),
      );
      return;
    }
    const conn = runTarget.conn;

    const executorName = getBasename(ext.activeTextEditor.document.uri);

    try {
      await runQuery(
        type === undefined
          ? isPython(uri)
            ? ExecutionTypes.PythonQueryFile
            : ExecutionTypes.QueryFile
          : type,
        conn.connLabel,
        executorName,
        !!isWorkbook(uri),
        undefined,
        !!isSql(uri),
      );
      notifyExecution(
        RunFlag.Run |
          (isQuickAlias(conn.connLabel) ? RunFlag.Quick : 0) |
          (isWorkbook(uri) ? RunFlag.Workbook : 0) |
          (isPython(uri) ? RunFlag.Python : 0) |
          (isSql(uri) ? RunFlag.Sql : 0) |
          (isQuke(uri) ? RunFlag.Quke : 0),
      );
    } catch (error) {
      // don't show message if execution was cancelled
      if (error instanceof Error && error.message.startsWith("Canceled")) {
        return;
      }

      notify(
        `Executing ${executorName} on ${conn.connLabel} failed.`,
        MessageKind.ERROR,
        {
          logger,
          params: error,
        },
      );
    }
  }
  /* c8 ignore stop */
}

function update(uri: Uri) {
  if (isWorkbook(uri)) {
    ext.scratchpadTreeProvider.reload();
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  readonly onDidChangeCodeLenses = onDidChangeSessionMaps;

  async provideCodeLenses(document: TextDocument) {
    const server = getServerForUri(document.uri);
    const top = new Range(0, 0, 0, 0);

    const lenses: CodeLens[] = [];

    lenses.push(
      new CodeLens(top, {
        command: "peachq.file.pickConnection",
        title: server ? `Run on ${server}` : "Run on active",
      }),
    );

    return lenses;
  }
}

export function connectWorkspaceCommands() {
  ext.runScratchpadItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    10000,
  );
  ext.runScratchpadItem.command = <Command>{
    title: "Choose Connection",
    command: "peachq.file.pickConnection",
    arguments: [],
  };

  const watcher = workspace.createFileSystemWatcher("**/*.{q,py,sql}");
  watcher.onDidCreate(update);
  watcher.onDidDelete(update);

  workspace.onDidDeleteFiles((event) => {
    /* c8 ignore start */
    for (const uri of event.files) {
      if (isKxFolder(uri)) {
        ext.scratchpadTreeProvider.reload();
        break;
      }
    }
    /* c8 ignore stop */
  });

  workspace.onDidRenameFiles(async (event) => {
    /* c8 ignore start */
    for (const { oldUri, newUri } of event.files) {
      await setServerForUri(newUri, getServerForUri(oldUri));
      await setServerForUri(oldUri, undefined);
    }
    /* c8 ignore stop */
  });

  workspace.onDidChangeWorkspaceFolders(() => {
    ext.scratchpadTreeProvider.reload();
  });
  window.onDidChangeActiveTextEditor(activeEditorChanged);
  window.onDidChangeActiveNotebookEditor(() => updateStatusBarItems());
  window.tabGroups.onDidChangeTabs(() => updateStatusBarItems());
  window.tabGroups.onDidChangeTabGroups(() => updateStatusBarItems());
  ReplConnection.onDidChangeActive(() => updateStatusBarItems());
  activeEditorChanged(window.activeTextEditor);
}

export async function findConnection(uri: Uri) {
  /* c8 ignore start */
  let conn: LocalConnection | undefined;
  let server = getServerForUri(uri) ?? "";

  if (server) {
    if (isQuick(server)) server = await ensureQuickConnection(server);
    const node = await getConnectionForServer(server);
    if (node) {
      const connMngService = new ConnectionManagementService();
      server = node.label;
      conn = connMngService.retrieveConnectedConnection(server);
      if (conn === undefined) {
        const res = await offerConnectAction(server);
        if (res) {
          conn = connMngService.retrieveConnectedConnection(server);
        }
      }
    } else {
      notify(`Connection ${server} not found.`, MessageKind.ERROR, {
        logger,
      });
    }
  } else {
    await offerConnectAction();
  }
  return conn;
  /* c8 ignore stop */
}
