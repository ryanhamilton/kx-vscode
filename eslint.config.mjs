import js from "@eslint/js";
import headerPlugin from "eslint-plugin-header";
import importPlugin from "eslint-plugin-import";
import licenseHeaderPlugin from "eslint-plugin-license-header";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import * as tseslint from "typescript-eslint";

const currentYear = new Date().getFullYear();

const header = (copyright) => [
  "/*",
  ` * ${copyright}`,
  " *",
  ' * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the',
  " * License. You may obtain a copy of the License at",
  " *",
  " * http://www.apache.org/licenses/LICENSE-2.0",
  " *",
  " * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an",
  ' * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the',
  " * specific language governing permissions and limitations under the License.",
  " */",
];
const PEACHQ_HEADER = header("Copyright (c) 2026 peachq contributors");
const KX_HEADER = header(`Copyright (c) 1998-${currentYear} KX Systems Inc.`);

// New files take the peachq header; files KX wrote keep KX's. A file passes
// if one header fits, else it is fixed to the header whose owner it already
// names (a stale KX year stays KX's), or to the first.
const licenseHeader = licenseHeaderPlugin.rules.header;
const peachqPlugin = {
  rules: {
    header: {
      meta: { ...licenseHeader.meta, schema: [{ type: "array" }] },
      create(context) {
        const runs = context.options[0].map((lines) => {
          const reports = [];
          const listeners = licenseHeader.create(
            Object.create(context, {
              options: { value: [lines] },
              report: { value: (report) => reports.push(report) },
            }),
          );
          const owner = lines[1].replace(/^ \* Copyright \(c\) [\d-]+ /, "");
          return { listeners, reports, owner };
        });
        return {
          "Program:exit"(node) {
            for (const run of runs) run.listeners.Program(node);
            if (runs.some((run) => run.reports.length === 0)) return;
            const head = context.sourceCode.text.slice(0, 200);
            const run = runs.find((r) => head.includes(r.owner)) ?? runs[0];
            for (const report of run.reports) context.report(report);
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [
      "**/*.d.ts",
      "**/*.js",
      "**/*.mjs",
      "**/.work/**",
      ".vscode-test/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    plugins: {
      header: headerPlugin,
      import: importPlugin,
      peachq: peachqPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "peachq/header": ["error", [PEACHQ_HEADER, KX_HEADER]],
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
// Modified by peachq contributors; see NOTICE.
