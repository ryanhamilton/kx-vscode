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
import { BuiltinServer } from "./classes/builtinServer";
import { OPEN_RESULTS_HINT } from "./classes/connectionConsole";
import { connectBuildTools, lintCommand } from "./commands/buildToolsCommand";
import { connectClientCommands } from "./commands/clientCommand";
import { convertDataSources } from "./commands/queryCommand";
import {
  activeConnection,
  addAuthConnection,
  addInsightsConnection,
  addKdbConnection,
  addNewConnection,
  connect,
  copyQuery,
  disconnect,
  editConnection,
  editInsightsConnection,
  editKdbConnection,
  enableTLS,
  executeQuery,
  exportConnections,
  importConnections,
  openMeta,
  refreshGetMeta,
  removeConnection,
  rerunQuery,
  resetScratchpad,
} from "./commands/serverCommand";
import { installKdbX, showWelcome } from "./commands/setupCommand";
import {
  ConnectionLensProvider,
  connectWorkspaceCommands,
  getActiveFileUri,
  pickConnection,
  pickTarget,
  pickTimeout,
  resetScratchpadFromEditor,
  runActiveEditor,
  setServerForUri,
  startRepl,
  startReplInFolder,
} from "./commands/workspaceCommand";
import { ext } from "./extensionVariables";
import { CommandRegistration } from "./models/commandRegistration";
import {
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
} from "./models/connectionsModels";
import { ExecutionTypes } from "./models/execution";
import { createDefaultQueryFile } from "./models/query";
import { QueryResult } from "./models/queryResult";
import { ChartEditorProvider } from "./services/chartEditorProvider";
import { CompletionProvider } from "./services/completionProvider";
import { DataSourceConverterProvider } from "./services/dataSourceConverterProvider";
import { HelpFeedbackProvider } from "./services/helpFeedbackProvider";
import {
  InsightsMetaNode,
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  MetaObjectPayloadNode,
} from "./services/kdbTreeProvider";
import { KxNotebookController } from "./services/notebookController";
import {
  inputVariable,
  KxNotebookTargetActionProvider,
  trackNotebookOnRepl,
  trackNotebookRowLimit,
  pickRowLimit,
  pickRowLimitFrom,
  ROW_LIMIT_PRESETS,
} from "./services/notebookProviders";
import { KxNotebookSerializer } from "./services/notebookSerializer";
import { QueryEditorProvider } from "./services/queryEditorProvider";
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
  BUILTIN_ALIAS,
  bundledQ,
  checkLocalInstall,
  checkOpenSslInstalled,
  getInsights,
  getServers,
  hasWorkspaceOrShowOption,
} from "./utils/core";
import { getIconPath } from "./utils/iconsUtils";
import {
  DEFER_CONTEXT,
  importableKeys,
  offerImportFromKx,
  promptDeferToKx,
  runImportFromKx,
  shouldDeferToKx,
  showDeferStatus,
} from "./utils/kxCompat";
import { MessageKind, notify, Runner } from "./utils/notifications";
import AuthSettings from "./utils/secretStorage";
import { ExtensionTelemetry } from "./utils/telemetryClient";
import { addWorkspaceFile, openWith, setUriContent } from "./utils/workspace";

