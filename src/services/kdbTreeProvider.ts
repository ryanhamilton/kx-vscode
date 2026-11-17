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
import { ConnectionManagementService } from "./connectionManagerService";
import { KdbTreeService } from "./kdbTreeService";
import { LocalConnection } from "../classes/localConnection";
import { Server, ServerDetails } from "../models/connectionsModels";
import { Labels } from "../models/labels";
import {
  clearWorkspaceLabels,
  isLabelContentChanged,
  isLabelEmpty,
  retrieveConnLabelsNames,
} from "../utils/connLabel";
import {
  getServerAlias,
  getServerIconState,
  getServerName,
  getStatus,
} from "../utils/core";
import { getIconPath } from "../utils/iconsUtils";

export class KdbTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    KdbNode | undefined | void
  > = new vscode.EventEmitter<KdbNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<KdbNode | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private serverList: Server) {}

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(serverList: Server): void {
    this.serverList = serverList;
    vscode.commands.executeCommand(
      "setContext",
      "peachq.selectContentNodesContext",
      ext.selectContentNodesContext,
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KdbNode): vscode.TreeItem {
    if (element instanceof QServerNode) {
      element.contextValue = ext.selectContentNodesContext[0];
    }
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    clearWorkspaceLabels();
    if (!this.serverList) {
      return [];
    }

    if (!element) {
      const orphans: vscode.TreeItem[] = [];
      const nodes = ext.connLabelList.map((label) => new LabelNode(label));
      const items = this.getMergedElements(element);

      let orphan, found;
      for (const item of items) {
        orphan = true;
        if (item instanceof KdbNode) {
          const labels = retrieveConnLabelsNames(item);
          for (const label of labels) {
            found = nodes.find((node) => label === node.source.name);
            if (found) {
              found.children.push(item);
              orphan = false;
            }
          }
        }
        if (orphan) {
          orphans.push(item);
        }
      }
      return [...orphans, ...nodes];
    } else if (element instanceof LabelNode) {
      return element.children;
    } else if (
      element.contextValue !== undefined &&
      ext.kdbrootNodes.indexOf(element.contextValue) !== -1
    ) {
      return Promise.resolve(await this.getNamespaces(element.contextValue));
    } else if (element.contextValue === "ns") {
      return Promise.resolve(
        this.getCategories(
          (element as QNamespaceNode).details?.toString(),
          ext.qObjectCategories,
          (element as QNamespaceNode).connLabel,
        ),
      );
    } else {
      return Promise.resolve(this.getServerObjects(element));
    }
  }

  private getMergedElements(_element?: vscode.TreeItem): vscode.TreeItem[] {
    ext.connectionsList.length = 0;
    const servers = this.getChildElements(_element);
    ext.connectionsList.push(...servers);
    ext.kdbConnectionAliasList.length = 0;
    getServerAlias(servers.map((x) => x.details));
    return servers;
  }

  private getChildElements(_element?: vscode.TreeItem): KdbNode[] {
    return this.createLeafItems(this.serverList);
  }

  private async getNamespaces(connLabel: string): Promise<QNamespaceNode[]> {
    /* c8 ignore start */
    const connMng = new ConnectionManagementService();
    const conn = connMng.retrieveConnectedConnection(connLabel);
    if (!conn) {
      return new Array<QNamespaceNode>();
    }
    const ns = await KdbTreeService.loadNamespaces(conn);
    const result = ns.map(
      (x) =>
        new QNamespaceNode(
          [],
          x.name,
          "",
          vscode.TreeItemCollapsibleState.Collapsed,
          x.fname,
          connLabel ?? "",
        ),
    );
    if (result !== undefined) {
      return result;
    } else {
      return new Array<QNamespaceNode>();
    }
    /* c8 ignore stop */
  }

  private async getCategories(
    ns: string | undefined,
    objectCategories: string[],
    connLabel?: string,
  ): Promise<QCategoryNode[]> {
    /* c8 ignore start */
    // filter out views for non-default namespaces
    let filteredCategories;
    if (ns !== ".") {
      filteredCategories = objectCategories.filter((item) => {
        return item !== "Views";
      });
    } else {
      filteredCategories = objectCategories;
    }
    const result = filteredCategories.map(
      (x) =>
        new QCategoryNode(
          [],
          x,
          "",
          ns ?? "",
          vscode.TreeItemCollapsibleState.Collapsed,
          connLabel ?? "",
        ),
    );
    return result;
    /* c8 ignore stop */
  }

  private async getServerObjects(
    serverType: QCategoryNode | vscode.TreeItem,
  ): Promise<QServerNode[] | QNamespaceNode[]> {
    if (serverType === undefined) return new Array<QServerNode>();

    const conn = this.validateAndGetConnection(serverType);
    if (!conn) {
      return new Array<QServerNode>();
    }

    const ns = serverType.contextValue ?? "";
    const connLabel =
      serverType instanceof QCategoryNode ? serverType.connLabel : "";

    return this.loadObjectsByCategory(serverType, conn, ns, connLabel);
  }

  private validateAndGetConnection(
    serverType: QCategoryNode | vscode.TreeItem,
  ): LocalConnection | null {
    const connLabel =
      serverType instanceof QCategoryNode ? serverType.connLabel : "";
    const connMng = new ConnectionManagementService();
    const conn = connMng.retrieveConnectedConnection(connLabel);

    if (!conn) {
      return null;
    }

    return conn;
  }

  private async loadObjectsByCategory(
    serverType: QCategoryNode | vscode.TreeItem,
    conn: LocalConnection,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const categoryIndex = ext.qObjectCategories.indexOf(
      serverType.label as string,
    );

    switch (categoryIndex) {
      case 0: // dictionaries
        return this.loadDictionaries(
          conn,
          serverType.contextValue ?? "",
          ns,
          connLabel,
        );
      case 1: // functions
        return this.loadFunctions(
          conn,
          serverType.contextValue ?? "",
          ns,
          connLabel,
        );
      case 2: // tables
        return this.loadTables(
          conn,
          serverType.contextValue ?? "",
          ns,
          connLabel,
        );
      case 3: // variables
        return this.loadVariables(
          conn,
          serverType.contextValue ?? "",
          ns,
          connLabel,
        );
      case 4: // views
        return this.loadViews(conn, ns, connLabel);
      default:
        return new Array<QServerNode>();
    }
  }

  private async loadDictionaries(
    conn: LocalConnection,
    namespace: string,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const dicts = await KdbTreeService.loadDictionaries(conn, namespace);
    return this.createQServerNodes(dicts, ns, connLabel, "dictionaries");
  }

  private async loadFunctions(
    conn: LocalConnection,
    namespace: string,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const funcs = await KdbTreeService.loadFunctions(conn, namespace);
    return this.createQServerNodes(funcs, ns, connLabel, "functions");
  }

  private async loadTables(
    conn: LocalConnection,
    namespace: string,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const tables = await KdbTreeService.loadTables(conn, namespace);
    return this.createQServerNodes(tables, ns, connLabel, "tables");
  }

  private async loadVariables(
    conn: LocalConnection,
    namespace: string,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const vars = await KdbTreeService.loadVariables(conn, namespace);
    return this.createQServerNodes(vars, ns, connLabel, "variables");
  }

  private async loadViews(
    conn: LocalConnection,
    ns: string,
    connLabel: string,
  ): Promise<QServerNode[]> {
    const views = await KdbTreeService.loadViews(conn);
    return views.map(
      (x) =>
        new QServerNode(
          [],
          `${ns === "." ? "" : "."}${x}`,
          "",
          vscode.TreeItemCollapsibleState.None,
          "views",
          connLabel,
        ),
    );
  }

  // Nested namespaces are not currently supported in the tree view
  // private async loadNestedNamespaces(
  //   conn: LocalConnection,
  //   ns: string,
  //   connLabel: string,
  // ): Promise<QServerNode[]> {
  //   const nns = await KdbTreeService.loadNamespaces(conn);
  //   return this.createQServerNodes(nns, ns, connLabel, "namespaces");
  // }

  private createQServerNodes(
    objects: any[],
    ns: string,
    connLabel: string,
    iconType: string,
  ): QServerNode[] {
    return objects.map(
      (x) =>
        new QServerNode(
          [],
          `${ns === "." ? "" : ns + "."}${x.name}`,
          "",
          vscode.TreeItemCollapsibleState.None,
          iconType,
          connLabel,
        ),
    );
  }

  private createLeafItems(servers: Server): KdbNode[] {
    const keys: string[] = Object.keys(servers);
    return keys.map(
      (x) =>
        new KdbNode(
          x.split(":"),
          x,
          servers[x],
          ext.connectionNode?.label === getServerName(servers[x])
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        ),
    );
  }
}

