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

import * as fs from "fs";
import {
  CancellationToken,
  Position,
  Range,
  commands,
  window,
  workspace,
  env,
} from "vscode";

import { ext } from "../extensionVariables";
import {
  ExportedConnections,
  Server,
  ServerDetails,
  ServerType,
} from "../models/connectionsModels";
import { ExecutionTypes } from "../models/execution";
import { QueryHistory } from "../models/queryHistory";
import { queryConstants } from "../models/queryResult";
import { NewConnectionPannel } from "../panels/newConnection";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { KdbNode } from "../services/kdbTreeProvider";
import { handleLabelsConnMap, removeConnFromLabels } from "../utils/connLabel";
import {
  checkOpenSslInstalled,
  getKeyForServerName,
  getServers,
  offerReconnectionAfterEdit,
  updateServers,
} from "../utils/core";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { MessageKind, Runner, notify } from "../utils/notifications";
import { writePlotToFile } from "../utils/plotUtils";
import {
  addQueryHistory,
  BLOCK_COMMENT_PATTERN,
  resultToBase64,
  getSQLWrapper,
} from "../utils/queryUtils";
import { openUrl } from "../utils/uriUtils";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
} from "../validators/kdbValidator";

const logger = "serverCommand";

export async function addNewConnection(): Promise<void> {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri);
}

export async function editConnection(viewItem: KdbNode) {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri, viewItem);
}

export function isConnected(connLabel: string): boolean {
  const connMngService = new ConnectionManagementService();
  return connMngService.isConnected(connLabel);
}

export async function addAuthConnection(
  serverKey: string,
  username: string,
  password: string,
): Promise<void> {
  /* c8 ignore start */
  const validUsername = validateServerUsername(username);
  if (validUsername) {
    notify(validUsername, MessageKind.ERROR, { logger });
    return;
  }
  if (password?.trim()?.length) {
    const servers: Server | undefined = getServers();
    // store secrets
    if (
      (username != undefined || username != "") &&
      servers &&
      servers[serverKey]
    ) {
      servers[serverKey].auth = true;
      ext.secretSettings.storeAuthData(serverKey, `${username}:${password}`);
      await updateServers(servers);
      const newServers = getServers();
      if (newServers != undefined) {
        ext.serverProvider.refresh(newServers);
      }
    }
  }
  /* c8 ignore stop */
}

function removeAuthConnection(serverKey: string) {
  /* c8 ignore start */
  if (
    Object.prototype.hasOwnProperty.call(
      ext.secretSettings.storeAuthData,
      serverKey,
    )
  ) {
    delete (ext.secretSettings.storeAuthData as { [key: string]: any })[
      serverKey
    ];
  }
  /* c8 ignore stop */
}

export function updateAuthDataKey(oldServerKey: string, newServerKey: string) {
  /* c8 ignore start */
  const storeAuthData = ext.secretSettings.storeAuthData as {
    [key: string]: any;
  };

  if (Object.prototype.hasOwnProperty.call(storeAuthData, newServerKey)) {
    notify(
      `Auth data already exists for key: ${newServerKey}`,
      MessageKind.ERROR,
      { logger },
    );
    return;
  }

  storeAuthData[newServerKey] = storeAuthData[oldServerKey];
  delete storeAuthData[oldServerKey];

  return;
  /* c8 ignore stop */
}

export function handleEditAuthData(
  oldServerKey: string,
  newServerKey: string,
  editAuth: boolean,
  isAuth?: boolean,
  username?: string,
  password?: string,
) {
  /* c8 ignore start */
  if (editAuth) {
    removeAuthConnection(oldServerKey);
    if (isAuth && username !== "" && password !== "") {
      addAuthConnection(newServerKey, username!, password!);
      return;
    }
  } else if (oldServerKey !== newServerKey) {
    updateAuthDataKey(oldServerKey, newServerKey);
  }
  /* c8 ignore stop */
}

export async function enableTLS(serverKey: string): Promise<void> {
  const servers: Server | undefined = getServers();

  // validate if TLS is possible
  if (ext.openSslVersion === null) {
    notify(
      "OpenSSL not found, please ensure this is installed",
      MessageKind.ERROR,
      { logger },
      "More Info",
      "Cancel",
    ).then(async (result) => {
      if (result === "More Info") {
        await openUrl("https://code.kx.com/q/kb/ssl/");
      }
    });
    return;
  }
  if (servers && servers[serverKey]) {
    servers[serverKey].tls = true;
    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      ext.serverProvider.refresh(newServers);
    }
    return;
  }
  notify(
    "Server not found, please ensure this is a correct server",
    MessageKind.ERROR,
    { logger },
    "Cancel",
  );
}