const logger = "extension";

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  ext.context = context;
  ext.outputChannel = vscode.window.createOutputChannel("peachq", {
    log: true,
  });
  ext.openSslVersion = await checkOpenSslInstalled();

  const extensionPackage = context.extension.packageJSON;
  const extensionVersion = extensionPackage.version || "unknown";

  const isRCExtension = extensionVersion.includes("rc");
  const enableTelemetry = isRCExtension
    ? false
    : vscode.workspace.getConfiguration("telemetry").get("telemetryLevel") !==
      "off";

  ext.telemetry = new ExtensionTelemetry(enableTelemetry);

  const deferring = shouldDeferToKx();
  vscode.commands.executeCommand("setContext", DEFER_CONTEXT, deferring);

  getWorkspaceLabelsConnMap();
  getWorkspaceLabels();

  // clear necessary contexts
  vscode.commands.executeCommand(
    "setContext",
    "peachq.connected.active",
    false,
  );
  vscode.commands.executeCommand("setContext", "peachq.pythonEnabled", false);
  vscode.commands.executeCommand("setContext", "peachq.connected", []);
  vscode.commands.executeCommand("setContext", "peachq.kdbQHCopyList", []);

  const bundled = bundledQ();
  if (bundled) {
    ext.builtinServer = new BuiltinServer(
      bundled,
      context.globalStorageUri.fsPath,
    );
  }
  vscode.commands.executeCommand(
    "setContext",
    "peachq.builtinNodes",
    bundled ? [BUILTIN_ALIAS] : [],
  );

  const servers: Server | undefined = getServers();
  const insights: Insights | undefined = getInsights();

  ext.serverProvider = new KdbTreeProvider(servers!, insights!);
  ext.queryHistoryProvider = new QueryHistoryProvider();
  ext.resultsViewProvider = new KdbResultsViewProvider(
    ext.context.extensionUri,
  );
  ext.scratchpadTreeProvider = new WorkspaceTreeProvider(
    "**/*.kdb.{q,py,sql}",
    "scratchpad",
  );
  ext.queryTreeProvider = new WorkspaceTreeProvider(
    "**/*.kxquery",
    "datasource",
  );

  vscode.commands.executeCommand("setContext", "peachq.QHOME", env.QHOME);

  vscode.window.registerTreeDataProvider("peachq-servers", ext.serverProvider);

  vscode.window.registerTreeDataProvider(
    "peachq-query-history",
    ext.queryHistoryProvider,
  );
  vscode.window.registerTreeDataProvider(
    "peachq-scratchpad-explorer",
    ext.scratchpadTreeProvider,
  );
  vscode.window.registerTreeDataProvider(
    "peachq-query-explorer",
    ext.queryTreeProvider,
  );

  vscode.window.registerTreeDataProvider(
    "peachq-help-feedback-view",
    new HelpFeedbackProvider(),
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

    QueryEditorProvider.register(context),
    DataSourceConverterProvider.register(),
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
      if (event.affectsConfiguration("peachq.connectionMap")) {
        ext.queryTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
      }
      if (event.affectsConfiguration("peachq.connectionLabelsMap")) {
        ext.serverProvider.reload();
      }
      if (event.affectsConfiguration("peachq.connectionLabels")) {
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
      "peachq-notebook",
      new KxNotebookSerializer(),
    ),
    (ext.notebookController = new KxNotebookController()),
  );

  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      "peachq-notebook",
      new KxNotebookTargetActionProvider(),
    ),
  );

  // Track the last-focused KX target terminal (REPL or connection console) as
  // the active execution target for unassigned files.
  context.subscriptions.push(initActiveTargetTracking());
  context.subscriptions.push(trackNotebookOnRepl());
  context.subscriptions.push(trackNotebookRowLimit());

  // Make the peachq Results view discoverable from a connection console: the
  // console prints an "Open peachq Results View" hint, which this provider turns
  // into a clickable link (terminals disallow command: hyperlinks directly)
  // that reveals the peachq Results view in the bottom panel.
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
          tooltip: "Open peachq Results View",
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
        notebook: { notebookType: "peachq-notebook" },
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
    "peachq LangServer",
    "peachq Language Server",
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    client.onNotification("notify", (params) =>
      notify(params.message, params.kind, params.options),
    ),
  );

  if (!deferring) {
    await client.start();
  }
  connectClientCommands(context, client);
  await connectBuildTools();

  const yamlExtension = vscode.extensions.getExtension("redhat.vscode-yaml");
  if (yamlExtension) {
    const actualSchema = await vscode.workspace
      .getConfiguration()
      .get("yaml.schemas");
    const schemaJSON = {
      "https://code.kx.com/insights/enterprise/packaging/schemas/pipeline.json":
        "*pipelines/*.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/table.json":
        "tables/*.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/deploymentconfig.json":
        "deployment_config.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/router.json":
        "router.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/shard.json":
        "*shard.yaml",
    };
    Object.assign(actualSchema ? actualSchema : {}, schemaJSON);
    await yamlExtension.activate().then(() => {
      vscode.workspace
        .getConfiguration()
        .update(
          "yaml.schemas",
          actualSchema,
          vscode.ConfigurationTarget.Global,
        );
    });
  }
  const authExtension = vscode.extensions.getExtension("KX.kdb-auth");
  if (authExtension) {
    const api = await authExtension.activate();
    if ("auth" in api) {
      notify("Custom authentication activated.", MessageKind.DEBUG, {
        logger,
        telemetry: "Extension.CustomAuth.Activated",
      });
      ext.customAuth = api;
    }
  }

  if (deferring) {
    context.subscriptions.push(showDeferStatus());
    promptDeferToKx(context.workspaceState);
  } else {
    setTimeout(() => {
      checkLocalInstall();
    }, 500);
    offerImportFromKx(
      context.globalState,
      importableKeys(extensionPackage),
      refreshImportedConnections,
    );
  }

  notify("peachq extension is now active.", MessageKind.DEBUG, {
    logger,
    telemetry: "Extension.Activated",
  });

  return { deferringToKx: deferring };
}

