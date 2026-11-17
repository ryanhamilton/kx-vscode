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

import { env } from "node:process";
import path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import { initActiveTargetTracking } from "./classes/activeTargetTracker";
import { OPEN_RESULTS_HINT } from "./classes/connectionConsole";
import { connectBuildTools, lintCommand } from "./commands/buildToolsCommand";
import { connectClientCommands } from "./commands/clientCommand";
import {
  activeConnection,
  addAuthConnection,
  addKdbConnection,
  addNewConnection,
  connect,
  copyQuery,
  disconnect,
  editConnection,
  editKdbConnection,
  enableTLS,
  executeQuery,
  exportConnections,
  importConnections,
  removeConnection,
  rerunQuery,
} from "./commands/serverCommand";
import {
  ConnectionLensProvider,
  connectWorkspaceCommands,
  getActiveFileUri,
  pickConnection,
  runActiveEditor,
  setServerForUri,
  startRepl,
  startReplInFolder,
} from "./commands/workspaceCommand";
import { ext } from "./extensionVariables";
import { CommandRegistration } from "./models/commandRegistration";
import { Server, ServerDetails } from "./models/connectionsModels";
import { ExecutionTypes } from "./models/execution";
import { QueryResult } from "./models/queryResult";
import { ChartEditorProvider } from "./services/chartEditorProvider";
import { CompletionProvider } from "./services/completionProvider";
import { KdbNode, KdbTreeProvider } from "./services/kdbTreeProvider";
import { KxNotebookController } from "./services/notebookController";
import { KxNotebookSerializer } from "./services/notebookSerializer";
import {
  QueryHistoryProvider,
  QueryHistoryTreeItem,
} from "./services/queryHistoryProvider";
import { QuickFixProvider } from "./services/quickFixProvider";
import { KdbResultsViewProvider } from "./services/resultsPanelProvider";
import {
  FileTreeItem,
  WorkspaceTreeProvider,
} from "./services/workspaceTreeProvider";
import {
  createNewLabel,
  deleteLabel,
  getWorkspaceLabels,
  getWorkspaceLabelsConnMap,
  renameLabel,
  setLabelColor,
} from "./utils/connLabel";
import {
  checkOpenSslInstalled,
  getServers,
  hasWorkspaceOrShowOption,
} from "./utils/core";
import { getIconPath } from "./utils/iconsUtils";
import { MessageKind, notify, Runner } from "./utils/notifications";
import AuthSettings from "./utils/secretStorage";
import { addWorkspaceFile } from "./utils/workspace";

const logger = "extension";

