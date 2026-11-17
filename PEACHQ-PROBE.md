# peachq VS Code extension: strip probe

This is a probe of `ryanhamilton/kx-vscode`, which forks KxSystems/kx-vscode 1.21.0 (`main` at `9ddec87c`, Apache-2.0).
The probe asks one question: what does it take to make this an open-source extension for peachq? It answers in two parts.

- **Part 1** is the inventory, with every finding in exactly one group.
- **Part 2** is a first best-guess pass on branch `peachq/strip-probe`.

Every `file:line` below refers to **origin/main**, the unmodified upstream, unless it says otherwise.
"Done" means the change is on this branch. "Ruling" marks a row the owner decides.
"peachq" is a placeholder name throughout; the renamed-ids list below lets the rename be redone mechanically.

Groups: **1** trademark/branding · **2** not fully open source (licences, telemetry, KX services, closed binaries)
· **3a** q wrappers sent to a server · **3b** features that only make sense with a KX product.

## Part 1: inventory

### Group 1: trademark and branding (22)

| # | item | file:line | proposal | evidence | ruling? |
|---|---|---|---|---|---|
| B1 | `name`/`displayName` `kdb` | package.json:2-3 | replace → `peachq` (done, placeholder) | brand name as product name | yes, final name |
| B2 | `publisher` `KX` → extension id `KX.kdb` | package.json:5 | replace → `peachq` / `peachq.peachq` (done) | id appears in tests as `getExtension("KX.kdb")` (test/e2e/utils/index.ts:145) | yes, marketplace publisher + Open VSX namespace |
| B3 | Marketplace icon `kx-logo-vs.png` | package.json:7 | replace → neutral placeholder `resources/images/peachq-logo.png` (done) | KX logo | yes, real logo |
| B4 | Activity-bar/panel icon `kx_logo.svg`; also `kx_logo-dark.svg`, `resources/{dark,light}/kx_logo.png`, `kx_welcome.png` | package.json:635,642 | delete + placeholder `peachq-logo.svg` (done) | KX logos | yes, real logo |
| B5 | Description "IDE support for kdb product suite…"; keywords `kdb`,`kdb+`,`kdb-x`,`kdb Insights` | package.json:4,22-28 | replace → "IDE support for the q programming language with peachq", keywords `q`,`peachq` (done) | trademarks used for discovery | yes: is `kdb+` allowed as a factual keyword? |
| B6 | `repository`/`bugs` → KxSystems; `homepage` `https://kx.com` | package.json:8-11,1286-1289 | replace → the fork's URLs; homepage dropped (done) | KX URLs | yes, final repo |
| B7 | 60 command ids `kdb.*`, `category: "KX"` (~30), titles `KX: …`, `kdb Results View` | package.json:160-460 | rename `kdb.` → `peachq.`, `KX` → `peachq` (done; list below) | brand in ids/titles | yes, final prefix |
| B8 | 20 setting keys `kdb.*`, config title `kdb` | package.json:38-150 | rename → `peachq.*` (done) | brand in keys; no migration written (0.x, users saved nothing) | yes |
| B9 | View/container ids `kdb-explorer`, `kdb-servers`, `kdb-results`, `kdb-scratchpad-explorer`, `kdb-query-history`; titles `KX`, `KDB Results` | package.json:630-680 | rename → `peachq-*`, `peachq`, `peachq Results` (done) | brand in UI | yes |
| B10 | Notebook type `kx-notebook`, "KX Notebook", controller id `kx-notebook-1`, language ids `kxnotebook`/`kdbplot`, viewType `kdb.chartEditor` | package.json:1276; src/services/notebookController.ts:54-56 | rename → `peachq-notebook`, "peachq Notebook", `peachqnotebook`, `peachqplot`, `peachq.chartEditor` (done) | brand in UI | yes |
| B11 | File formats `.kxnb`, `.kdb.q`/`.kdb.py`/`.kdb.sql` workbooks, workbook folder `.kx`, default q home `~/.kx` | package.json:615,1278; src/utils/workspace.ts:67; src/utils/core.ts:256 | **kept** in this pass (renaming breaks existing files) | brand in file names | **yes**: rename to e.g. `.pqnb`, `.peachq/`? |
| B12 | REPL title `KX REPL` and banner "Copyright (C) 1993-… KX Systems" | src/classes/replConnection.ts:108,199 | rename → `peachq REPL`; the copyright banner line is removed (done) | the banner claimed KX authorship of the session | no |
| B13 | Console terminal names `KX <conn>`, tooltip `KX: Choose connection` | src/classes/connectionConsole.ts:103,214; src/commands/workspaceCommand.ts:152 | rename → `peachq …` (done) | brand in UI | no |
| B14 | Hint text "kdb Results View" | src/classes/connectionConsole.ts:44; src/extension.ts:247 | rename → "peachq Results View" (done) | brand in UI | no |
| B15 | ~39 user-facing strings that say kdb/KDB, e.g. "Please connect to a KDB instance", "Created kdb connection.", connection type label `kdb` | src/** (`grep -rniE '"[^"]*\bkdb\b'`) | **left**; reword the branded ones and keep the factual "kdb+ IPC" ones | mixed brand and factual use | **yes**, case by case |
| B16 | README: KX product copy, KX CI badges, "collects usage data and sends it to KX" | README.md:1-40 (telemetry claim :35) | replace with a neutral README (done) | brand; the telemetry claim is false now | yes, final copy |
| B17 | CHANGELOG (811 lines of KX release history) | CHANGELOG.md | keep as history, or truncate with a pointer to upstream | historical attribution | yes |
| B18 | docs/ (user + developer, code.kx.com links, `sample-kx-notebooks.md`, `kxi-*` pages), the upstream AI-assistant guide at the repo root, release_process.md, secure-processes.md, `.github/CONTRIBUTING.md`, issue templates | docs/**, .github/** | **left**; rewrite or delete with the final name | brand + Insights content | yes |
| B19 | Internal, non-visible names: custom elements `kdb-results-view`/`kdb-select`/…, context values `kdbVariable`, result schema `vscode-kdb-q`, `ext.kdb*` vars, `.axdebug`/`.axq` q namespaces | src/webview/components/*; src/extension.ts:257; resources/q/evaluateQ.q:128 | **left**; rename opportunistically | not user-visible except `.axdebug` (inserted into user code, see 3b K14) | low |
| B20 | Links to `https://code.kx.com/q/kb/ssl/` in the TLS error dialogs | src/commands/serverCommand.ts:400,828 | keep (factual reference docs) or point at peachq docs | factual | yes |
| B21 | Completion items with KX wording (e.g. "Kx logo" detail) | src/services/completionProvider.ts:1069 | trivial reword | brand | no |
| B22 | Apache header "Copyright (c) 1998-2026 KX Systems Inc." on every .ts, enforced by eslint `license-header` | eslint.config.mjs; every src/*.ts | **keep** on KX files (Apache §4(c)); NOTICE added (done). New file `test/e2e/peachq.test.ts` carries the same header because the lint rule demands it | §4 obligations | **yes**: header for files peachq writes |

### Group 2: not fully open source (15)

| # | item | file:line | proposal | evidence | ruling? |
|---|---|---|---|---|---|
| N1 | Telemetry: `@vscode/extension-telemetry` 1.4.0 → Microsoft Application Insights | package.json:1338; src/utils/telemetryClient.ts; src/extension.ts:152-162 | **removed** (done) | sends usage + errors to KX | no |
| N2 | Application Insights connection string, `InstrumentationKey=7efda3fc-…`, ingestion `eastus-8.in.applicationinsights.azure.com` | package.json:12 | **removed** (done) | KX-owned key | no |
| N3 | ~54 `notify(…, {telemetry: …})` event sites + LSP server telemetry events + label "measurements"; `kdb-telemetry` output channel | src/utils/notifications.ts:118-145; server/src/qLangServer.ts:217-569; src/utils/output.ts:42 | **removed** (done) | event names like `Connection.Create.kdb` | no |
| N4 | `@microsoft/applicationinsights-*` overrides | package.json:1382-1385 | **removed** (done; lockfile updated, 11 packages gone) | - | no |
| N5 | KX web services: newsletter opt-in nag, Maze survey, KX forum, KX GitHub bug link | src/extensionVariables.ts:142-154; src/utils/registration.ts; src/utils/feedbackSurveyUtils.ts; src/services/helpFeedbackProvider.ts | **removed** (done) | marketing/feedback calls to KX | no |
| N6 | Licence/download flows: Insights PE licence download, `nexus.dl.kx.com/repository/kdb/4.0/`, tokenised `downloads.kx.com` URL, `kc.lic` base64 licence writer | src/extensionVariables.ts:147-157; src/utils/core.ts:536-543 | **removed** (done) | KX licence acquisition | no |
| N7 | KDB-X installer: runs `portal.dl.kx.com/.../install_kdb.sh`, welcome page (developer.kx.com) | src/commands/setupCommand.ts:165-310,193; src/webview/components/kdbWelcomeView.ts:139 | **removed**; `showSetupError` now points at the q home setting ("set it to a peachq build") (done) | downloads a KX binary | yes: offer a peachq installer instead? |
| N8 | Insights OAuth/REST: keycloak `auth/realms/insights/...`, `servicegateway/*`, `kxicontroller/config`, `servicebroker/scratchpad` | src/extensionVariables.ts:165-190; src/services/kdbInsights/codeFlowLogin.ts; src/classes/insightsConnection.ts | **removed** (done; see 3b) | KX product API | no |
| N9 | Writes Insights packaging schemas from `code.kx.com/insights/...` into the user's global `yaml.schemas` | src/extension.ts:378-399 | **removed** (done) | modified global user settings for a KX product | no |
| N10 | qlint: runs the closed `$AXLIBRARIES_HOME/ws/qlint.q_` through q (command "Lint file with qlint") | src/commands/buildToolsCommand.ts:55-267 | **removed** (done; the built-in Chevrotain linter in server/src/linter stays) | closed KX tool | no |
| N11 | qcumber: `qcumber.q` loads closed `qcumber.q_`; `qcumber.sh` pulls private image `registry.gitlab.com/kxdev/cloud/packaging/qpacker/qpbuild:2.1.41` and needs a kdb+ `k4.lic`; `npm run q-test`; test/q/*.quke; workflow q-api.yml | qcumber.q:1; qcumber.sh:7-32; .github/workflows/q-api.yml | **left** on branch; proposal: delete and port the wrapper tests to peachq's qunit (3a table = the spec) | closed lib + licence + private registry | **yes** |
| N12 | CI needs KX secrets: GitLab registry creds + `KDB_K4LICENSE_B64`; SonarQube scan | .github/workflows/dev.yml:72-81, main.yml:64-81, app-sec-template.yml:37; sonar-project.properties | **left**; proposal: replace with a peachq-backed CI (no licence needed) | KX infra | **yes** |
| N13 | Marketplace publishing workflows (VSCE_PAT, OPEN_VSX_TOKEN) | .github/workflows/publish.yml, prod_release.yml:117,151 | **deleted** (done), so nothing can publish from this fork by accident | - | yes, when to publish |
| N14 | `KX.kdb-auth` custom-auth hook: activates a separate KX extension and lets it rewrite connection credentials | src/extension.ts:407-416; src/models/customAuth.ts | **kept** (a generic hook; harmless if absent) | depends on a KX extension id | **yes**: keep, rename to a peachq auth API, or drop |
| N15 | npm licence check (below): no non-OSI licence is shipped in the bundle; the non-OSI hits are packaging/test tools | `npx license-checker@25.0.1` | keep `@vscode/vsce` (packaging tool, Microsoft-licensed `vsce-sign`), or package with `ovsx`/plain zip | see licence section | yes, if strict "OSS toolchain" |

**PyKX** (3b K12) and **KDB-X module paths** (3b K13) are KX products the code *integrates with*, not code it ships, so they sit in 3b.

### Group 3a: q wrappers sent to a server (30 rows)

Tested on 2026-11-17 against `peachq q-rel` (dev `c15f8ad85`) over kdb IPC with node-q 2.7.0. Each wrapper was sent exactly as the extension
builds it, with realistic queries inside. Harness and raw outputs are in the probe's scratch dir (not committed). Proposal for all
pass rows: **keep**. "Fail" rows are peachq gaps or extension assumptions.

| # | wrapper | source | exact q (abridged where long) | result on peachq | actual output / error | proposal |
|---|---|---|---|---|---|---|
| 1 | API probe | src/classes/localConnection.ts:111 | `.vscode.getManifest` (arg null) | pass | `'.vscode.getManifest` on a plain server, so the extension uses lambdas | keep |
| 2 | Query lambda, text | src/utils/queryUtils.ts:43-75 + resources/q/evaluateQ.q + formatQ.q | `{[args] evaluateQ: <evaluateQ.q> ; formatQ: <formatQ.q> ; formatQ[args; evaluateQ args] }` with dict `ctx code returnFormat sampleFn sampleSize` | pass 21/21 | table `"a b\n---\n1 x\n…"`, keyed `"k\| v \n-\| --\n…"`, `\t`→`"0\n"` | keep |
| 3 | same, errors | same | same | pass | `{"error":true,"errorMsg":"type","stacktrace":"  [1]  1+`a\n        ^\n"}` (`.Q.trp`+`.Q.sbt`) | keep |
| 4 | same, `ctx` | same (`system "d ",ctx`) | same, ctx `.foo` | pass | evaluated in `.foo`, restored to `.` | keep |
| 5 | Query lambda, structuredText | formatQ.q (`.j.j`, `.Q.qt`, `.Q.qp`, `attr`, `TABULAR_LIMIT`) | same, `returnFormat:"structuredText"` | pass 21/21 | JSON parses; types, keys, `attributes:"s"`, nulls are right | keep |
| 6 | TABULAR_LIMIT truncation | formatQ.q | `til 700000` | pass | 600000 + truncation warning | keep |
| 7 | Text clip | formatQ.q `.Q.s` | 100-row table | pass | clipped at `\c 25 80` with `..` (the same law as kdb) | keep |
| 8 | PNG bytes passthrough | localConnection.ts:186-190; queryUtils.ts `resultToBase64` | `read1 hsym`$"x.png"` | pass | bytes come back as a `bytes` column; the client sniffs the signature → Chart Viewer (also proved in the smoke test) | keep |
| 9 | listMem (lambda) | localConnection.ts:238,256 + resources/q/listMem.q | `"\n", <listMem.q>` arg null | pass | 10-column table, correct typeNum/isNs | keep |
| 10 | Reserved words | localConnection.ts:306 | `{.Q.res}` / `.vscode.reservedWords` | **wrong-result** | 7 words (`do if while select exec update delete`); KX dotq.md:1905 documents the k keyword list | **peachq fix**: `.Q.res` (affects completion only) |
| 11 | Views | src/services/kdbTreeService.ts:112 | `views` / `.vscode.getViews` | pass | `[]` then `["vv"]` | keep |
| 12 | API file | resources/q/vscode.q (built by build-api.js) | `\l out/vscode.q` | pass | loads, `\d` back to `.` | keep |
| 13 | API getManifest | vscode.q:16 | `.vscode.getManifest` | pass | `` `version`features!("1.0.0";`evaluateQ`listMem) `` | keep |
| 14 | API query | vscode.q:41-73 | `.vscode.runQQuery` | pass | same as rows 2-6 | keep |
| 15 | API listMem/getViews/reservedWords | vscode.q | `.vscode.listMem` … | pass / pass / wrong (row 10) | - | keep |
| 16 | API Python stub | vscode.q:37 | `.vscode.runPyQuery` | pass | fixed "not yet supported" dict | keep |
| 17 | `.vscode.customQEvaluator` hook | vscode.q:45-61 | user-defined evaluator (example :76-82) | pass, stacktrace unverified | allow/reject works; `stacktrace` is `""` (the frame slicing leaves nothing; kdb's frame list cannot be checked clean-room) | keep; owner witness for the stacktrace |
| 18 | secure.q locked-down process | resources/q/secure.q | `.z.pg:.z.ps:.secure.handleIPC` | pass | named calls allowed; strings/lambdas/`.vscode.i.*` refused | keep |
| 19 | Python lambda | queryUtils.ts:53-58 + resources/q/evaluatePy.q | `<evaluatePy.q>` with `code returnFormat sample_fn sample_size` | **fail** (expected) | `".pykx is not defined: please load pykx"` | ruling (3b K12) |
| 20 | Python wrapper | queryUtils.ts:219-226 | `{[args] res:<evaluatePy.q> args;$[res`error;res`errorMsg;res`data]}[…]` | **fail** (expected) | same PyKX dependency | ruling (3b K12) |
| 21 | SQL wrapper | queryUtils.ts:238-240 | `s)<query, newlines → spaces>` | pass with `PEACHQ_DUCKDB_LIB` | `s)select 1` → `"1\n-\n1\n"`; without the lib `'duckdb` | keep |
| 22 | SQL over a q table | same | `s)select * from t` | **fail** | `'duckdb` "Table with name t does not exist": peachq `s)` is DuckDB and cannot see q globals | peachq ruling (s) semantics) |
| 23 | REPL handler, q mode | src/classes/replConnection.ts:379-416 | `.z.pi:{show value x;1 {x}"<uuid>@",string[system"d"],"@";2 {x}"<uuid>@",string[system"d"],"@";};` | pass for expressions | tokens on both pipes; namespace tracking works | keep |
| 24 | REPL, system lines | same | `\d .foo`, `\t …` sent as lines | **fail, REPL hangs** | peachq runs `\` lines without calling `.z.pi`, so no tokens come back | peachq fix (kdb routes them through `.z.pi`?) or extension change; ruling |
| 25 | REPL, error | same + error sniff `/'\d{4}\.\d{2}\.\d{2}T/` (:736) | ``1+`a`` | **fail, REPL hangs** | trace printed instead of kdb's `'<timestamp> type` line; the trace also shows the handler source and uuid | peachq fix (console error format) |
| 26 | REPL, echo/display | spawn `bash -c q` (:358) | - | **wrong-result** | peachq echoes piped stdin lines; default mode prints pipe tables (`-classic` prints kdb text, still echoes) | peachq fix (no echo on non-tty) or spawn with `-classic`; ruling |
| 27 | REPL, k mode | :253, `$:[."\\d"]`, read0 stub :400-404 | `\` then k tokens | **fail** | no k mode: `'.`, `'!` | ruling: drop k-mode support in the extension? |
| 28 | Parameter cache | src/commands/clientCommand.ts:78-79 | `.axdebug.temp<HEX6>: (a;b);` + `` `a`b set' .axdebug.temp<HEX6>; `` | pass | globals set as expected | keep (rename `.axdebug`, B19/K14) |
| 29 | qcumber / .quke tests | qcumber.q:1, test/q/* | `system "l ",getenv[`AXLIBRARIES_HOME],"/ws/qcumber.q_"` | not runnable | needs closed KX lib + licence | see N11 |
| 30 | Insights-only q (REST payloads, not IPC) | src/models/query.ts:124,134 (`.kxi.getData`, `.kxi.preview`); insightsConnection.ts:363-421,906; scratchpadLogger.ts:199 (`.com_kx_edi.showImage`); uda.ts (`.kxi.metaParam`) | - | n/a | listed only | removed with Insights |

peachq has every primitive the IPC wrappers use: `-4!`, `.Q.trp`, `.Q.sbt`, `.Q.s`, `.Q.s1`, `.Q.qt`, `.Q.qp`, `.Q.btoa`, `.z.K`, `.j.j`,
`reval`, `views`, `attr`, `getenv`, `like`, `ss`.
The gaps are `.Q.res`, the REPL console contract (rows 24-27), `s)` over q tables, and PyKX.

### Group 3b: KX-product features (16)

| # | item | file:line | proposal | evidence | ruling? |
|---|---|---|---|---|---|
| K1 | Insights Enterprise connections (new-connection Insights tab, realm/insecure fields, Insights tree nodes) | src/classes/insightsConnection.ts; src/webview/components/kdbNewConnectionView.ts; src/services/kdbTreeProvider.ts | **removed** (done) | KX product | no |
| K2 | Data sources (`.kdb.json`, converter editor, DataSourceFiles) | src/commands/dataSourceCommand.ts; src/services/dataSourceConverterProvider.ts; src/models/dataSource.ts | **removed** (done) | Insights-only (`instanceof LocalConnection → return`, dataSourceCommand.ts:74,123) | no |
| K3 | Query editor `.kxquery` (getData/UDA/qSQL/SQL) + "Queries" view | src/services/queryEditorProvider.ts; src/webview/components/kdbQueryView.ts; src/webview/query.ts | **removed** (done) | needs Insights meta (queryEditorProvider.ts:100-120) | yes: build a kdb+-IPC query editor later? |
| K4 | UDAs, `.kxi.getData`, `.kxi.preview` | src/models/uda.ts; src/utils/uda.ts | **removed** (done) | Insights API | no |
| K5 | Scratchpads (populate/reset, scratchpad logger, `.com_kx_edi.showImage`) | src/classes/scratchpadLogger.ts; package.json `kdb.file.populateScratchpad`, `kdb.scratchpad.reset` | **removed** (done) | Insights service | no |
| K6 | Meta views (getMeta, "Open meta object", meta content provider) | src/services/metaContentProvider.ts; serverCommand.ts | **removed** (done) | Insights servicegateway/meta | no |
| K7 | DAP execution targets + Insights timeouts (`kdb.targetMap`, `kdb.timeoutMap`, `kdb.defaultTimeout`, pickTarget/pickTimeout) | package.json; src/commands/workspaceCommand.ts | **removed** (done) | Insights-only | no |
| K8 | KDB-X welcome / installer / licence | see N6-N7 | **removed** (done) | KX product | no |
| K9 | Help & Feedback view (docs, feature request, survey, bug report) | src/services/helpFeedbackProvider.ts | **removed** (done) | KX links | yes, peachq equivalents |
| K10 | Insights e2e harness (fake Insights HTTPS server, OAuth stand-in, certs) | test/e2e/utils/insights*.ts | **removed** (done) | - | no |
| K11 | REPL that spawns a local q from `qHomeDirectory` | src/classes/replConnection.ts | **keep**; works with peachq for expressions, hangs on `\` lines and errors (3a 24-27) | - | peachq console fixes, see next steps |
| K12 | Python workbooks/notebook cells via PyKX (`PYKX_EXECUTABLE`, evaluatePy.q) | src/classes/replConnection.ts:343; resources/q/evaluatePy.q | **kept**; does not work on peachq | PyKX is a KX product needing a kdb+ licence | **yes**: keep for kdb+ users or remove |
| K13 | KDB-X module path (`QPATH` → `<base>/mod`), `qBinKdbX` detection | src/utils/core.ts:139-174; replConnection.ts:333; src/utils/replPath.ts | **kept** (harmless) | KDB-X-specific | yes: does peachq want `mod/`? |
| K14 | `.axdebug.temp*` parameter cache inserted into user code | src/commands/clientCommand.ts:66-79 | **keep**, rename the namespace (`.peachq.dbg`?) | `.ax*` = KX "analyst" namespace | yes |
| K15 | `.vscode` API + secure.q for locked-down processes | resources/q/*.q; secure-processes.md | **keep** | works on peachq (3a 12-18) | no |
| K16 | `.quke` language (qcumber feature files): highlighting, linter rule, run flag | server/src/parser/language.ts:72; server/src/linter/rules.ts:76; src/commands/workspaceCommand.ts:844 | **kept** | quke runner is closed KX qcumber | yes: keep syntax only? |

**Counts:** group 1: 22 · group 2: 15 · group 3a: 30 wrapper rows (20 pass, 2 wrong-result, 6 fail, 1 not runnable, 1 n/a) · group 3b: 16.

## Renamed ids (redo with the final name)

The rebrand is the script `rebrand.py` (rules below) plus the package.json metadata edits. To redo it, replace `peachq` in these rules:

- `kdb.<id>` → `peachq.<id>`: every command id, setting key, `setContext` key, `when` key, viewType and LSP request (`kdb.qls.*`), in package.json, src, server, test and docs.
  The match is not preceded by `.`, so the file extensions `.kdb.q`/`.kdb.py`/`.kdb.sql` are untouched.
- `getConfiguration("kdb")` and the LSP `section: "kdb"` → `"peachq"`; output channel and diagnostic collection `kdb` → `peachq`.
- View/container ids `kdb-{servers,explorer,results,scratchpad-explorer,query-history}` → `peachq-…`.
- `kx-notebook` → `peachq-notebook`, `kxnotebook` → `peachqnotebook`, `kdbplot` → `peachqplot`, controller `kx-notebook-1` → `peachq-notebook-1`.
- Extension id `KX.kdb` → `peachq.peachq` (`name`/`publisher`).
- Titles: category `KX` → `peachq`, `KX: ` → `peachq: `, `KDB Results`/`kdb Results View` → `peachq Results`/`peachq Results View`,
  `KX Notebook` → `peachq Notebook`, activity bar `KX` → `peachq`, `KX REPL` → `peachq REPL`, console `KX <conn>` → `peachq <conn>`.

Commands now (42):
`connections.{add, add.kdb*, addAuthentication, connect, connect.via.dialog, content.selectView, disconnect, edit, edit.kdb*, enableTLS,
export.all, export.single, import, labels.{add*, delete, edit, rename}, refresh.serverObjects, remove.kdb, setActive}`,
`createNotebook`, `execute.{block, fileQuery, selectedQuery}`, `file.{delete, pickConnection, rename}`,
`queryHistory.{clear, copyQuery, rerun}`, `repl.{openFolder, start}`, `results.destination.{terminal, view}`,
`resultsPanel.{clear, export.csv, update}`, `scratchpad.{create, explorer.refresh, python.create, python.run, python.run.file, run,
sql.create}` (workbooks; the name "scratchpad" is upstream's), `toggleParameterCache`. (* = registered in code, not in package.json.)

Settings now (11): `servers, hideDetailedConsoleQueryOutput, hideSourceExpressions, autoFocusOutputOnEntry, qHomeDirectory,
qHomeDirectoryWorkspace, linting, refactoring, connectionMap, connectionLabels, labelsConnectionMap`.

Context keys: `connected, connected.active, pythonEnabled, QHOME, showResultsInView, kdbNodesWithoutAuth, kdbNodesWithoutTls,
kdbQHCopyList, kdbQueryHistoryList, kdbQuickNodes, rootNodes, selectContentNodesContext, local, results.destination.{terminal,view}Menu`;
LSP: `qls.expressionRange, qls.parameterCache`; custom editor `chartEditor`.

Removed without a rename: commands `show.welcome, install.kdbx, help.*, ls.q.lint, connections.{refresh.meta, open.meta, remove.insights},
file.{pickTarget, inputVariable, populateScratchpad, pickTimeout}, scratchpad.reset, scratchpad.editor.reset, query.{create, refresh, convert}`.
Settings removed: `insights, insightsEnterpriseConnections, hideInstallationNotification, neverShowQInstallAgain,
hideSubscribeRegistrationNotification, hideSurvey, targetMap, timeoutMap, defaultTimeout`.
Views removed: `kdb-query-explorer, kdb-help-feedback-view`.
Editors/languages removed: `kdb.queryEditor, kdb.dataSourceConverter, kxquery`.

## Licence check

Command: `npx license-checker@25.0.1 --summary`, run on 2026-11-17 against upstream `npm ci`.
The full tree has 652 packages: MIT 530, ISC 41, Apache-2.0 30, BSD-3 28, BSD-2 21, BlueOak 10, Artistic-2.0 5, plus small OSI ones.
`--production` lists only the package itself: every dependency is a devDependency and the runtime pieces are bundled into `out/` by esbuild.

Not OSI-approved or unknown:

| package | licence | pulled by | shipped in the .vsix? |
|---|---|---|---|
| @vscode/vsce-sign 2.1.0 | Microsoft proprietary ("use only with Visual Studio products") | @vscode/vsce (packaging) | no |
| @vscode/vsce-sign-linux-x64 2.0.6 | UNKNOWN (same Microsoft terms) | same | no |
| @vscode/codicons 0.0.46-24 | CC-BY-4.0 | query editor only | upstream copied `codicon.ttf` into out/. **Dependency removed** with the query editor |
| @azu/style-format 1.0.1 | WTFPL | vsce → secretlint | no |
| mdn-data 2.27.1 | CC0-1.0 | jsdom (tests) | no |
| spdx-license-ids / spdx-exceptions | CC0 / CC-BY-3.0 | licence metadata (tooling) | no |

The branch removed these dependencies: `@vscode/extension-telemetry` (and the 11 Application Insights packages under it),
`axios`, `jwt-decode`, `pick-port`, `@vscode/codicons`.
No bundled binary with an unclear licence ships. The KX-authored SVG icons in `resources/{dark,light}` are Apache-2.0 with the repo.

## Test-suite results

All "after" runs use a **headless** VS Code 1.146.0 (`--ozone-platform=headless`, `DISPLAY`/`WAYLAND_DISPLAY` unset), so no window
reaches any desktop. New scripts: `npm run test:headless`, and `HEADLESS=1` for `runE2E.js`.

| run | passing | pending | failing | note |
|---|---|---|---|---|
| upstream baseline, unit suite (`npm test`) | 1771 | 2 | 2 | the 2 failures are the newsletter timer firing mid-test (`notify(...).then is not a function`), which this branch removes |
| branch, unit suite (`npm run test:headless`) | **1058** | 2 | **0** | |
| branch, e2e suite (`HEADLESS=1 runE2E.js`, peachq smoke included) | **161** | 0 | **0** | upstream e2e was not run (it needs its Insights stand-ins) |

Where the 713 unit tests went:
- 506 were in 19 deleted test files: Insights 44, scratchpadLogger 19, dataSourceCommand 43, queryCommand 21, setupCommand 6,
  codeFlowLogin 20, dataSourceConverterProvider 3, helpFeedbackProvider 4, metaContentProvider 2, queryEditorProvider 34, datasource 5,
  feedbackSurvey 16, query 76, registration 9, telemetryClient 4, uda 100, kdbQueryView 88, kdbWelcomeView 7, buildToolsCommand 5.
- About 219 Insights cases were cut from kept files.
- About 15 new-connection-form tests that referenced the Insights tab were deleted rather than adapted. That form now has thinner coverage; follow-up.

e2e deletions: insights 39, query 41, scratchpad 7, meta 6, welcome, and the two "does not populate a scratchpad" cases.
One console test now sets the results destination itself: it had depended on a deleted Insights file running before it.

`tsc --noEmit`, `npm run build` and `eslint --quiet` are clean.

Caveat: some intermediate unit runs on the real display died early. The owner was closing the test windows, so those runs are discarded.
Every number above comes from a headless run.

## Smoke test against peachq (what was actually proved)

`test/e2e/peachq.test.ts` is skipped unless `PEACHQ_PORT` is set.
It ran in the real extension host of a headless VS Code against `/home/ubuman/dev/rayforce/q-rel -p 15911`.
A side IPC connection installs `.z.pg` logging on the server, so the test sees what the extension actually sends.

| step | how | result |
|---|---|---|
| connect | `peachq.connections.add.kdb` + `peachq.connections.connect.via.dialog` (the extension's own commands) | **pass**: the socket opens (`count .z.W` ≥ 2) and peachq logs the `.vscode.getManifest` handshake, then the listMem lambda |
| run query | open `peachq.q` (mapped to the connection) → `peachq.execute.fileQuery` | **pass**: peachq receives the evaluate lambda and evaluates the file (`t` exists server-side, `exec n from t` = `1 2 3`) |
| results grid | the extension's `queryWrapper` sent to peachq → its `convertToGrid` → posted as `setGridDatasource` to the real `kdb-results-view` webview component | **pass**: headers `sym symbols, px floats, n longs`; rows `` `b 2.5 2 `` / `` `c 3.5 3 `` |
| chart | a file whose query returns PNG bytes (`read1 hsym`$"…png"`) → `peachq.execute.fileQuery` with results to the view | **pass**: the extension opens `.kx/plot-1.plot` in the Chart Viewer custom editor with a `data:image/png;base64,iVBORw0KGgo…` chart |

Not proved:
- Pixels. Nothing was looked at; headless means no screenshot.
- The results-panel provider's own post to its panel webview, which tests cannot reach. The grid step joins the same functions in the test instead.
- Any clicking.
- `kdb.QHOME`-based REPL against peachq: it is covered by 3a rows 23-27 at the stdin level, not in VS Code.

## Recommended next steps

1. Owner rulings, in this order (each blocks a mechanical pass): final name/publisher/logo (B1-B4, B7-B10) → file formats (B11) →
   `KX.kdb-auth` hook (N14) → Python/PyKX (K12) → qcumber/CI (N11, N12) → docs/CHANGELOG (B17, B18) → user-facing strings (B15).
2. Redo the rename with the final name using the rules above; delete the dead `isInsights` parameters (29 occurrences, always false)
   and the now-unreachable image/Populate paths.
3. peachq-side fixes for the REPL contract: route `\` lines through `.z.pi`; give the `'<timestamp> err` console error line;
   no echo on non-tty stdin. Also fix `.Q.res`. Each needs a kdb-truth pin first. Then decide on k mode.
4. Replace the closed qcumber suite with a peachq qunit suite that runs the 3a wrappers. The 3a table is the spec.
5. CI on GitHub Actions with a peachq binary (no licence, no private registry), running `test:headless` + e2e with `PEACHQ_PORT`.
6. Rewrite README/docs with the final name, then package with `vsce` (or `ovsx`) and publish only on the owner's go.