function refreshImportedConnections() {
  getWorkspaceLabelsConnMap();
  getWorkspaceLabels();
  ext.serverProvider.refresh(getServers());
  ext.serverProvider.refreshInsights(getInsights());
}

function registerSetupCommands(): CommandRegistration[] {
  const setupCommands: CommandRegistration[] = [
    { command: "peachq.show.welcome", callback: () => showWelcome() },
    { command: "peachq.install.kdbx", callback: () => installKdbX() },
  ];

  return setupCommands;
}

function registerHelpCommands(): CommandRegistration[] {
  const helpCommands: CommandRegistration[] = [
    {
      command: "peachq.help.openDocumentation",
      callback: () => {
        vscode.commands
          .executeCommand(
            "workbench.extensions.action.showExtensionDetails",
            "timestored.peachq",
          )
          .then(undefined, () => {
            notify("Help&Feedback documentation selected.", MessageKind.DEBUG, {
              logger,
              telemetry: "Help.Open.Documentation",
            });
            vscode.commands.executeCommand(
              "extension.open",
              "timestored.peachq",
            );
          });
      },
    },
    {
      command: "peachq.help.suggestFeature",
      callback: () => {
        notify("Help&Feedback suggest a feature selected.", MessageKind.DEBUG, {
          logger,
          telemetry: "Help.Open.SuggestFeature",
        });
        vscode.env.openExternal(vscode.Uri.parse(ext.urlLinks.suggestFeature));
      },
    },
    {
      command: "peachq.help.reportBug",
      callback: () => {
        notify("Help&Feedback report a bug selected.", MessageKind.DEBUG, {
          logger,
          telemetry: "Help.Open.ReportBug",
        });
        vscode.env.openExternal(vscode.Uri.parse(ext.urlLinks.reportBug));
      },
    },
  ];

  return helpCommands;
}

function registerResultsPanelCommands(): CommandRegistration[] {
  const resultsCommands: CommandRegistration[] = [
    {
      command: "peachq.resultsPanel.update",
      callback: (
        results: any,
        isInsights: boolean,
        connVersion?: string,
        isPython?: boolean,
        quiet?: boolean,
      ) => {
        ext.resultsViewProvider.updateResults(
          results,
          isInsights,
          connVersion,
          isPython,
          quiet,
        );
      },
    },
    {
      command: "peachq.resultsPanel.clear",
      callback: () => ext.resultsViewProvider.updateResults(""),
    },
    {
      command: "peachq.resultsPanel.export.csv",
      callback: () => ext.resultsViewProvider.exportToCsv(),
    },
    {
      // Hidden: results always reach the console now.
      command: "peachq.results.destination.terminal",
      callback: () => undefined,
    },
    {
      command: "peachq.results.destination.view",
      callback: () =>
        vscode.commands.executeCommand(
          `${KdbResultsViewProvider.viewType}.focus`,
        ),
    },
  ];

  return resultsCommands;
}

function registerQueryCommands(): CommandRegistration[] {
  const queryCommands: CommandRegistration[] = [
    {
      command: "peachq.query.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding queries")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "query",
            ".kxquery",
          );
          await vscode.workspace.openTextDocument(uri);
          await setUriContent(
            uri,
            JSON.stringify(createDefaultQueryFile(), null, 2),
          );
          await openWith(uri, QueryEditorProvider.viewType);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "peachq.query.convert",
      callback: async () => await convertDataSources(),
    },
    {
      command: "peachq.query.refresh",
      callback: () => ext.queryTreeProvider.reload(),
    },
  ];

  return queryCommands;
}

