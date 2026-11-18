# Third-party scripts

Copied unchanged, each folder with its project's licence, as the corpus of
`test/e2e/lDiff.test.ts` (`npm run test:l-diff`). Taken 2026-11-18 from the
rayforce checkout's vendored corpus (`qdocs/good`, upstream commits as recorded
in its `qdocs/SOURCES.md`) and its `qlib`.

| Folder | Upstream | Commit | Licence |
|---|---|---|---|
| `qtips` | https://github.com/psaris/qtips | `14d6983b5414` | MIT |
| `q4q` | https://github.com/psaris/q4q | `260337e58cb8` | MIT |
| `reQ` | https://github.com/jonathonmcmurray/reQ | `6728dd50ed76` | MIT |
| `studyq` | https://github.com/qbists/studyq | `efe1da1a9c31` | CC0 1.0 |
| `qspec` | https://github.com/nugend/qspec | `9b846b68a8d8` | MIT |
| `TorQ-Finance-Starter-Pack` | https://github.com/DataIntellectTech/TorQ-Finance-Starter-Pack | `346649321883` | MIT |
| `rayforce-qlib` | rayforce (peachq) `qlib/` | `cc06989c2f78` | MIT |

Chosen to be small and self-contained: no network, no data files, no `\l` of
other files. Scripts that load a sibling (`qtips/cep.q`), read a data file
(`studyq/euler/08.q`), print timings (`studyq/leetcode/53.q`) or take seconds
(`studyq/euler/04.q`) were left out. `lodash` and `kdb-utilities` carry no
licence and `quantQ` is GPL, so none of theirs were copied.
