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

import { MessageKind, notify } from "../utils/notifications";

const logger = "setupTools";

export async function showSetupError(workspace?: vscode.WorkspaceFolder) {
  /* c8 ignore start */
  const scope = workspace ? " for workspace " + workspace.name : "";
  const res = await notify(
    `q installation not found${scope}. Set the q home directory to a peachq build.`,
    MessageKind.WARNING,
    { logger, params: workspace?.name },
    "Set q Home Directory",
    "Dismiss",
  );
  if (res === "Set q Home Directory") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "kdb.qHomeDirectory",
    );
  }
  /* c8 ignore stop */
}
