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
  ExtensionContext,
  languages,
  LogOutputChannel,
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  OutputChannel,
  StatusBarItem,
  TextEditor,
} from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import { ConnectionConsole } from "./classes/connectionConsole";
import { LocalConnection } from "./classes/localConnection";
import { kdbAuthMap } from "./models/connectionsModels";
import { CustomAuth } from "./models/customAuth";
import { ConnectionLabel, LabelColors, Labels } from "./models/labels";
import { QueryHistory } from "./models/queryHistory";
import { ServerObject } from "./models/serverObject";
import { TYPE_BY_NAME, TYPE_NAMES } from "./models/typeFormat";
import { KdbNode, KdbTreeProvider } from "./services/kdbTreeProvider";
import { KxNotebookController } from "./services/notebookController";
import { QueryHistoryProvider } from "./services/queryHistoryProvider";
import { KdbResultsViewProvider } from "./services/resultsPanelProvider";
import { WorkspaceTreeProvider } from "./services/workspaceTreeProvider";
import AuthSettings from "./utils/secretStorage";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ext {
  export const REPL = "REPL";
  export let activeTextEditor: TextEditor | undefined;
  export let context: ExtensionContext;
  export let outputChannel: LogOutputChannel;
  export let consolePanel: OutputChannel;
  export let serverProvider: KdbTreeProvider;
  export let queryHistoryProvider: QueryHistoryProvider;
  export let resultsViewProvider: KdbResultsViewProvider;
  export let notebookController: KxNotebookController;
  // Output destination toggle, driven by the editor-toolbar selector: when true
  // query results render in the kdb Results View, when false they go to the
  // connection's output console (Terminal). Mirrored to the
  // "kdb.showResultsInView" context key for the selector's menu state.
  export let isResultsTabVisible: boolean;
  export let scratchpadTreeProvider: WorkspaceTreeProvider;
  export let runScratchpadItem: StatusBarItem;
  export let pickTimeoutItem: StatusBarItem;
  export let serverObjects: ServerObject;
  export let openSslVersion: string | null;
  export let resultPanelCSV: string;
  export const rowLimit = 150000000;

  export let activeConnection: LocalConnection | undefined;
  export const connectedConnectionList: Array<LocalConnection> = [];
  // One output-only console terminal per connected connection, keyed by
  // connLabel. Created on connect, disposed on disconnect.
  export const connectionConsoles = new Map<string, ConnectionConsole>();
  export interface CellExecutionTarget {
    execution: NotebookCellExecution;
    cell: NotebookCell;
    index: number;
    outputs: NotebookCellOutput[];
    applied?: Thenable<void>;
    endedAt?: number;
    superseded?: boolean;
  }
  export const pendingImageTargets = new Map<string, CellExecutionTarget>();
  export const connectedContextStrings: Array<string> = [];
  export const queryHistoryAvailableToCopy: Array<string> = [];
  export const connectionsList: Array<KdbNode> = [];
  export let networkChangesWatcher: boolean;
  export let connectionNode: KdbNode | undefined;
  export const kdbQueryHistoryNodes: string[] = [];
  export const kdbQueryHistoryList: QueryHistory[] = [];
  export const kdbAuthMap: kdbAuthMap[] = [];
  export const kdbrootNodes: string[] = [];
  export const selectContentNodesContext: string[] = ["kdbVariable"];
  export const kdbNodesWithoutAuth: string[] = [];
  export const kdbNodesWithoutTls: string[] = [];
  export const kdbConnectionAliasList: string[] = [];
  export const connLabelList: Labels[] = [];
  export const labelConnMapList: ConnectionLabel[] = [];
  export const latestLblsChanged: string[] = [];
  export const maxRetryCount = 5;
  // list of valid data types
  export const booleanTypes = new Set([-1]);
  export const numberTypes = new Set([-4, -5, -6, -7, -8, -9]);
  export const textTypes = new Set([
    -2, -10, -11, -13, -14, -15, -16, -17, -18, -19, 10,
  ]);
  export const timestampTypes = new Set([-12]);
  export const jsonTypes = new Set([
    0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 77, 98, 99,
  ]);

  export let secretSettings: AuthSettings;

  export let client: LanguageClient;

  export const localhost = "127.0.0.1";
  export const networkProtocols = {
    http: "http://",
    https: "https://",
  };

  export const functions: Array<string> = [];
  export const variables: Array<string> = [];
  export const tables: Array<string> = [];
  // eslint-disable-next-line prefer-const
  export let keywords: Array<string> = [];

  export const qObjectCategories = [
    "Dictionaries",
    "Functions",
    "Tables",
    "Variables",
    "Views",
    // "Namespaces", removed to investigate
  ];

  // The namespaces a process keeps to itself, which are its own business
  // rather than the user's and so are left out of the listing.
  export const qNamespaceFilters = [
    ".q",
    ".Q",
    ".h",
    ".z",
    ".o",
    ".j",
    ".m",
    ".s",
  ];

  export const constants = {
    names: [
      "",
      "boolean",
      "guid",
      "",
      "byte",
      "short",
      "int",
      "long",
      "real",
      "float",
      "char",
      "symbol",
      "timestamp",
      "month",
      "date",
      "datetime",
      "timespan",
      "minute",
      "second",
      "time",
      "symbol",
    ],
    types: [
      "",
      "b",
      "g",
      "",
      "",
      "h",
      "i",
      "j",
      "e",
      "f",
      "c",
      "s",
      "p",
      "m",
      "d",
      "z",
      "n",
      "u",
      "v",
      "t",
      "s",
    ],
    dataTypes: new Map(
      [...TYPE_NAMES].map(([type, name]) => [type.toString(), name]),
    ),
    reverseDataTypes: new Map(TYPE_BY_NAME),
    listSeparator: [
      ";",
      "",
      " ",
      "",
      "",
      " ",
      " ",
      " ",
      " ",
      " ",
      "",
      "",
      " ",
      " ",
      " ",
      " ",
      " ",
      " ",
      " ",
      " ",
    ],
    listPrefix: [
      "(",
      "",
      "",
      "",
      "0x",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    listSuffix: [
      ")",
      "b",
      "",
      "",
      "",
      "h",
      "i",
      "",
      "e",
      "f",
      "",
      "",
      "",
      "m",
      "",
      "",
      "",
      "",
      "",
      "",
    ],

    base: new Date(2000, 0) as any,
    days: 1000 * 60 * 60 * 24,
    hours: 1000 * 60 * 60,
    minutes: 1000 * 60,
    seconds: 1000,
  };

  export const diagnosticCollection =
    languages.createDiagnosticCollection("kdb");

  export const labelColors: LabelColors[] = [
    {
      name: "White",
      colorHex: "#FFFFFF",
    },
    {
      name: "Red",
      colorHex: "#CD3131",
    },
    {
      name: "Green",
      colorHex: "#10BC7A",
    },
    {
      name: "Yellow",
      colorHex: "#E5E50E",
    },
    {
      name: "Blue",
      colorHex: "#2371C8",
    },
    {
      name: "Magenta",
      colorHex: "#BC3FBC",
    },
    {
      name: "Cyan",
      colorHex: "#15A7CD",
    },
  ];
  // eslint-disable-next-line prefer-const
  export let customAuth: CustomAuth | null = null;
}
