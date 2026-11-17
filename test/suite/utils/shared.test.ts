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

import * as assert from "assert";

import * as sharedUtils from "../../../src/utils/shared";

describe("Shared", () => {
  describe("stripUnprintableChars", () => {
    it("should remove control characters", () => {
      const input = "abc\u0000\u0001def";
      const result = sharedUtils.stripUnprintableChars(input);
      assert.strictEqual(result, "abcdef");
    });

    it("should remove private use characters", () => {
      const input = "abc\udb80\udc00def";
      const result = sharedUtils.stripUnprintableChars(input);
      assert.strictEqual(result, "abcdef");
    });

    it("should remove unassigned characters", () => {
      const input = "abc\u0378def";
      const result = sharedUtils.stripUnprintableChars(input);
      assert.strictEqual(result, "abcdef");
    });

    it("should return original string if no unprintable chars", () => {
      const input = "normal string";
      const result = sharedUtils.stripUnprintableChars(input);
      assert.strictEqual(result, "normal string");
    });

    it("should handle empty string", () => {
      const result = sharedUtils.stripUnprintableChars("");
      assert.strictEqual(result, "");
    });
  });

  describe("errorMessage", () => {
    it("should return error message for Error instance", () => {
      const error = new Error("Test error");
      const result = sharedUtils.errorMessage(error);
      assert.strictEqual(result, "Test error");
    });

    it("should return string for string input", () => {
      const result = sharedUtils.errorMessage("Some error");
      assert.strictEqual(result, "Some error");
    });

    it("should stringify number input", () => {
      const result = sharedUtils.errorMessage(123);
      assert.strictEqual(result, "123");
    });

    it("should stringify object input", () => {
      const result = sharedUtils.errorMessage({ msg: "fail" });
      assert.strictEqual(result, "[object Object]");
    });

    it("should handle null input", () => {
      const result = sharedUtils.errorMessage(null);
      assert.strictEqual(result, "null");
    });

    it("should handle undefined input", () => {
      const result = sharedUtils.errorMessage(undefined);
      assert.strictEqual(result, "undefined");
    });
  });
});