// Sets where query results are written — the kdb Results View (true) or the
// connection's output console/Terminal (false) — and mirrors it into a context
// key so the editor-toolbar selector reflects the current destination. When
// switching to the Results View, reveal it so results are immediately visible.
function setResultsDestination(showInView: boolean) {
  ext.isResultsTabVisible = showInView;
  vscode.commands.executeCommand(
    "setContext",
    "kdb.showResultsInView",
    showInView,
  );
  if (showInView) {
    vscode.commands.executeCommand(`${KdbResultsViewProvider.viewType}.focus`);
  }
}

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  ext.context = context;
  ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });
  ext.openSslVersion = await checkOpenSslInstalled();

  getWorkspaceLabelsConnMap();
  getWorkspaceLabels();

  // clear necessary contexts
  vscode.commands.executeCommand("setContext", "kdb.connected.active", false);
  vscode.commands.executeCommand("setContext", "kdb.pythonEnabled", false);
  vscode.commands.executeCommand("setContext", "kdb.connected", []);
  vscode.commands.executeCommand("setContext", "kdb.kdbQHCopyList", []);

  // Default query results to the output console (Terminal), not the view.
  setResultsDestination(false);

  const servers: Server | undefined = getServers();

  ext.serverProvider = new KdbTreeProvider(servers!);
  ext.queryHistoryProvider = new QueryHistoryProvider();
  ext.resultsViewProvider = new KdbResultsViewProvider(
    ext.context.extensionUri,
  );
  ext.scratchpadTreeProvider = new WorkspaceTreeProvider(
    "**/*.kdb.{q,py,sql}",
    "scratchpad",
  );

  vscode.commands.executeCommand("setContext", "kdb.QHOME", env.QHOME);

  vscode.window.registerTreeDataProvider("kdb-servers", ext.serverProvider);

  vscode.window.registerTreeDataProvider(
    "kdb-query-history",
    ext.queryHistoryProvider,
  );
  vscode.window.registerTreeDataProvider(
    "kdb-scratchpad-explorer",
    ext.scratchpadTreeProvider,
  );

  // initialize the secret store
  AuthSettings.init(context);
  ext.secretSettings = AuthSettings.instance;

  registerAllExtensionCommands();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      KdbResultsViewProvider.viewType,
      ext.resultsViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),

    ChartEditorProvider.register(context),

    vscode.languages.registerCodeLensProvider(
      { pattern: "**/*.{q,quke,py,sql}" },
      new ConnectionLensProvider(),
    ),

    vscode.languages.registerCodeActionsProvider(
      { language: "q" },
      new QuickFixProvider(),
    ),
    ext.diagnosticCollection,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) {
        ext.scratchpadTreeProvider.reload();
      }
      if (event.affectsConfiguration("kdb.connectionLabelsMap")) {
        ext.serverProvider.reload();
      }
      if (event.affectsConfiguration("kdb.connectionLabels")) {
        ext.serverProvider.reload();
      }
    }),
  );

  const lastResult: QueryResult | undefined = undefined;
  const resultSchema = "vscode-kdb-q";
  const resultProvider = new (class
    implements vscode.TextDocumentContentProvider
  {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(_uri: vscode.Uri): string {
      const result = lastResult!;

      return result.result;
    }
  })();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      resultSchema,
      resultProvider,
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "q" },
      new CompletionProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      "kx-notebook",
      new KxNotebookSerializer(),
    ),
    (ext.notebookController = new KxNotebookController()),
  );

  // Track the last-focused KX target terminal (REPL or connection console) as
  // the active execution target for unassigned files.
  context.subscriptions.push(initActiveTargetTracking());

  // Make the KDB Results view discoverable from a connection console: the
  // console prints an "Open KDB Results View" hint, which this provider turns
  // into a clickable link (terminals disallow command: hyperlinks directly)
  // that reveals the KDB Results view in the bottom panel.
  const resultsLinkProvider: vscode.TerminalLinkProvider = {
    provideTerminalLinks: (linkContext: vscode.TerminalLinkContext) => {
      const index = linkContext.line.indexOf(OPEN_RESULTS_HINT);
      if (index === -1) {
        return [];
      }
      return [
        {
          startIndex: index,
          length: OPEN_RESULTS_HINT.length,
          tooltip: "Open kdb Results View",
        },
      ];
    },
    handleTerminalLink: () => {
      vscode.commands.executeCommand(
        `${KdbResultsViewProvider.viewType}.focus`,
      );
    },
  };
  context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider(resultsLinkProvider),
  );

  //q language server
  const serverModule = path.join(context.extensionPath, "out", "server.js");
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: "q",
      },
      {
        language: "q",
        notebook: { notebookType: "kx-notebook" },
      },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/*.{q,quke,k}",
        true,
        true,
      ),
    },
  };

  client = new LanguageClient(
    "kdb LangServer",
    "kdb Language Server",
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    client.onNotification("notify", (params) =>
      notify(params.message, params.kind, params.options),
    ),
  );

  await client.start();
  connectClientCommands(context, client);
  await connectBuildTools();

  const authExtension = vscode.extensions.getExtension("KX.kdb-auth");
  if (authExtension) {
    const api = await authExtension.activate();
    if ("auth" in api) {
      notify("Custom authentication activated.", MessageKind.DEBUG, {
        logger,
      });
      ext.customAuth = api;
    }
  }

  notify("kdb extension is now active.", MessageKind.DEBUG, {
    logger,
  });
}

function registerResultsPanelCommands(): CommandRegistration[] {
  const resultsCommands: CommandRegistration[] = [
    {
      command: "kdb.resultsPanel.update",
      callback: (
        results: any,
        isInsights: boolean,
        connVersion?: string,
        isPython?: boolean,
      ) => {
        ext.resultsViewProvider.updateResults(
          results,
          isInsights,
          connVersion,
          isPython,
        );
      },
    },
    {
      command: "kdb.resultsPanel.clear",
      callback: () => ext.resultsViewProvider.updateResults(""),
    },
    {
      command: "kdb.resultsPanel.export.csv",
      callback: () => ext.resultsViewProvider.exportToCsv(),
    },
    {
      // Editor-toolbar selector: route query results to the connection's
      // output console (Terminal).
      command: "kdb.results.destination.terminal",
      callback: () => setResultsDestination(false),
    },
    {
      // Editor-toolbar selector: route query results to the kdb Results View.
      command: "kdb.results.destination.view",
      callback: () => setResultsDestination(true),
    },
  ];

  return resultsCommands;
}

function registerScratchpadCommands(): CommandRegistration[] {
  const scratchpadCommands: CommandRegistration[] = [
    {
      command: "kdb.scratchpad.run",
      callback: async () => {
        await runActiveEditor();
      },
    },
    {
      command: "kdb.scratchpad.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding workbooks")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "workbook",
            ".kdb.q",
          );
          await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(uri);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.scratchpad.python.run",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQuerySelection);
      },
    },
    {
      command: "kdb.scratchpad.python.run.file",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQueryFile);
      },
    },
    {
      command: "kdb.scratchpad.python.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding workbooks")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "workbook",
            ".kdb.py",
          );
          await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(uri);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.scratchpad.sql.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding workbooks")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "workbook",
            ".kdb.sql",
          );
          await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(uri);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.scratchpad.explorer.refresh",
      callback: () => {
        ext.scratchpadTreeProvider.reload();
      },
    },
  ];

  return scratchpadCommands;
}

function registerQueryHistoryCommands(): CommandRegistration[] {
  const queryHistoryCommands: CommandRegistration[] = [
    {
      command: "kdb.queryHistory.clear",
      callback: () => {
        ext.kdbQueryHistoryList.length = 0;
        ext.kdbQueryHistoryNodes.length = 0;
        ext.queryHistoryProvider.refresh();
      },
    },
    {
      command: "kdb.queryHistory.rerun",
      callback: async (viewItem: QueryHistoryTreeItem) => {
        rerunQuery(viewItem.details);
      },
    },
    {
      command: "kdb.queryHistory.copyQuery",
      callback: async (viewItem: QueryHistoryTreeItem) => {
        copyQuery(viewItem.details);
      },
    },
  ];

  return queryHistoryCommands;
}

function registerConnectionsCommands(): CommandRegistration[] {
  const connectionCommands: CommandRegistration[] = [
    {
      command: "kdb.connections.connect",
      callback: async (viewItem: KdbNode) => {
        await connect(viewItem.label);
      },
    },
    {
      command: "kdb.connections.connect.via.dialog",
      callback: async (connLabel: string) => {
        await connect(connLabel);
      },
    },
    {
      command: "kdb.connections.setActive",
      callback: async (viewItem: KdbNode) => {
        activeConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.addAuthentication",
      callback: async (viewItem: KdbNode) => {
        const username = await vscode.window.showInputBox({
          prompt: "Username",
          title: "Add Authentication",
        });
        if (username) {
          const password = await vscode.window.showInputBox({
            prompt: "Password",
            title: "Add Authentication",
            password: true,
          });
          if (password) {
            await addAuthConnection(viewItem.children[0], username, password);
          }
        }
      },
    },
    {
      command: "kdb.connections.enableTLS",
      callback: async (viewItem: KdbNode) => {
        await enableTLS(viewItem.children[0]);
      },
    },
    {
      command: "kdb.connections.remove.kdb",
      callback: async (viewItem: KdbNode) => {
        await removeConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.disconnect",
      callback: async (viewItem: KdbNode | string) => {
        const connLabel =
          typeof viewItem === "string" ? viewItem : viewItem.label;
        await disconnect(connLabel);
      },
    },
    {
      command: "kdb.connections.export.all",
      callback: () => {
        notify("Export all conections.", MessageKind.DEBUG, {
          logger,
        });
        exportConnections();
      },
    },
    {
      command: "kdb.connections.export.single",
      callback: async (viewItem: KdbNode) => {
        notify("Export single conection.", MessageKind.DEBUG, {
          logger,
        });
        exportConnections(viewItem.label);
      },
    },
    {
      command: "kdb.connections.import",
      callback: async () => {
        notify("Import conections.", MessageKind.DEBUG, {
          logger,
        });
        await importConnections();
      },
    },
    {
      command: "kdb.connections.content.selectView",
      callback: async (viewItem) => {
        const connLabel = viewItem.connLabel;
        if (connLabel) {
          const executorName = viewItem.coreIcon.substring(2);
          executeQuery(
            viewItem.label,
            connLabel,
            executorName,
            "",
            false,
            false,
            true,
          );
        } else {
          notify("Connection label not found", MessageKind.ERROR, {
            logger,
          });
        }
      },
    },
    {
      command: "kdb.connections.add",
      callback: async () => {
        await addNewConnection();
      },
    },
    {
      command: "kdb.connections.edit",
      callback: async (viewItem: KdbNode) => {
        await editConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.add.kdb",
      callback: async (kdbData: ServerDetails, labels: string[]) => {
        await addKdbConnection(kdbData, labels);
      },
    },
    {
      command: "kdb.connections.edit.kdb",
      callback: async (
        kdbData: ServerDetails,
        oldAlias: string,
        editAuth: boolean,
        labels: string[],
      ) => {
        await editKdbConnection(kdbData, oldAlias, editAuth, labels);
      },
    },
    {
      command: "kdb.connections.refresh.serverObjects",
      callback: async () => {
        const runner = Runner.create(async () => ext.serverProvider.reload());
        runner.location = vscode.ProgressLocation.Notification;
        runner.title = "Refreshing server objects for all connections.";
        await runner.execute();
      },
    },
    {
      command: "kdb.connections.labels.add",
      callback: async (name: string, colorName: string) => {
        await createNewLabel(name, colorName);
      },
    },
    {
      command: "kdb.connections.labels.rename",
      callback: async (item) => {
        if (item) {
          const name = await vscode.window.showInputBox({
            prompt: "Enter label name",
            value: item.label,
          });
          if (name) {
            renameLabel(item.label, name);
          }
        }
      },
    },
    {
      command: "kdb.connections.labels.edit",
      callback: async (item) => {
        if (item) {
          const colors = ext.labelColors.map((color) => ({
            label: color.name,
            iconPath: getIconPath(`label-${color.name.toLowerCase()}.svg`),
          }));
          const picked = await vscode.window.showQuickPick(colors, {
            title: "Select label color",
            placeHolder: item.source.color.name,
          });
          if (picked) {
            setLabelColor(item.label, picked.label);
          }
        }
      },
    },
    {
      command: "kdb.connections.labels.delete",
      callback: (item) => {
        if (item) {
          deleteLabel(item.label);
        }
      },
    },
  ];

  return connectionCommands;
}

function registerExecuteCommands(): CommandRegistration[] {
  const editorCommands: CommandRegistration[] = [
    {
      command: "kdb.execute.selectedQuery",
      callback: async () => {
        const editor = vscode.window.activeTextEditor;
        const cell = ext.notebookController.findCell(editor);
        if (cell) {
          await ext.notebookController.executeSelection(editor, cell);
        } else {
          await runActiveEditor(ExecutionTypes.QuerySelection);
        }
      },
    },
    {
      command: "kdb.execute.fileQuery",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.QueryFile);
      },
    },
  ];

  return editorCommands;
}

function registerFileCommands(): CommandRegistration[] {
  const fileCommands: CommandRegistration[] = [
    {
      command: "kdb.file.rename",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          const document = await vscode.workspace.openTextDocument(
            item.resourceUri,
          );
          await vscode.window.showTextDocument(document);
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("renameFile");
        }
      },
    },
    {
      command: "kdb.file.delete",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          const document = await vscode.workspace.openTextDocument(
            item.resourceUri,
          );
          await vscode.window.showTextDocument(document);
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("deleteFile");
        }
      },
    },
    {
      command: "kdb.file.pickConnection",
      callback: async (context?: unknown) => {
        const uri = getActiveFileUri(context);
        if (uri) {
          await pickConnection(uri);
        }
      },
    },
  ];

  return fileCommands;
}

function registerLSCommands(): CommandRegistration[] {
  const lsCommands: CommandRegistration[] = [
    {
      command: "kdb.ls.q.lint",
      callback: async () => {
        const editor = ext.activeTextEditor;
        if (editor) {
          await lintCommand(editor.document);
        }
      },
    },
  ];

  return lsCommands;
}

function registerNotebookCommands(): CommandRegistration[] {
  const notebookCommands: CommandRegistration[] = [
    {
      command: "kdb.createNotebook",
      callback: async () => {
        const notebook = await vscode.workspace.openNotebookDocument(
          "kx-notebook",
          {
            cells: [
              {
                kind: 2,
                value: "",
                languageId: "q",
              },
            ],
          },
        );
        await vscode.window.showNotebookDocument(notebook);
      },
    },
  ];

  return notebookCommands;
}

function registerReplCommands(): CommandRegistration[] {
  const replCommands: CommandRegistration[] = [
    {
      command: "kdb.repl.start",
      callback: () => {
        startRepl();
      },
    },
    {
      command: "kdb.repl.openFolder",
      callback: (uri?: vscode.Uri) => {
        startReplInFolder(uri);
      },
    },
  ];

  return replCommands;
}

function registerAllExtensionCommands(): void {
  const allCommands: CommandRegistration[] = [
    ...registerResultsPanelCommands(),
    ...registerScratchpadCommands(),
    ...registerQueryHistoryCommands(),
    ...registerConnectionsCommands(),
    ...registerExecuteCommands(),
    ...registerFileCommands(),
    ...registerLSCommands(),
    ...registerNotebookCommands(),
    ...registerReplCommands(),
  ];

  allCommands.forEach((command) => {
    ext.context.subscriptions.push(
      vscode.commands.registerCommand(command.command, command.callback),
    );
  });
  connectWorkspaceCommands();
}

export async function deactivate(): Promise<void> {
  if (ext.client) {
    return ext.client.stop();
  }
}
