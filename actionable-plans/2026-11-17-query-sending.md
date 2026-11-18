# Query sending and results (PLAN item 8)

Status: owner design agreed 2026-11-17, revised 2026-11-18; next step is `/plan-it` (probes first, then PR A). Multi-PR, so this file
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

**Chosen (owner, revised 2026-11-18):**

- **Default run** (line, selection, block, whole file — "run file" is just everything selected): the `.vscode` API
  when the server has it (`.vscode.getManifest` answers on connect, as today); otherwise **qStudio's wrapper, byte for
  byte** (`QueryManager.java:276–278`, unchanged since 2017-04-11 `4e33cd96`), because some sites detect it:

  ```
  {v:$[`trp in key .Q; .Q.trp[{( (1b;`) ;value x)};x;{((0b;`);x;$[4<count y; .Q.sbt -4 _ y; ""])}]; ((1b;`);value x)]; a:10485760j>@[-22!;v;{0}]; (a;$[a;v;0b];.Q.s v 1)} "<escaped query>"
  ```

  Sent as ONE string. Size cap `DEFAULT_MAX_RET = 10*1024*1024` (`MyPreferences.java:65`) → `10485760j`; `0Wj` = no
  cap. Escape (`KdbHelper.escape`, in order): `\`→`\\`, tab→`\t`, CR→`\r`, LF→`\n`, `"`→`\"`. Layouts:
  `(sizeOk; ((1b;`); result); consoleText)` / `(sizeOk; ((0b;`); errorMsg; stackTrace); consoleText)`. A unit test
  pins our string to this text for queries with quotes, backslashes, newlines and tabs.
- **"Execute Whole File as if loaded with \l"**: KX's lambda **sent exactly as upstream ships it** (never modified by
  us; it changes only with upstream merges, as it does for KX users), `returnFormat: "structuredText"`. Its history
  shows nobody can rely on its bytes (evaluateQ.q 32 commits incl. 20 in Jan 2025; formatQ.q 4 in 2026; queryWrapper()
  changed 2023-05/06, 2024-01/12, 2026-02, 2026-04×2), but we still leave it alone.
- **Per-server override** (setting on each connection): `auto` (above) | `naked` (exactly the user's text, nothing
  else) | `qstudio-wrap` | `vscode-wrap` (`.vscode` API if present, else KX's lambda).
- **Two result shapes, one renderer.** Triple (qStudio wrap): console = the server's `.Q.s` text; grid = typed value;
  over the 10 MB cap the triple carries text only → console as normal, grid shows "result too large for the grid,
  shown as text". JSON (`.vscode` API or KX lambda): grid from the structured JSON as today; console text from the
  existing `convertRows` (TypeScript, close to `.Q.s`). Naked: typed value → grid; console text from the same
  TypeScript cell/value formatter the grid uses. Never re-run a query to get the other format.
- **Grid setting** `peachq.results.grid`: `always` (default) | `never` (terminal purists). Replaces the Terminal /
  Results View toolbar dropdown. Results View updates without stealing focus.
- **Visible run target**: the target a file runs on (connection or REPL) is shown and chosen explicitly; "Run on
  active" routing never silently sends to a REPL. REPL results also reach the grid where the REPL can return a value.
- **Hints**: a default run that fails like a script needing script semantics (`'parse` on multi-line text, only the
  last statement ran) prints one console line pointing at the whole-file command or the per-server override, plus a
  GitHub link.
- **peachq args**: `peachq.peachqArgs`, default `["-classic"]`, for every peachq the extension starts; never for a
  user's own q.
- **For peachq**: `/home/ubuman/dev/rayforce/vscode-query.q` holds the exact qStudio wrapper string and KX lambda text
  with `qstudioRun` / `kxRun` helpers, so the peachq dev can (a) see what each does and (b) check peachq matches kdb.
- Rules to settle: "Every result renders everywhere it can; the console is the full log, the grid adds to it"; "We
  send qStudio's wrapper byte for byte and KX's lambda unmodified; anything else is the user's explicit override".

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

PR A: per-server override + default routing (`.vscode` or exact qStudio wrapper) + render both (triple and JSON shapes) + TS cell formatter + grid setting + visible run target + hints + `-classic`.
PR B: whole-file command relabel (KX lambda unmodified) + `\l` differential findings documented. Optional later: peachq
`vscode.q` library; a proper run-as-file if GitHub issues ask for it.
