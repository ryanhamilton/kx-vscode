/ Copyright (c) 2026 peachq contributors
/ SPDX-License-Identifier: Apache-2.0
/ q test/q/run.q [dir|file] -classic, from the repo root. Each *Test.q file runs in its own q, as quke ran each feature
/ file, since listMem enumerates the whole process. Exits 1 on any failure, error, file that will not load, or no tests.
/ A test namespace may hold skip* functions, each named with its reason in a skipped dict; QTEST_SKIPPED=1 runs them.

if[not 10h=type @[value;`.pq.version;0]; -2 "run.q: this q is not peachq (no .pq.version), refusing to run"; exit 1];

\d .qtest

target:$[count .z.x; first .z.x; "test/q/qunit"];
isDir:{11h=type key hsym `$x};
child:{[file] " " sv {"'",ssr[x; "'"; "'\\''"],"'"} each (.z.X 0; .z.X 1; file),.z.X where .z.X like "-*"};

runFile:{[file]
    out:system child[file]," 2>&1; echo qtest-exit=$?";
    -1 out where not m:out like "qtest-exit=*";
    "J"$11 _ first out where m};

runDir:{[dir]
    files:asc f where (f:key hsym `$dir) like "*Test.q";
    if[not count files; -2 "run.q: no *Test.q files in ",dir; exit 1];
    rc:runFile each (dir,"/"),/:string files;
    -1 $[all 0=rc; "=== ALL PASS: ",string[count files]," files ==="; "=== FAILED: ",", " sv string files where 0<>rc];
    exit `int$any 0<>rc};

str:{$[10h=abs type x; x; -3!x]};
report:{[ns; t]
    c:system "c"; system "c 2000 2000";
    {-1 "  ",string[x`status]," ",string[x`name],$[`skip=x`status; " - ",x`msg; ""];
        if[x[`status] in `fail`error;
            -1 ("    ",str[x`msg]," result: ",str x`result; "    expected: ",-3!x`expected; "    actual:   ",-3!x`actual)]} each t;
    .qunit.setConsole c;
    -1 string[ns]," ",.qunit.verdict[t]," ",string[sum `skip=t`status]," skipped";
    exit `int$(0=count t) or any t[`status] in `fail`error};

runOne:{[file]
    system "l pq/qunit.q";
    .qunit.setQuiet 1b;
    ns:`$".",-2 _ last "/" vs file;
    loaded:@[{system "l ",x; 1b}; file; {-2 "run.q: ",x," failed to load: ",y; 0b}[file]];
    if[not loaded; exit 1];
    sk:@[value; ` sv ns,`skipped; ()!()];
    fns:system "f ",string ns;
    bad:(fns where fns like "skip*") except key sk;
    if[count bad; -2 "run.q: skip functions with no reason in skipped: "," " sv string bad; exit 1];
    if[not getenv[`QTEST_SKIPPED]~enlist "1";
        t:.qunit.runTests enlist ns;
        report[ns; t uj ([] status:(count sk)#`skip; name:` sv/: ns,/:key sk; msg:value sk)]];
    {[ns; f] (` sv ns,`$"test",4 _ string f) set get ` sv ns,f}[ns] each key sk;
    report[ns; .qunit.runTests enlist ns]};

\d .
.Q.trp[{$[.qtest.isDir x; .qtest.runDir x; .qtest.runOne x]}; .qtest.target; {-2 "run.q: ",x,"\n",.Q.sbt y; exit 2}];
