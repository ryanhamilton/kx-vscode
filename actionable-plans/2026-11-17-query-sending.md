# Query sending and results (PLAN item 8)

Status: owner design agreed 2026-11-17; next step is `/plan-it` (probes first, then PR A). Multi-PR, so this file
carries the detail; `PLAN.md` item 8 points here.

## Problem

- **Either/or output.** One flag, `ext.isResultsTabVisible`, set by the editor-toolbar Terminal / Results View
  dropdown, picks where a result goes and what the server sends back: `serverCommand.ts:936`
  `isStringfy = !ext.isResultsTabVisible` → `localConnection.ts:186–194` `returnFormat: "text" | "structuredText"` →
  `formatQ.q:89–92` applies exactly one of `toString` (`.Q.s`) or `toStructuredText`. Default is the console
  (`extension.ts:197`).
- **Every editor query is wrapped, with no opt-out.** Unless the server has `.vscode` (`localConnection.ts:118–121`
  probes `.vscode.getManifest`), each query sends a lambda inlining `evaluateQ.q` + `formatQ.q`: about 9 KB of q per
  query (`queryUtils.ts:43–75`). Consequences:
  - the server's `.z.pg` sees the lambda, not the query, which breaks audit, entitlements and gateways (the code
    reports a gateway's reply as "unreadable", `localConnection.ts:207–210`);
  - it writes globals on the server (`.axq.i_PRIMCODE`, `.axq.i_NONPRIMCODE`; `.qp.display2` if `.qp` exists);
  - grid data is JSON of strings built in q (`.j.j`, one `.Q.s` per cell), not typed values.
- Not a version problem: it needs `-4!` (predates kdb 3.5, see qdocs releases/ChangesIn3.5.md:123) and `.Q.trp`
  (around 3.5), with a `.z.K <= 3.4` fallback for one split path. Upstream has had it since May 2023 (`fb2df9c4`,
  `2ae357d8`).

### How it got this way (upstream history)

1. 2024-06 `c97c3b4b`: the flag meant "is the Results panel visible" (`resultsPanelProvider.ts:56`
   `ext.isResultsTabVisible = webviewView.visible`): grid if the panel was showing, console text otherwise.
2. 2025-01 `2893f920`: the grid moved to server-built `structuredText`; the either/or stayed.
3. 2026-08 `11c74407`: the visibility heuristic became the explicit toolbar switch, default Terminal.

It was never forced: upstream already has a TypeScript structured→console renderer (`convertRows`,
`queryUtils.ts:260`, used for datasource results, `dataSourceCommand.ts:230`).

### What KX's wrapper does (`evaluateQ.q`, then `formatQ.q`)

Strips `/* */` block comments (`/` and `\` alone on a line), tokenises with `-4!`, strips trailing `;`, splits into
top-level statements (indented continuation lines kept), rewrites `\cmd` to `system "cmd"` and `q)`/`k)` prefixes to
`value`, saves `\d`, switches to the file's `ctx`, runs each statement as `value ";[::;stmt]"` under `.Q.trp` (stops at
the first error, cleans the backtrace so carets point at user code), restores `\d`, then formats the last value as
text or structured JSON (sampling 10 000 rows, item limit, key flags, type names).

### What qStudio's wrapper does (`QueryManager.java:267–278`)

```q
{v:$[`trp in key .Q; .Q.trp[{((1b;`);value x)};x;{((0b;`);x;backtrace)}]; ((1b;`);value x)];
 a:max>@[-22!;v;{0}]; (a; $[a;v;0b]; .Q.s v 1)} "query"
