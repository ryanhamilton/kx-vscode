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

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { baseStyles } from "./baseStyles";
import { checked } from "../directives";

@customElement("kdb-welcome-view")
export class KdbWelcomeView extends LitElement {
  static readonly styles = [
    baseStyles,
    css`
      .container {
        padding: 1em 4em 0 4em;
        margin-bottom: 4em;
      }
      /* The gaps this page wants. The directions are baseStyles' — spelling
         them out again is how these two came to mean the opposite of the
         .row and .col every other view is built from. */
      .row {
        gap: 1em;
      }
      .col {
        gap: 0;
      }
      .middle {
        align-items: baseline;
      }
      .nowrap {
        white-space: nowrap;
      }
      .icon-inline {
        margin-left: 0.25em;
        margin-right: 0.25em;
      }
      .footer {
        position: fixed;
        bottom: 0;
        padding: 1em;
        width: 100%;
        text-align: center;
        background-color: var(--vscode-editor-background);
      }
      .footer .checkbox {
        justify-content: center;
      }
      a {
        text-decoration: none;
      }
      img {
        width: 100%;
        height: auto;
        display: block;
        max-width: 35em;
      }
    `,
  ];

  @property()
  image = "";

  @property()
  checked = "true";

  @property()
  q = "";

  readonly vscode = acquireVsCodeApi();

  private renderPeachq() {
    return html`
      <h2>Run q with peachq</h2>
      <p>
        peachq runs q on your machine, with no licence key and no server to set
        up.
      </p>
      <div class="row middle peachq">
        <a href="https://peachq.org/docs/" class="nowrap"
          >peachq Documentation
          <span class="icon-inline">${renderLinkIcon()}</span></a
        >
        <a href="https://peachq.org/download" class="nowrap"
          >Download peachq
          <span class="icon-inline">${renderLinkIcon()}</span></a
        >
      </div>
    `;
  }

  private renderCommand(message: string, label: string) {
    return html`<a
      href="#"
      class="nowrap"
      @click="${(event: Event) => {
        event.preventDefault();
        this.vscode.postMessage(message);
      }}"
      >${label}</a
    >`;
  }

  private renderQHome() {
    return html`
      <p>
        To use <strong>peachq: Start REPL</strong> with a q you already have,
        point the q home directory setting at its installation.
      </p>
      <div class="row mt-1 middle">
        <button
          class="primary nowrap"
          @click="${() => {
            this.vscode.postMessage("qhome");
          }}">
          Set QHOME
        </button>
      </div>
    `;
  }

  private renderFound() {
    return html`
      <p>q is ready at <code>${this.q}</code>.</p>
      <div class="row mt-1 middle">
        ${this.renderCommand("repl", "Start REPL")}
      </div>
    `;
  }

  protected render() {
    return html`
      <div class="container">
        <div class="col">
          <h1>Welcome to peachq</h1>
          <div class="row">
            <div>
              ${this.renderPeachq()}
              ${this.q ? this.renderFound() : this.renderQHome()}
            </div>
            <div class="middle"><img src="${this.image}" /></div>
          </div>
        </div>
      </div>
      <div class="footer">
        <label class="checkbox">
          <input
            type="checkbox"
            ${checked(this.checked === "true")}
            @change="${(event: Event) => {
              const on = (event.target as HTMLInputElement).checked;
              this.checked = String(on);
              this.vscode.postMessage(on);
            }}" />
          Show welcome page on startup
        </label>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-welcome-view": KdbWelcomeView;
  }
}

function renderLinkIcon() {
  return html`
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 8H1V1H4.5V0H1C0.445 0 0 0.45 0 1V8C0 8.55 0.445 9 1 9H8C8.55 9 9 8.55 9 8V4.5H8V8ZM5.5 0V1H7.295L2.38 5.915L3.085 6.62L8 1.705V3.5H9V0H5.5Z"
        fill="currentColor" />
    </svg>
  `;
}
// Modified by peachq contributors; see NOTICE.
