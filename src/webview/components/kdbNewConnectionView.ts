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

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "./baseStyles";
import { KdbSelect } from "./kdbSelect";
import { kdbStyles, newConnectionStyles } from "./styles";
import { ConnectionType, ServerDetails } from "../../models/connectionsModels";
import { LabelColors, Labels } from "../../models/labels";
import { EditConnectionMessage } from "../../models/messages";
import { TEXT } from "../converters";
import { bind, checked, inputDefaults } from "../directives";

const NEW_LABEL = "\u0000new-label";

const AUTH_SECTION = "Authentication & TLS";

@customElement("kdb-new-connection-view")
export class KdbNewConnectionView extends LitElement {
  static readonly styles = [baseStyles, kdbStyles, newConnectionStyles];
  lblColorsList: LabelColors[] = [];
  lblNamesList: Labels[] = [];
  newLblName = "";
  newLblColorName = "";
  kdbServer: ServerDetails = {
    serverName: "",
    serverPort: "",
    auth: false,
    serverAlias: "",
    tls: false,
    username: "",
    password: "",
  };
  labels: string[] = [];
  oldAlias: string = "";
  editAuth: boolean = false;
  renderId: string = "";
  private isModalOpen = false;
  private readonly openSections = new Set<string>();
  private _connectionData: EditConnectionMessage | undefined = undefined;
  private readonly vscode = acquireVsCodeApi();

  get connectionData(): EditConnectionMessage | undefined {
    return this._connectionData;
  }

  set connectionData(value: EditConnectionMessage | undefined) {
    const oldValue = this._connectionData;
    this._connectionData = value;
    this.requestUpdate("connectionData", oldValue);
  }

  openModal() {
    this.isModalOpen = true;
    this.requestUpdate();
  }

