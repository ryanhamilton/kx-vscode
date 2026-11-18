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

import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { getEnvironment } from "../utils/core";
import { getNonce } from "../utils/getNonce";
import { MessageKind, notify } from "../utils/notifications";
import { getUri } from "../utils/uriUtils";
import { webviewReset } from "../utils/webviewPage";

const logger = "setupTools";

const VIEW_SETTINGS = [
  "peachq.qHomeDirectory",
  "peachq.qHomeDirectoryWorkspace",
  "peachq.neverShowQInstallAgain",
];

let panel: vscode.WebviewPanel | undefined;
let welcomeFolder: vscode.WorkspaceFolder | undefined;
let qBinary = "";

export async function showSetupError(workspace?: vscode.WorkspaceFolder) {
  /* c8 ignore start */
  const scope = workspace ? " for workspace " + workspace.name : "";
  const res = await notify(
    `q installation not found${scope}.`,
    MessageKind.WARNING,
    { logger, params: workspace?.name },
    "Set q Home Directory",
    "Get peachq",
    "Dismiss",
  );
  if (res === "Set q Home Directory") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "peachq.qHomeDirectory",
    );
  } else if (res === "Get peachq") {
    showWelcome(workspace);
  }
  /* c8 ignore stop */
}

export function showWelcome(folder?: vscode.WorkspaceFolder) {
  /* c8 ignore start */
  notify("Welcome displayed.", MessageKind.DEBUG, {
    logger,
    telemetry: "Welcome.Displayed",
  });
  welcomeFolder = folder;
  if (panel) {
    updateView();
    panel.reveal();
  } else {
    panel = vscode.window.createWebviewPanel(
      "kdbWelcomeView",
      "Welcome to peachq",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(ext.context.extensionUri)],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(
      ext.context.extensionUri,
      "resources",
      "images",
      "peachq-logo.png",
    );
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg === "repl") {
        vscode.commands.executeCommand("peachq.repl.start");
      } else if (msg === "qhome") {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "peachq.qHomeDirectory",
        );
      } else if (msg === true || msg === false) {
        vscode.workspace
          .getConfiguration()
          .update(
            "peachq.neverShowQInstallAgain",
            !msg,
            vscode.ConfigurationTarget.Global,
          );
      }
    });
    updateView();
    const listeners = [
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (VIEW_SETTINGS.some((name) => event.affectsConfiguration(name))) {
          updateView();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => updateView()),
    ];
    panel.onDidDispose(() => {
      listeners.forEach((listener) => listener.dispose());
      panel = undefined;
    });
    ext.context.subscriptions.push(panel);
  }
  /* c8 ignore stop */
}

function getWebviewContent(webview: vscode.Webview) {
  /* c8 ignore start */
  const getResource = (resource: string) =>
    getUri(webview, ext.context.extensionUri, resource.split("/"));

  return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      ${webviewReset(getNonce())}
      <script type="module" nonce="${getNonce()}" src="${getResource("out/webview.js")}"></script>
      <title>Welcome to peachq</title>
    </head>
    <body>
      <kdb-welcome-view image="${getResource("resources/images/peachq-logo.png")}" checked="${getShowWelcome()}" q="${getQBinary()}"></kdb-welcome-view>
    </body>
    </html>
  `;
  /* c8 ignore stop */
}

export function findQBinary(preferred = welcomeFolder) {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (preferred && folders.includes(preferred)) {
    return getEnvironment(preferred).qBinPath;
  }
  if (folders.length === 0) return getEnvironment().qBinPath;
  const uri = vscode.window.activeTextEditor?.document.uri;
  const active = uri && vscode.workspace.getWorkspaceFolder(uri);
  for (const folder of [active, ...folders.filter((f) => f !== active)]) {
    if (!folder) continue;
    const { qBinPath } = getEnvironment(folder);
    if (qBinPath) return qBinPath;
  }
  return "";
}

function getQBinary() {
  return qBinary.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function getShowWelcome() {
  /* c8 ignore start */
  return !vscode.workspace
    .getConfiguration()
    .get<boolean>("peachq.neverShowQInstallAgain", false);
  /* c8 ignore stop */
}

function updateView() {
  /* c8 ignore start */
  qBinary = findQBinary();
  if (panel) panel.webview.html = getWebviewContent(panel.webview);
  /* c8 ignore stop */
}
// Modified by peachq contributors; see NOTICE.
