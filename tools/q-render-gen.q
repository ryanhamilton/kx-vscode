/ Copyright (c) 2026 peachq contributors
/ SPDX-License-Identifier: Apache-2.0
/ npm run gen:q-render: test/fixtures/q-render/corpus.txt -> expected.tsv, run by peachq -classic from the repo root.
/ Texts are of -9!-8!v, the value a client receives (enums arrive as symbols), so the oracle sees what the decoder sees.
if[not 10h=type @[value;`.pq.version;0]; -2 "q-render-gen: this q is not peachq (no .pq.version), refusing to run"; exit 1];
dir:"test/fixtures/q-render/";
esc:{ssr[ssr[ssr[ssr[x;"\\";"\\\\"];"\t";"\\t"];"\n";"\\n"];"\r";"\\r"]};
unesc:{ssr[ssr[ssr[ssr[x;"\\\\";"\001"];"\\t";"\t"];"\\n";"\n"];"\001";"\\"]};
at:{[c;f;v] system "c ",c; r:f v; system "c 25 80"; r};
cell:{rtrim ("\n" vs .Q.s flip (enlist`c)!enlist $[0>type x;enlist x;@[enlist(::);0;:;x]]) 2};
names:`console`consoleSmall`consoleWide`oneLine`cell;
texts:{(at["25 80";.Q.s;x];at["10 40";.Q.s;x];at["25 2000";.Q.s;x];at["25 80";.Q.s1;x];at["2000 2000";cell;x])};
read:{l:{x where not x="\r"} each read0 hsym `$dir,x; l where not (l like "/*") or 0=count each trim l};
qdocs:$[count q:read "qdocs.tsv"; flip `expr`col`text`ref!flip "\t" vs/: q; ([]expr:();col:();text:();ref:())];
fix:{[e;t] o:select from qdocs where expr~\:e; if[not count o; :(t;"")]; t[names?`$o`col]:unesc each o`text; (t;"; " sv distinct o`ref)};
row:{[e] b:-8!value e; r:fix[e;texts -9!b]; "\t" sv esc each (e;raze string b),r[0],enlist r 1};
safeRow:{[e] @[row;e;{[e;err] -2 "q-render-gen: skipped ",e," : ",err; ""}[e]]};
rows:safeRow each read "corpus.txt";
(hsym `$dir,"expected.tsv") 0: enlist["\t" sv ("expr";"hex"),(string names),enlist "qdocs"],rows where 0<count each rows;
-1 "q-render-gen: wrote ",string[sum 0<count each rows]," rows";
big:("til 1000";"([] a:til 300; b:300#`abc`de; c:300#\"xyz\")";"500#enlist \"hello\"");
(hsym `$dir,"compressed.tsv") 0: enlist["expr\tcompressed\tplain"],{"\t" sv (x;raze string -18!v;raze string -8!v:value x)} each big;
exit 0