export async function addKdbConnection(
  kdbData: ServerDetails,
  labels?: string[],
): Promise<void> {
  const aliasValidation = validateServerAlias(kdbData.serverAlias);
  const hostnameValidation = validateServerName(kdbData.serverName);
  const portValidation = validateServerPort(kdbData.serverPort);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (hostnameValidation) {
    notify(hostnameValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (portValidation) {
    notify(portValidation, MessageKind.ERROR, { logger });
    return;
  }
  let servers: Server | undefined = getServers();

  if (
    servers != undefined &&
    servers[getKeyForServerName(kdbData.serverAlias || "")]
  ) {
    notify(
      `Server name ${kdbData.serverAlias} already exists.`,
      MessageKind.ERROR,
      { logger },
    );
  } else {
    const key = kdbData.serverAlias || "";
    if (servers === undefined) {
      servers = {
        key: {
          auth: kdbData.auth,
          serverName: kdbData.serverName,
          serverPort: kdbData.serverPort,
          serverAlias: kdbData.serverAlias,
          tls: kdbData.tls,
        },
      };
    } else {
      servers[key] = {
        auth: kdbData.auth,
        serverName: kdbData.serverName,
        serverPort: kdbData.serverPort,
        serverAlias: kdbData.serverAlias,
        tls: kdbData.tls,
      };
    }

    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      ext.latestLblsChanged.length = 0;
      if (labels && labels.length > 0) {
        ext.latestLblsChanged.push(...labels);
        await handleLabelsConnMap(labels, kdbData.serverAlias);
      }
      notify("Created kdb connection.", MessageKind.DEBUG, {
        logger,
      });
      ext.serverProvider.refresh(newServers);
    }
    if (kdbData.auth) {
      addAuthConnection(key, kdbData.username!, kdbData.password!);
    }

    notify(`Added kdb connection: ${kdbData.serverAlias}`, MessageKind.INFO, {
      logger,
    });

    NewConnectionPannel.close();
  }
}

export async function editKdbConnection(
  kdbData: ServerDetails,
  oldAlias: string,
  editAuth?: boolean,
  labels?: string[],
) {
  /* c8 ignore start */
  const aliasValidation =
    oldAlias === kdbData.serverAlias
      ? undefined
      : validateServerAlias(kdbData.serverAlias);
  const hostnameValidation = validateServerName(kdbData.serverName);
  const portValidation = validateServerPort(kdbData.serverPort);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (hostnameValidation) {
    notify(hostnameValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (portValidation) {
    notify(portValidation, MessageKind.ERROR, { logger });
    return;
  }
  const isConnectedConn = isConnected(oldAlias);
  await disconnect(oldAlias);
  const servers: Server | undefined = getServers();

  if (servers) {
    const oldServer = servers[getKeyForServerName(oldAlias)];
    const newAliasExists =
      oldAlias !== kdbData.serverAlias
        ? servers[getKeyForServerName(kdbData.serverAlias)]
        : undefined;
    if (newAliasExists) {
      notify(
        `KDB instance named ${kdbData.serverAlias} already exists.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    } else {
      if (!oldServer) {
        notify(
          `KDB instance named ${oldAlias} does not exist.`,
          MessageKind.ERROR,
          { logger },
        );
        return;
      } else {
        const oldKey = getKeyForServerName(oldAlias);
        removeConnFromLabels(oldKey);
        const newKey = kdbData.serverAlias;
        const removedAuth =
          editAuth && (kdbData.username === "" || kdbData.password === "");
        if (servers[oldKey] && oldAlias !== kdbData.serverAlias) {
          const uServers = Object.keys(servers).filter((server) => {
            return server !== oldKey;
          });
          const updatedServers: Server = {};
          uServers.forEach((server) => {
            updatedServers[server] = servers[server];
          });

          updatedServers[newKey] = {
            auth:
              editAuth === false
                ? oldServer.auth
                : removedAuth
                  ? false
                  : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            tls: kdbData.tls,
          };

          await updateServers(updatedServers);
        } else {
          servers[oldKey] = {
            auth:
              editAuth === false
                ? oldServer.auth
                : removedAuth
                  ? false
                  : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            tls: kdbData.tls,
          };

          await updateServers(servers);
        }
        const newServers = getServers();
        if (newServers != undefined) {
          ext.latestLblsChanged.length = 0;
          if (labels && labels.length > 0) {
            ext.latestLblsChanged.push(...labels);
            await handleLabelsConnMap(labels, kdbData.serverAlias);
          } else {
            removeConnFromLabels(kdbData.serverAlias);
          }
          ext.serverProvider.refresh(newServers);
          notify("Edited kdb connection.", MessageKind.DEBUG, {
            logger,
          });
          const connLabelToReconn = `${kdbData.serverName}:${kdbData.serverPort} [${kdbData.serverAlias}]`;
          if (isConnectedConn) {
            offerReconnectionAfterEdit(connLabelToReconn);
          }
        }

        notify(
          `Edited KDB connection: ${kdbData.serverAlias}`,
          MessageKind.INFO,
          { logger },
        );
        handleEditAuthData(
          oldKey,
          newKey,
          editAuth ?? false,
          kdbData.auth,
          kdbData.username,
          kdbData.password,
        );

        NewConnectionPannel.close();
      }
    }
  }
  /* c8 ignore stop */
}

export async function importConnections() {
  /* c8 ignore start */
  const options = {
    canSelectMany: false,
    openLabel: "Select JSON File",
    filters: {
      "JSON Files": ["json"],
      "All Files": ["*"],
    },
  };

  const fileUri = await window.showOpenDialog(options);
  if (!fileUri || fileUri.length === 0) {
    notify("No file selected.", MessageKind.ERROR, { logger });
    return;
  }
  const filePath = fileUri[0].fsPath;
  const fileContent = fs.readFileSync(filePath, "utf8");

  let importedConnections: ExportedConnections;
  try {
    importedConnections = JSON.parse(fileContent);
  } catch {
    notify("Invalid JSON format.", MessageKind.ERROR, { logger });
    return;
  }

  if (!isValidExportedConnections(importedConnections)) {
    notify("JSON does not match the required format.", MessageKind.ERROR, {
      logger,
    });
    return;
  }
  if (importedConnections.connections.KDB.length === 0) {
    notify(
      "There are no kdb connections to import in this JSON file.",
      MessageKind.ERROR,
      { logger },
    );
    return;
  }
  await addImportedConnections(importedConnections);
  /* c8 ignore stop */
}

export async function addImportedConnections(
  importedConnections: ExportedConnections,
) {
  const connMangService = new ConnectionManagementService();
  const existingAliases = connMangService.retrieveListOfConnectionsNames();
  const localAlreadyExists = existingAliases.has("local");

  const hasDuplicates = importedConnections.connections.KDB.some((connection) =>
    existingAliases.has(
      connMangService.checkConnAlias(
        connection.serverAlias,
        localAlreadyExists,
      ),
    ),
  );

  let res: "Duplicate" | "Overwrite" | "Cancel" | undefined = "Duplicate";
  if (hasDuplicates) {
    res = await notify(
      "You are importing connections with the same name. Would you like to duplicate, overwrite or cancel the import?",
      MessageKind.INFO,
      {},
      "Duplicate",
      "Overwrite",
      "Cancel",
    );
    if (!res || res === "Cancel") {
      return;
    }
  }

  let counter = 1;
  const servers: ServerDetails[] = [];
  for (const connection of importedConnections.connections.KDB) {
    let alias = connMangService.checkConnAlias(
      connection.serverAlias,
      localAlreadyExists,
    );

    if (res === "Overwrite") {
      servers.push(connection);
    } else {
      while (existingAliases.has(alias)) {
        alias = `${connection.serverAlias}-${counter}`;
        counter++;
      }
      connection.serverAlias = alias;
      await addKdbConnection(connection);
    }
    existingAliases.add(alias);
    counter = 1;
  }

  if (servers.length > 0) {
    const config = servers.reduce((config, connection) => {
      config[connection.serverAlias] = connection;
      return config;
    }, getServers() || {});
    await updateServers(config);
    ext.serverProvider.refresh(config);
  }

  notify("Connections imported successfully.", MessageKind.INFO, {
    logger,
  });
}

export async function removeConnection(viewItem: KdbNode) {
  notify(
    `You are going to remove ${viewItem.label}, would you like to proceed?`,
    MessageKind.WARNING,
    {},
    "Proceed",
    "Cancel",
  ).then(async (result) => {
    if (result === "Proceed") {
      const connMngService = new ConnectionManagementService();
      removeConnFromLabels(viewItem.details.serverAlias);
      await connMngService.removeConnection(viewItem);
    }
  });
}

export async function connect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  ExecutionConsole.start();
  const viewItem = connMngService.retrieveConnection(connLabel);
  if (viewItem === undefined) {
    notify("Connection not found.", MessageKind.ERROR, { logger });
    return;
  }

  const isKdbNode = viewItem instanceof KdbNode;
  if (isKdbNode) {
    // check for TLS support
    if (viewItem.details.tls) {
      if (!(await checkOpenSslInstalled())) {
        notify(
          "TLS support requires OpenSSL to be installed.",
          MessageKind.INFO,
          { logger },
          "More Info",
          "Cancel",
        ).then(async (result) => {
          if (result === "More Info") {
            await openUrl("https://code.kx.com/q/kb/ssl/");
          }
        });
      }
    }
  }

  await connMngService.connect(viewItem.label);

  if (isKdbNode && viewItem.details.tls) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  }

  ext.serverProvider.reload();
}

export function activeConnection(viewItem: KdbNode): void {
  const connMngService = new ConnectionManagementService();
  connMngService.setActiveConnection(viewItem);
  ext.serverProvider.reload();
}

export async function disconnect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  connMngService.disconnect(connLabel);

  if (ext.connectedConnectionList.length === 0) {
    ExecutionConsole.current?.dispose();
    ext.serverProvider.reload();
  }
}

export async function executeQuery(
  query: string,
  connLabel: string,
  executorName: string,
  context: string,
  isPython: boolean,
  isWorkbook: boolean,
  isFromConnTree?: boolean,
  token?: CancellationToken,
  timeout?: number,
  requestID?: string,
): Promise<any> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (connLabel === "") {
    if (ext.activeConnection === undefined) {
      return undefined;
    } else {
      connLabel = ext.activeConnection.connLabel;
    }
  }
  const isConnected = connMngService.isConnected(connLabel);
  if (!isConnected) {
    notify(`Connection ${connLabel} is not connected.`, MessageKind.ERROR, {
      logger,
    });
    return undefined;
  }

  const isInsights = false;

  if (query.length === 0) {
    notify("Empty query.", MessageKind.DEBUG, {
      logger,
    });
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      connLabel,
      executorName,
      isConnected,
      isInsights,
      isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
      isPython,
      false,
      undefined,
      isFromConnTree,
    );
    return undefined;
  }
  const isNotebook = executorName.endsWith(".kxnb");
  const isStringfy = isNotebook ? false : !ext.isResultsTabVisible;
  const startTime = Date.now();
  const results = await connMngService.executeQuery(
    query,
    connLabel,
    context,
    isStringfy,
    isPython,
  );
  const endTime = Date.now();
  const duration = (endTime - startTime).toString();

  if (token?.isCancellationRequested) {
    return undefined;
  }

  if (isNotebook) {
    return results;
  } else {
    /* c8 ignore start */
    if (ext.isResultsTabVisible) {
      const data = resultToBase64(results);
      if (data) {
        await writeQueryResultsToPlot(
          data,
          query,
          connLabel,
          executorName,
          isInsights,
          isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
          isPython,
          duration,
          isFromConnTree,
        );
      } else {
        await writeQueryResultsToView(
          results,
          query,
          connLabel,
          executorName,
          isInsights,
          isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
          isPython,
          duration,
          isFromConnTree,
        );
      }
    } else {
      await writeQueryResultsToConsole(
        results,
        query,
        connLabel,
        executorName,
        isInsights,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
        isFromConnTree,
      );
    }
    /* c8 ignore stop */
  }
}

// matches '\d .foo' or 'system "d .foo"'
const CONTEXT_PATTERN = /^(system[\t ]*"d|\\d)[\t ]+([^\s"]+)/gm;

function withoutBlockComments(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(BLOCK_COMMENT_PATTERN, "");
}

export function contextAbove(text: string): string {
  const matches = [...withoutBlockComments(text).matchAll(CONTEXT_PATTERN)];
  return matches.length ? matches[matches.length - 1][2] : ".";
}

function leadingContext(text: string): string {
  const code = withoutBlockComments(text);
  const [match] = code.matchAll(CONTEXT_PATTERN);
  if (!match) return ".";
  const above = code.slice(0, match.index).replace(/^[\t ]*\/.*$/gm, "");
  return above.trim() ? "." : match[2];
}

export function getQueryContext(lineNum?: number): string {
  const document = ext.activeTextEditor?.document;
  if (!document) return ".";
  return typeof lineNum === "number"
    ? contextAbove(
        document.getText(
          new Range(new Position(0, 0), new Position(lineNum, 0)),
        ),
      )
    : leadingContext(document.getText());
}

export function getConextForRerunQuery(query: string): string {
  return leadingContext(query);
}

export async function runQuery(
  type: ExecutionTypes,
  connLabel: string,
  executorName: string,
  isWorkbook: boolean,
  rerunQuery?: string,
  isSql?: boolean,
  cancel?: () => void,
) {
  const editor = ext.activeTextEditor;
  if (!editor) {
    return false;
  }

  let context;
  let query;
  let isPython = false;

  switch (type) {
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection: {
      const selection = editor.selection;
      query = selection.isEmpty
        ? editor.document.lineAt(selection.active.line).text
        : editor.document.getText(selection);
      context = getQueryContext(selection.start.line);
      if (type === ExecutionTypes.PythonQuerySelection) {
        isPython = true;
      }
      break;
    }

    case ExecutionTypes.QueryFile:
    case ExecutionTypes.ReRunQuery:
    case ExecutionTypes.PythonQueryFile:
    default: {
      query = rerunQuery || editor.document.getText();
      context = getQueryContext();

      if (type === ExecutionTypes.PythonQueryFile) {
        isPython = true;
      }
      break;
    }
  }

  if (isSql) {
    query = getSQLWrapper(query);
  }

  const runner = Runner.create((_, token) => {
    if (cancel) {
      token.onCancellationRequested(cancel);
    }

    return executeQuery(
      query,
      connLabel,
      executorName,
      context,
      isPython,
      isWorkbook,
      false,
      token,
    );
  });

  runner.title = `Executing ${executorName} on ${connLabel || "active connection"}.`;

  return runner.execute();
}

export function rerunQuery(rerunQueryElement: QueryHistory) {
  const context = getConextForRerunQuery(rerunQueryElement.query);
  executeQuery(
    rerunQueryElement.query,
    rerunQueryElement.connectionName,
    rerunQueryElement.executorName,
    context,
    rerunQueryElement.language !== "q",
    !!rerunQueryElement.isWorkbook,
    !!rerunQueryElement.isFromConnTree,
  );
}

export function copyQuery(queryHistoryElement: QueryHistory) {
  const query = queryHistoryElement.query;
  if (query) {
    notify("Query copied to clipboard.", MessageKind.INFO, { logger });
    return env.clipboard.writeText(query);
  }
}

export async function exportConnections(connLabel?: string) {
  const connMngService = new ConnectionManagementService();

  const exportAuth = await window.showQuickPick(["Yes", "No"], {
    placeHolder: "Do you want to export username and password?",
  });

  if (!exportAuth) {
    notify("Export operation was cancelled by the user.", MessageKind.DEBUG, {
      logger,
    });
    return;
  }

  const includeAuth = exportAuth === "Yes";
  if (includeAuth) {
    await connMngService.retrieveUserPass();
  }
  const doc = await connMngService.exportConnection(connLabel, includeAuth);
  if (doc && doc !== "") {
    const formattedDoc = JSON.stringify(JSON.parse(doc), null, 2);
    const uri = await window.showSaveDialog({
      saveLabel: "Save Exported Connections",
      filters: {
        "JSON Files": ["json"],
        "All Files": ["*"],
      },
    });
    if (uri) {
      fs.writeFile(uri.fsPath, formattedDoc, (err) => {
        if (err) {
          notify(`Error saving file: ${err.message}`, MessageKind.ERROR, {
            logger,
          });
        } else {
          workspace.openTextDocument(uri).then((document) => {
            window.showTextDocument(document, { preview: false });
          });
        }
      });
    } else {
      notify("Save operation was cancelled by the user.", MessageKind.DEBUG, {
        logger,
      });
    }
  } else {
    notify("No connections found to be exported.", MessageKind.ERROR, {
      logger,
    });
  }
}

export async function writeQueryResultsToConsole(
  result: string | string[],
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
): Promise<void> {
  const queryConsole = ExecutionConsole.start();
  const isNonEmptyArray = Array.isArray(result) && result.length > 0;
  const valueToDecode = isNonEmptyArray ? result[0] : result.toString();
  const res = decodeQUTF(valueToDecode);
  if (!res.startsWith(queryConstants.error)) {
    queryConsole.append(
      res,
      query,
      executorName,
      connLabel,
      isInsights,
      type,
      isPython,
      duration,
      isFromConnTree,
    );
  } else {
    queryConsole.appendQueryError(
      query,
      res.substring(queryConstants.error.length),
      connLabel,
      executorName,
      true,
      isInsights,
      type,
      isPython,
      false,
      duration,
      isFromConnTree,
    );
  }
}

export async function writeQueryResultsToView(
  result: any,
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
): Promise<void> {
  await commands.executeCommand(
    "peachq.resultsPanel.update",
    result,
    isInsights,
    undefined,
    isPython,
  );
  // Results went to the (possibly hidden) Results view — leave a clickable
  // pointer in the connection's console so the user knows where they landed and
  // can open the view on demand.
  ext.connectionConsoles.get(connLabel)?.appendResultsPointer();
  let isSuccess = true;

  if (typeof result === "string") {
    const res = decodeQUTF(result);
    if (res.startsWith(queryConstants.error)) {
      isSuccess = false;
    }
  }
  addQueryHistory(
    query,
    executorName,
    connLabel,
    ServerType.KDB,
    isSuccess,
    isPython,
    type === "WORKBOOK",
    duration,
    isFromConnTree,
  );
}

export async function writeQueryResultsToPlot(
  data: string,
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
): Promise<void> {
  notify("GG Plot displayed", MessageKind.DEBUG, {
    logger,
  });
  await writePlotToFile(data);
  addQueryHistory(
    query,
    executorName,
    connLabel,
    ServerType.KDB,
    true,
    isPython,
    type === "WORKBOOK",
    duration,
    isFromConnTree,
  );
}

function isValidExportedConnections(data: any): data is ExportedConnections {
  return data && data.connections && Array.isArray(data.connections.KDB);
}

const quickConnections: ServerDetails[] = [];

function getQuickLabel(conn: ServerDetails) {
  return `${conn.serverAlias} [${conn.serverName}:${conn.serverPort}]`;
}

function getQuickDetail(host: string, port: string, user: string) {
  return quickConnections.find(
    (conn) =>
      conn.serverName === host &&
      conn.serverPort === port &&
      conn.username === user,
  );
}

async function removeQuickDetail(conn: ServerDetails) {
  quickConnections.splice(quickConnections.indexOf(conn), 1);
  const label = getQuickLabel(conn);
  ext.connectedConnectionList
    .find((conn) => conn.connLabel === label)
    ?.disconnect();
  await refreshQuickProvider();
}

async function refreshQuickProvider() {
  const servers = getServers();
  quickConnections.forEach((conn) => (servers[conn.serverAlias] = conn));
  await commands.executeCommand(
    "setContext",
    "peachq.kdbQuickNodes",
    quickConnections.map((conn) => getQuickLabel(conn)),
  );
  ext.serverProvider.refresh(servers);
}

export async function setQuickPassword(
  host: string,
  port: string,
  user: string,
  pass: string,
) {
  const conn = getQuickDetail(host, port, user);
  if (conn) await removeQuickDetail(conn);
  await ext.secretSettings.storeAuthData(
    `${host}:${port}:${user}`,
    `${user}:${pass}`,
  );
}

export async function ensureQuickConnection(server: string) {
  const [host, port, user] = server.split(":");

  let connection = getQuickDetail(host, port, user);
  if (!connection) {
    const serverAlias = "(Connection " + (quickConnections.length + 1) + ")";
    if (user) {
      let auth = await ext.secretSettings.getAuthData(server);
      if (!auth) {
        const password = await window.showInputBox({
          password: true,
          prompt: `Enter password for ${server}`,
        });
        auth = `${user}:${password ?? ""}`;
        await ext.secretSettings.storeAuthData(server, auth);
      }
      await ext.secretSettings.storeAuthData(serverAlias, auth);
    }
    connection = {
      serverAlias,
      serverName: host,
      serverPort: port,
      username: user,
      auth: !!user,
      tls: false,
    };
    quickConnections.push(connection);
    await refreshQuickProvider();
  }

  return connection.serverAlias;
}