```

`value` of the text as-is (selection sent untouched: `CommonActions.java:177`), `.Q.trp` when available, `-22!`
size cap, returns `(sizeOK; typed value; .Q.s text)`. Optional in qStudio (`queryWrapped`).

## Viability (probed 2026-11-17)

| need | finding | verdict |
|---|---|---|
| both renderings | `formatQ.q` has both formatters; qStudio's wrapper returns value + text | works |
| `\` commands via `value` | documented: `value"\\t do[…]"` (qdocs kb/performance-tips.md:84) | works |
| multi-line text via `value` | qdocs defines multi-line only for scripts (basics/syntax.md:680; learn/tour/session.md:43–46 "no way in the session…") | **open** — owner's qStudio experience, then probe |
| `.Q.s` on peachq | matches kdb for tables, dicts, floats with nulls/infinities, lambdas; same with/without `-classic` | works, except: |
| char data inside general lists/dicts on peachq | `show (1 2;"hi")` → `h i`; kdb quotes (qdocs basics/internal.md:520) | peachq defect, in NOTES-FOR-PEACHQ.md |
| peachq `-classic` | a plain flag (rayforce user-docs/cmdline.md:75); `-classic 1` puts `"1"` in `.z.x` | use `-classic` |
| detecting peachq features | `` key `.pq `` AUTOLOADS `.pq` (missing-name read; rayforce docs/help-architecture.md:16); `` key ` `` does not | never probe by reading a `.pq` name |
| KX's `.vscode` probe on peachq | `.vscode.getManifest` is a missing-name read, so a peachq `vscode.q` library would autoload on it | option kept for later (below) |

## Constraints

Rule zero (kdb behaviour from qdocs or third-party code only). Headless tests. No marketing pop-ups; hints are console
lines. Changes to `serverCommand.ts`, `localConnection.ts`, `formatQ.q` diverge from upstream (accepted).

## Alternatives → chosen → what it rules out

Rejected or parked along the way: running the query twice (side effects); TS-only console text from structured data
(approximates q's text); content-based auto-detection of script semantics (fragile); a magic `// from-vs-code` comment
that peachq would honour (comments must not change semantics; no help on KX); `.z.pq` marker + `.pq.run_as_file`
(peachq change for a problem the explicit command solves); peachq shipping KX's `vscode.q` so `.vscode.getManifest`
autoloads it — parked as an optional peachq optimisation (would stop KX-extension users sending 9 KB to peachq; needs
`-u`/`reval` restrictions to hold).

**Chosen (owner):**

- **Default run** (line, selection, block): `.vscode` API when the server has it; otherwise the qStudio-style wrapper.
- **Whole file**: upstream's "Execute Entire File" relabelled **"Execute Whole File as if loaded with \l"**, using the
  KX wrapper. The label is only kept if the differential test below shows the wrapper matches `\l`; otherwise fix the
  wrapper or relabel "…as Script".
- **Per-server override**: `qstudio-wrap | vscode-wrap | as-is`.
- **Hints**: a default run that fails in a way that suggests script semantics (`'parse` on multi-line text, only the
  last statement ran) prints one console line pointing at the whole-file command or the `vscode-wrap` override, plus a
  GitHub link. Issue counts decide whether a better run-as-file is ever built.
- **Results always render both**: console gets the server's own `.Q.s` text (full, cut by the console size); tables
  also go to the grid, built from the typed value with a TypeScript cell formatter (port qStudio/peachq renderings);
  the Results View updates without stealing focus. The toolbar switch goes.
- **peachq args**: setting `peachq.peachqArgs`, default `["-classic"]`, for every peachq the extension starts (built-in
  server, REPL on bundled peachq, manual-test server); never for a user's own q.
- Rules to settle: "Every result renders everywhere it can; the console is the full log, the grid adds to it";
  "The default run sends the user's text as-is; script semantics are an explicit command".

## Success measures

- **Probes first** (in `/plan-it`):
  1. **`\l` differential test on peachq**: for each script in a corpus (`qdocs/good`, rayforce `qlib`, repo fixtures),
     fresh peachq A loads it with `\l`, fresh peachq B runs the same text through KX's wrapper; compare resulting
     state (every user namespace and value), printed output, first error and its line. Known suspects: context after
     the run (wrapper restores `\d`; `\l` unconfirmed), a lone `\` outside a comment block, `value ";[::;a:1]"`
     (peachq answers `::`, NOTES), `-4!` vs the script reader. Where peachq's `\l` disagrees with qdocs → NOTES.
  2. node-q decoding per q type (month vs date, timespan, GUID, nulls, infinities, nested lists, keyed tables).
  3. `value` on multi-line strings, `.Q.trp`, `-22!` on peachq vs qdocs.
  4. Upstream tests asserting the either/or switch (to be rewritten, listed in the PR).
- **Falsifying test**: one run of ``([]a:1 2 3;b:`x`y`z)`` → console has the server's text table AND the grid shows
  typed cells AND the server evaluated the user's code exactly once.
- Ledgers: unit 1933/2/0, e2e 312/1 pending/0, test:e2e:kx 5/0, test:e2e:bare 5/0, test:e2e:peachq 7/2 skipped,
  q-test 93/17/0, both walkthroughs — unchanged except listed either/or tests.

## What would unblock / order

PR A: setting + default routing (`.vscode` or qStudio wrapper) + render both + TS cell formatter + hints + `-classic`.
PR B: whole-file command relabel + KX wrapper returning both + `\l` differential fixes. Optional later: peachq
`vscode.q` library; a proper run-as-file if GitHub issues ask for it.