function registerScratchpadCommands(): CommandRegistration[] {
  const scratchpadCommands: CommandRegistration[] = [
    {
      command: "peachq.scratchpad.run",
      callback: async () => {
        await runActiveEditor();
      },
    },
    {
      command: "peachq.scratchpad.reset",
      callback: async (viewItem?: InsightsNode) => {
        const connLabel = viewItem ? viewItem.label : undefined;
        await resetScratchpad(connLabel);
      },
    },
    {
      command: "peachq.scratchpad.editor.reset",
      callback: async () => {
        await resetScratchpadFromEditor();
      },
    },
    {
      command: "peachq.scratchpad.create",
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
      command: "peachq.scratchpad.python.run",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQuerySelection);
      },
    },
    {
      command: "peachq.scratchpad.python.run.file",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQueryFile);
      },
    },
    {
      command: "peachq.scratchpad.python.create",
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
      command: "peachq.scratchpad.sql.create",
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
      command: "peachq.scratchpad.explorer.refresh",
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
      command: "peachq.queryHistory.clear",
      callback: () => {
        ext.kdbQueryHistoryList.length = 0;
        ext.kdbQueryHistoryNodes.length = 0;
        ext.queryHistoryProvider.refresh();
      },
    },
    {
      command: "peachq.queryHistory.rerun",
      callback: async (viewItem: QueryHistoryTreeItem) => {
        rerunQuery(viewItem.details);
      },
    },
    {
      command: "peachq.queryHistory.copyQuery",
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
      command: "peachq.importFromKx",
      callback: () =>
        runImportFromKx(
          importableKeys(ext.context.extension.packageJSON),
          refreshImportedConnections,
        ),
    },
    {
      command: "peachq.connections.connect",
      callback: async (viewItem?: KdbNode | InsightsNode) => {
        if (!viewItem?.label) {
          return;
        }
        await connect(viewItem.label);
      },
    },
    {
      command: "peachq.connections.connect.via.dialog",
      callback: async (connLabel: string) => {
        await connect(connLabel);
      },
    },
    {
      command: "peachq.connections.setActive",
      callback: async (viewItem?: KdbNode) => {
        if (!viewItem) {
          return;
        }
        activeConnection(viewItem);
      },
    },
    {
      command: "peachq.connections.addAuthentication",
      callback: async (viewItem?: KdbNode) => {
        if (!viewItem?.children?.[0]) {
          return;
        }
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
      command: "peachq.connections.enableTLS",
      callback: async (viewItem?: KdbNode) => {
        if (!viewItem?.children?.[0]) {
          return;
        }
        await enableTLS(viewItem.children[0]);
      },
    },
    {
      command: "peachq.connections.remove.insights",
      callback: async (viewItem?: InsightsNode) => {
        if (!viewItem) {
          return;
        }
        await removeConnection(viewItem);
      },
    },
    {
      command: "peachq.connections.remove.kdb",
      callback: async (viewItem?: KdbNode) => {
        if (!viewItem) {
          return;
        }
        await removeConnection(viewItem);
      },
    },
    {
      command: "peachq.connections.disconnect",
      callback: async (viewItem?: InsightsNode | KdbNode | string) => {
        const connLabel =
          typeof viewItem === "string" ? viewItem : viewItem?.label;
        if (!connLabel) {
          return;
        }
        await disconnect(connLabel);
      },
    },
    {
      command: "peachq.connections.export.all",
      callback: () => {
        notify("Export all conections.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connection.Export.All",
        });
        exportConnections();
      },
    },
    {
      command: "peachq.connections.export.single",
      callback: async (viewItem?: KdbNode | InsightsNode) => {
        if (!viewItem?.label) {
          return;
        }
        notify("Export single conection.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connection.Export.Single",
        });
        exportConnections(viewItem.label);
      },
    },
    {
      command: "peachq.connections.import",
      callback: async () => {
        notify("Import conections.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connection.Import",
        });
        await importConnections();
      },
    },
    {
      command: "peachq.connections.content.selectView",
      callback: async (viewItem) => {
        const connLabel = viewItem?.connLabel;
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
      command: "peachq.connections.open.meta",
      callback: async (viewItem?: InsightsMetaNode | MetaObjectPayloadNode) => {
        if (!viewItem) {
          return;
        }
        await openMeta(viewItem);
      },
    },
    {
      command: "peachq.connections.add",
      callback: async () => {
        await addNewConnection();
      },
    },
    {
      command: "peachq.connections.edit",
      callback: async (viewItem?: KdbNode | InsightsNode) => {
        if (!viewItem) {
          return;
        }
        await editConnection(viewItem);
      },
    },
    {
      command: "peachq.connections.add.insights",
      callback: async (insightsData: InsightDetails, labels: string[]) => {
        await addInsightsConnection(insightsData, labels);
      },
    },
    {
      command: "peachq.connections.add.kdb",
      callback: async (kdbData: ServerDetails, labels: string[]) => {
        await addKdbConnection(kdbData, labels);
      },
    },
    {
      command: "peachq.connections.edit.insights",
      callback: async (
        insightsData: InsightDetails,
        oldAlias: string,
        labels: string[],
      ) => {
        await editInsightsConnection(insightsData, oldAlias, labels);
      },
    },
    {
      command: "peachq.connections.edit.kdb",
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
      command: "peachq.connections.refresh.serverObjects",
      callback: async () => {
        const runner = Runner.create(() => {
          ext.serverProvider.reload();
          return refreshGetMeta();
        });
        runner.location = vscode.ProgressLocation.Notification;
        runner.title = "Refreshing server objects for all connections.";
        await runner.execute();
      },
    },
    {
      command: "peachq.connections.refresh.meta",
      callback: async (viewItem?: InsightsNode) => {
        const runner = Runner.create(() => refreshGetMeta(viewItem?.label));
        runner.location = vscode.ProgressLocation.Notification;
        runner.title = `Refreshing meta data for ${viewItem?.label || "all connections"}.`;
        await runner.execute();
      },
    },
    {
      command: "peachq.connections.labels.add",
      callback: async (name: string, colorName: string) => {
        await createNewLabel(name, colorName);
      },
    },
    {
      command: "peachq.connections.labels.rename",
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
      command: "peachq.connections.labels.edit",
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
      command: "peachq.connections.labels.delete",
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
      command: "peachq.execute.selectedQuery",
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
      command: "peachq.execute.fileQuery",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.QueryFile, true);
      },
    },
  ];

  return editorCommands;
}