  closeModal() {
    this.newLblColorName = "";
    this.newLblName = "";
    this.isModalOpen = false;
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.handleMessage.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleMessage.bind(this));
    super.disconnectedCallback();
  }

  toggleLabel(name: string, on: boolean) {
    this.labels = on
      ? [...this.labels.filter((label) => label !== name), name]
      : this.labels.filter((label) => label !== name);
    this.requestUpdate();
  }

  handleMessage(event: { data: any }) {
    const message = event.data;
    if (message.command === "editConnection") {
      this.connectionData = message.data;
      this.labels = [...new Set<string>(message.labels || [])].filter(Boolean);
      this.requestUpdate();
    }
    if (message.command === "refreshLabels") {
      this.lblNamesList = message.data;
      this.lblColorsList = message.colors;
      this.requestUpdate();
    }
  }

  setKdbServer<K extends keyof ServerDetails>(key: K, value: ServerDetails[K]) {
    this.kdbServer[key] = value;
    this.requestUpdate();
  }

  changeTLS() {
    this.setKdbServer("tls", !this.kdbServer.tls);
  }

  editAuthOfConn() {
    this.editAuth = !this.editAuth;
    this.requestUpdate();
  }

  renderSection(title: string, body: unknown) {
    return html`<details
      ?open="${this.openSections.has(title)}"
      @toggle="${(event: Event) => {
        if ((event.target as HTMLDetailsElement).open) {
          this.openSections.add(title);
        } else {
          this.openSections.delete(title);
        }
      }}">
      <summary>${title}</summary>
      <div class="section">${body}</div>
    </details>`;
  }

  renderServerNameDesc() {
    return html`<span>Name the server.</span>`;
  }

  renderServerNameField() {
    return html`<label class="field"
      ><span class="label">Server Name</span
      ><input
        class="text-field larger"
        required
        placeholder="Server-1"
        ${inputDefaults()}
        ${bind(this.kdbServer.serverAlias)}
        @input="${(event: Event) =>
          this.setKdbServer(
            "serverAlias",
            (event.target as HTMLInputElement).value,
          )}"
    /></label>`;
  }

  renderServerName() {
    return html`
      <div class="row">${this.renderServerNameField()}</div>
      <div class="row option-description  option-help">
        ${this.renderServerNameDesc()}
      </div>
    `;
  }

  renderPortNumberDesc() {
    return html`<span
      >Ensure <b>Set port number</b> matches the assigned port of your q
      process, and doesn’t conflict with another port.</span
    >`;
  }

  renderPortNumber() {
    return html`
      <div class="row">
        <label class="field"
          ><span class="label">Set port number</span
          ><input
            class="text-field larger"
            required
            placeholder="5001"
            ${inputDefaults()}
            ${bind(this.kdbServer.serverPort)}
            @input="${(event: Event) =>
              this.setKdbServer(
                "serverPort",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>
      </div>
      <div class="row option-description option-help">
        ${this.renderPortNumberDesc()}
      </div>
    `;
  }

  renderConnAddDesc() {
    return html`Set the IP of your kdb+ database connection.`;
  }

  renderConnAddress() {
    return html`
      <div class="row">
        <label class="field"
          ><span class="label">Define connection address</span
          ><input
            class="text-field larger"
            required
            placeholder="127.0.0.1 or localhost"
            ${inputDefaults()}
            ${bind(this.kdbServer.serverName, TEXT)}
            @input="${(event: Event) =>
              this.setKdbServer(
                "serverName",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>
      </div>
      <div class="row option-description option-help">
        ${this.renderConnAddDesc()}
      </div>
    `;
  }

  renderTLSField() {
    return html`<div class="row">
      <label class="checkbox"
        ><input
          type="checkbox"
          ${checked(this.kdbServer.tls)}
          @change="${() => this.changeTLS()}" />
        Enable TLS Encryption on the kdb connection
      </label>
    </div>`;
  }

  renderLblDropdownColorOptions() {
    return this.lblColorsList.map((color) => color.name);
  }

  labelOptions() {
    return [
      ...this.lblNamesList.map((lbl) => ({
        value: lbl.name,
        color: lbl.color?.colorHex,
      })),
      { value: NEW_LABEL, label: "+ Create new label..." },
    ];
  }

  handleLabels(event: Event) {
    const picked = (event.target as KdbSelect).values;
    if (picked.includes(NEW_LABEL)) {
      this.openModal();
      return;
    }
    this.labels = picked;
    this.requestUpdate();
  }

  renderLbls() {
    return html`
      <kdb-select
        class="labels"
        multiple
        empty="Select labels..."
        label="Connection labels"
        .values="${this.labels}"
        .options="${this.labelOptions()}"
        @change="${this.handleLabels}"></kdb-select>
    `;
  }

  renderNewLabelModal() {
    return html`
      <div class="overlay"></div>
      <dialog class="modal" ?open="${this.isModalOpen}">
        <div class="modal-content">
          <h2>Add a New Label</h2>
          <div class="row">
            <label class="field"
              ><span class="label">Label name</span
              ><input
                placeholder="Label name"
                class="text-field larger"
                ${inputDefaults()}
                ${bind(this.newLblName)}
                @input="${(event: Event) => {
                  this.newLblName = (event.target as HTMLInputElement).value;
                  this.requestUpdate();
                }}"
                id="label-name"
            /></label>
          </div>
          <div class="row option-title gap-0" style="margin-top: 10px;">
            Label color
          </div>
          <div class="row">
            <kdb-select
              id="label-color"
              class="dropdown"
              style="width: 18.5em;"
              value="${this.newLblColorName}"
              empty="No Color Selected"
              label="Label color"
              .options="${this.renderLblDropdownColorOptions()}"
              @change="${(event: Event) => {
                this.newLblColorName = (event.target as KdbSelect).value;
                this.requestUpdate();
              }}"></kdb-select>
          </div>
          <div class="row" style="margin-top: 10px;">
            <button
              aria-label="Cancel"
              appearance="secondary"
              @click="${this.closeModal}">
              Cancel
            </button>
            <button
              class="primary"
              aria-label="Create Label"
              @click="${this.createLabel}"
              ?disabled="${this.newLblName === "" ||
              this.newLblColorName === ""}">
              Create
            </button>
          </div>
        </div>
      </dialog>
    `;
  }

  renderConnectionLabelsSection() {
    return html` <div class="row">
      <div class="col gap-0">
        <div class="row option-title">Connection labels (optional)</div>
        <div class="row mt-1">${this.renderLbls()}</div>
      </div>
    </div>`;
  }

  renderNewMyQConnectionForm() {
    return html`<div class="col">
      <div class="row">
        <div class="col gap-0">${this.renderServerName()}</div>
      </div>
      <div class="row">
        <div class="col gap-0">${this.renderConnAddress()}</div>
      </div>
      <div class="row">
        <div class="col gap-0">${this.renderPortNumber()}</div>
      </div>
      <div class="row">
        <div class="col gap-0">
          ${this.renderSection(
            AUTH_SECTION,
            html`
              <div class="row">
                <label class="field"
                  ><span class="label">Username</span
                  ><input
                    class="text-field larger"
                    ${inputDefaults()}
                    ${bind(this.kdbServer.username || "")}
                    @input="${(event: Event) =>
                      this.setKdbServer(
                        "username",
                        (event.target as HTMLInputElement).value,
                      )}"
                /></label>
              </div>
              <div class="row">
                <label class="field"
                  ><span class="label">Password</span
                  ><input
                    type="password"
                    class="text-field larger"
                    ${inputDefaults()}
                    ${bind(this.kdbServer.password || "")}
                    @input="${(event: Event) =>
                      this.setKdbServer(
                        "password",
                        (event.target as HTMLInputElement).value,
                      )}"
                /></label>
              </div>
              <div class="row option-description option-help">
                Add required authentication to get access to the server
                connection if enabled.
              </div>
              ${this.renderTLSField()}
            `,
          )}
        </div>
      </div>
      ${this.renderConnectionLabelsSection()}
      ${this.renderCreateConnectionBtn()}
    </div>`;
  }

  renderNewConnectionForm() {
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        ${this.isModalOpen ? this.renderNewLabelModal() : ""}
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Add a New Connection</h2>
            </div>
            <div class="row option-description">
              <span>
                If you are running a q process then use <b>“My q”</b>. Please
                ensure your q process is running before connecting it to the kdb
                VS Code extension otherwise you will get a connection
                error.</span
              >
            </div>
          </div>
          <div class="row">
            <div class="col">${this.renderNewMyQConnectionForm()}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderCreateConnectionBtn() {
    return html`<div class="row">
      <button class="primary" class="grow" @click="${() => this.save()}">
        Create Connection
      </button>
    </div>`;
  }

  renderEditConnectionForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    if (
      this.renderId === "" ||
      this.oldAlias !== this.connectionData.serverName
    ) {
      this.oldAlias = this.connectionData.serverName;
      this.renderId = "";
    }
    const connTypeName = this.defineConnTypeName(this.connectionData.connType);
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        ${this.isModalOpen ? this.renderNewLabelModal() : ""}
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Edit ${connTypeName} Connection</h2>
            </div>
            <div class="row option-description">
              <span
                >Editing an active connection may require you to
                <b>restart the connection</b>. If so, you will be prompted to
                reconnect after saving your changes.</span
              >
            </div>
          </div>
          <div class="row">${this.renderEditConnFields()}</div>
          <div class="row">${this.renderConnectionLabelsSection()}</div>
          <div class="row">
            <button
              class="primary"
              class="grow"
              @click="${() => this.editConnection()}">
              Update Connection
            </button>
          </div>
        </div>
      </div>
    `;
  }

  defineConnTypeName(_connType: ConnectionType) {
    return "My q";
  }

  renderEditConnFields() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    return this.renderMyQEditForm();
  }

  renderMyQEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }

    if (this.renderId === "") {
      this.renderId = this.generateRenderId();
      this.kdbServer.serverAlias = this.connectionData.serverName;
      this.kdbServer.serverPort = this.connectionData.port ?? "";
      this.kdbServer.serverName = this.connectionData.serverAddress;
      this.kdbServer.auth = this.connectionData.auth ?? false;
      this.kdbServer.tls = this.connectionData.tls ?? false;
      if (this.kdbServer.tls) {
        this.openSections.add(AUTH_SECTION);
      }
    }

    return html`
      <div class="col">
        <div class="row">
          <div class="col gap-0">${this.renderServerName()}</div>
        </div>
        <div class="row">
          <div class="col gap-0">${this.renderConnAddress()}</div>
        </div>
        <div class="row">
          <div class="col gap-0">${this.renderPortNumber()}</div>
        </div>
        <div class="row">
          <div class="col gap-0">
            ${this.renderSection(
              AUTH_SECTION,
              html`
                <div class="row">
                  <label class="checkbox"
                    ><input
                      type="checkbox"
                      ${checked(this.editAuth)}
                      @change="${() => this.editAuthOfConn()}" />
                    Edit existing auth on the kdb connection
                  </label>
                </div>
                ${this.editAuth
                  ? html`
                      <div class="row">
                        <label class="field"
                          ><span class="label">Username</span
                          ><input
                            class="text-field larger"
                            ${inputDefaults()}
                            ${bind(this.kdbServer.username || "")}
                            @input="${(event: Event) =>
                              this.setKdbServer(
                                "username",
                                (event.target as HTMLInputElement).value,
                              )}"
                        /></label>
                      </div>
                      <div class="row">
                        <label class="field"
                          ><span class="label">Password</span
                          ><input
                            type="password"
                            class="text-field larger"
                            ${inputDefaults()}
                            ${bind(this.kdbServer.password || "")}
                            @input="${(event: Event) =>
                              this.setKdbServer(
                                "password",
                                (event.target as HTMLInputElement).value,
                              )}"
                        /></label>
                      </div>
                      <div class="row option-description option-help">
                        Add required authentication to get access to the server
                        connection if enabled.
                      </div>
                    `
                  : ""}
                ${this.renderTLSField()}
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.connectionData) {
      return html` ${this.renderNewConnectionForm()} `;
    } else {
      return html` ${this.renderEditConnectionForm()} `;
    }
  }

  private get data(): ServerDetails {
    this.kdbServer.username = this.kdbServer.username!.trim();
    this.kdbServer.password = this.kdbServer.password!.trim();
    this.kdbServer.auth = this.kdbServer.username !== "";
    return this.kdbServer;
  }

  private save() {
    this.vscode.postMessage({
      command: "kdb.connections.add.kdb",
      data: this.data,
      labels: this.labels,
    });
  }

  private createLabel() {
    this.vscode.postMessage({
      command: "kdb.connections.labels.add",
      data: {
        name: this.newLblName,
        colorName: this.newLblColorName,
      },
    });
    setTimeout(() => {
      this.toggleLabel(this.newLblName, true);
      this.closeModal();
    }, 500);
  }

  private editConnection() {
    if (!this.connectionData) {
      return;
    }
    this.vscode.postMessage({
      command: "kdb.connections.edit.kdb",
      data: this.data,
      oldAlias: this.oldAlias,
      editAuth: this.editAuth,
      labels: this.labels,
    });
  }

  private generateRenderId(): string {
    let counter = 0;
    const timestamp = Date.now().toString(36);
    const uniqueCounter = (counter++).toString(36);
    return `render-${timestamp}-${uniqueCounter}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-new-connection-view": KdbNewConnectionView;
  }
}
