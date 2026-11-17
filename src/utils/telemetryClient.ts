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

import { OutputChannel, window } from "vscode";

export class ExtensionTelemetry {
  private readonly output?: OutputChannel;

  private readonly defaultProperties: { [key: string]: any } = {};

  constructor(enableTelemetry = true) {
    if (enableTelemetry && process.env.CODE_TEST) {
      this.output = window.createOutputChannel("telemetry-client-test");
    }
  }

  public sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    const props = Object.assign({}, this.defaultProperties, properties);
    if (this.output) {
      this.output.appendLine(
        `telemetry/${eventName} ${JSON.stringify({ props, measurements })}`,
      );
    }
  }

  public sendError(
    error: Error,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    const props = {
      ...this.defaultProperties,
      ...properties,
      message: error.message,
      name: error.name,
      stack: error.stack ?? "",
    };

    if (this.output) {
      this.output.appendLine(
        `telemetry/exception ${JSON.stringify({ props, measurements })}`,
      );
    }
  }

  public async dispose(): Promise<void> {
    if (this.output) {
      await this.output.dispose();
    }
  }
}