function registerFileCommands(): CommandRegistration[] {
  const fileCommands: CommandRegistration[] = [
    {
      command: "peachq.file.rename",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          if (item.resourceUri.path.endsWith(".kxquery")) {
            await openWith(item.resourceUri, QueryEditorProvider.viewType);
          } else {
            const document = await vscode.workspace.openTextDocument(
              item.resourceUri,
            );
            await vscode.window.showTextDocument(document);
          }
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("renameFile");
        }
      },
    },
    {
      command: "peachq.file.delete",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          if (item.resourceUri.path.endsWith(".kxquery")) {
            await openWith(item.resourceUri, QueryEditorProvider.viewType);
          } else {
            const document = await vscode.workspace.openTextDocument(
              item.resourceUri,
            );
            await vscode.window.showTextDocument(document);
          }
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("deleteFile");
        }
      },
    },
    {
      command: "peachq.file.pickConnection",
      callback: async (context?: unknown) => {
        const uri = getActiveFileUri(context);
        if (uri) {
          await pickConnection(uri);
        }
      },
    },
    {
      command: "peachq.file.pickTarget",
      callback: async (cell?: vscode.NotebookCell) => {
        const uri = cell ? cell.notebook.uri : getActiveFileUri();
        if (uri) {
          await pickTarget(uri, cell);
        }
      },
    },
    {
      command: "peachq.file.pickTimeout",
      callback: async () => {
        const uri = getActiveFileUri();
        if (uri) {
          await pickTimeout(uri);
        }
      },
    },
    {
      command: "peachq.file.inputVariable",
      callback: async (cell: vscode.NotebookCell) => {
        await inputVariable(cell);
      },
    },
    {
      command: "peachq.file.populateScratchpad",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PopulateScratchpad);
      },
    },
  ];

  return fileCommands;
}

function registerLSCommands(): CommandRegistration[] {
  const lsCommands: CommandRegistration[] = [
    {
      command: "peachq.ls.q.lint",
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
      command: "peachq.createNotebook",
      callback: async () => {
        const notebook = await vscode.workspace.openNotebookDocument(
          "peachq-notebook",
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
    // The toolbar shows the current setting as the button label, so each
    // value has its own command; they all open the same picker.
    ...["peachq.notebook.rowLimit"]
      .concat(
        ROW_LIMIT_PRESETS.map((limit) => `peachq.notebook.rowLimit.${limit}`),
      )
      .map((command) => ({ command, callback: () => pickRowLimit() })),
    ...["first", "last"].map((from) => ({
      command: `peachq.notebook.rowLimitFrom.${from}`,
      callback: () => pickRowLimitFrom(),
    })),
  ];

  return notebookCommands;
}

function registerReplCommands(): CommandRegistration[] {
  const replCommands: CommandRegistration[] = [
    {
      command: "peachq.repl.start",
      callback: () => {
        startRepl();
      },
    },
    {
      command: "peachq.repl.openFolder",
      callback: (uri?: vscode.Uri) => {
        startReplInFolder(uri);
      },
    },
  ];

  return replCommands;
}

function registerAllExtensionCommands(): void {
  const allCommands: CommandRegistration[] = [
    ...registerSetupCommands(),
    ...registerHelpCommands(),
    ...registerResultsPanelCommands(),
    ...registerQueryCommands(),
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
  ext.builtinServer?.stop();
  await ext.telemetry.dispose();

  if (ext.client) {
    return ext.client.stop();
  }
}
// Modified by peachq contributors; see NOTICE.