export class KdbNode extends vscode.TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: ServerDetails,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    if (details.serverAlias != "") {
      label = label + ` `;
    }
    label = label + `[${details.serverName}:${details.serverPort}]`;

    // set context for root nodes
    if (ext.kdbrootNodes.indexOf(label) === -1) {
      ext.kdbrootNodes.push(label);
      vscode.commands.executeCommand(
        "setContext",
        "peachq.rootNodes",
        ext.kdbrootNodes,
      );
    }

    // set context for nodes without auth
    if (details.auth === false) {
      if (ext.kdbNodesWithoutAuth.indexOf(label) === -1) {
        ext.kdbNodesWithoutAuth.push(label);
        vscode.commands.executeCommand(
          "setContext",
          "peachq.kdbNodesWithoutAuth",
          ext.kdbNodesWithoutAuth,
        );
      }
    } else {
      const index = ext.kdbNodesWithoutAuth.indexOf(label);
      if (index !== -1) {
        ext.kdbNodesWithoutAuth.splice(index, 1);
        vscode.commands.executeCommand(
          "setContext",
          "peachq.kdbNodesWithoutAuth",
          ext.kdbNodesWithoutAuth,
        );
      }
    }

    // set context for nodes without tls
    if (details.tls === false) {
      if (ext.kdbNodesWithoutTls.indexOf(label) === -1) {
        ext.kdbNodesWithoutTls.push(label);
        vscode.commands.executeCommand(
          "setContext",
          "peachq.kdbNodesWithoutTls",
          ext.kdbNodesWithoutTls,
        );
      }
    } else {
      const index = ext.kdbNodesWithoutTls.indexOf(label);
      if (index !== -1) {
        ext.kdbNodesWithoutTls.splice(index, 1);
        vscode.commands.executeCommand(
          "setContext",
          "peachq.kdbNodesWithoutTls",
          ext.kdbNodesWithoutTls,
        );
      }
    }

    super(label, collapsibleState);
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
  }

  getTooltip(): vscode.MarkdownString {
    const tooltipMd = new vscode.MarkdownString();
    const title = `${this.details.serverAlias} ${getStatus(this.label)}`;
    tooltipMd.appendMarkdown(`### ${title}\n`);
    tooltipMd.appendMarkdown(
      `${this.details.serverName}:${this.details.serverPort}`,
    );
    return tooltipMd;
  }

  getDescription(): string {
    return this.collapsibleState === vscode.TreeItemCollapsibleState.None &&
      this.children.length > 2
      ? `${this.children[2]}:${"*".repeat(this.children[3].length)}`
      : "";
  }

  iconPath = getNamedIconPath("conn-kdb", this.label);

  contextValue = this.label; // "root";
}

