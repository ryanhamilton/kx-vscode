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

import * as sinon from "sinon";
import * as vscode from "vscode";

import { ExtensionTelemetry } from "../../../src/utils/telemetryClient";

describe("ExtensionTelemetry", () => {
  let createOutputChannel: sinon.SinonStub;
  let outputChannelMock: any;

  beforeEach(() => {
    outputChannelMock = {
      appendLine: sinon.spy(),
      dispose: sinon.stub().resolves(),
    };
    createOutputChannel = sinon
      .stub(vscode.window, "createOutputChannel")
      .returns(outputChannelMock);
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.CODE_TEST;
  });

  it("should send nothing anywhere outside a test run", async () => {
    process.env.CODE_TEST = "";
    const ext = new ExtensionTelemetry(true);

    ext.sendEvent("testEvent", { category: "testing" }, { duration: 100 });
    ext.sendError(new Error("critical failure"));
    await ext.dispose();

    sinon.assert.notCalled(createOutputChannel);
  });

  it("should verify output channel logging in test mode", () => {
    process.env.CODE_TEST = "true";
    const ext = new ExtensionTelemetry(true);

    ext.sendEvent("clickAction", { button: "left" });

    sinon.assert.calledOnce(outputChannelMock.appendLine);
    sinon.assert.calledWithMatch(
      outputChannelMock.appendLine,
      /telemetry\/clickAction/,
    );
  });

  it("should log errors to the output channel in test mode", () => {
    process.env.CODE_TEST = "true";
    const ext = new ExtensionTelemetry(true);
    const testError = new Error("critical failure");
    testError.name = "DatabaseError";

    ext.sendError(testError, { userRole: "admin" });

    sinon.assert.calledWithMatch(
      outputChannelMock.appendLine,
      /telemetry\/exception .*DatabaseError.*critical failure/,
    );
  });

  it("should verify nothing is called when telemetry is disabled", () => {
    process.env.CODE_TEST = "true";
    const ext = new ExtensionTelemetry(false);

    ext.sendEvent("unusedEvent");

    sinon.assert.notCalled(createOutputChannel);
    sinon.assert.notCalled(outputChannelMock.appendLine);
  });
});