export class QNamespaceNode extends vscode.TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly fullName: string,
    public readonly connLabel: string,
  ) {
    details = fullName;
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = getOtherIconPath("namespaces");
  contextValue = "ns";
}

export class QCategoryNode extends vscode.TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly ns: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly connLabel: string,
  ) {
    details = "";
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = getOtherIconPath(this.label.toLowerCase());
  contextValue = this.ns; // "category";
}

export class QServerNode extends vscode.TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly coreIcon: string,
    public readonly connLabel: string,
  ) {
    details = "";
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = getOtherIconPath(this.coreIcon);
  contextValue = this.label;
}

export class LabelNode extends vscode.TreeItem {
  readonly children: vscode.TreeItem[] = [];
  static id = 0;

  constructor(public readonly source: Labels) {
    super(source.name);
    this.id = "LabelNode" + LabelNode.id++;
    this.collapsibleState = this.getCollapsibleState(source.name);
    this.contextValue = "label";
  }

  iconPath = getIconPath(`label-${this.source.color.name.toLowerCase()}.svg`);

  getCollapsibleState(labelName: string): vscode.TreeItemCollapsibleState {
    if (isLabelEmpty(labelName)) {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (isLabelContentChanged(labelName)) {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.Collapsed;
  }
}

function getNamedIconPath(name: string, label: string) {
  const iconFileName = name + getServerIconState(label) + ".svg";

  return getIconPath(iconFileName);
}

function getOtherIconPath(name: string) {
  return getIconPath(name + ".svg");
}
