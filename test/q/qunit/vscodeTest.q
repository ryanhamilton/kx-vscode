/ Ported from vscode.quke: the API out/vscode.q defines (built by node build-api.js).
system "l out/vscode.q";
system "d .vscodeTest";

src:read0 `:test/q/qunit/vscodeTest.q;

/ a functional delete given no names empties the namespace, so only names that exist are passed
drop:{[ns; names] if[count n:names inter key ns; ![ns;();0b;n]]};
tearDown:{drop[`.vscode; enlist `customQEvaluator]; drop[`.; `foo`bar`myView]};

query:{[code; ctx; fmt] .vscode.runQQuery `code`ctx`returnFormat`sampleFn`sampleSize!(code; ctx; fmt; ::; ::)};
/ a frame of a lambda defined in test fn: where quke named its own file and line, this file and the lambda's line
frame:{[i; fn; code; caret]
    loc:"  [",string[i],"]  ",(system "cd"),"/test/q/qunit/vscodeTest.q:",string[1+first where src like "*",code,"*"],": ",string[fn],"@:";
    (loc,code; ((caret+count loc)#" "),"^")};

testRunPyQueryIsNotImplemented:{
    .qunit.assertEquals[
        .vscode.runPyQuery `code`returnFormat`sample_fn`sample_size!("1+2"; "text"; ::; ::);
        `data`error`errorMsg!(::; 1b; "Running Python code in secured processes is not yet supported");
        "a message that this isn't implemented yet"]};

testTextIsStringifiedQ:{
    .qunit.assertEquals[query["1+2"; "."; "text"]; `data`error`errorMsg`stacktrace!("3\n"; 0b; ""; ()); "text responses are the stringified q"]};
testStructuredTextIsJson:{
    .qunit.assertEquals[query["1 2 3"; "."; "structuredText"];
        `data`error`errorMsg`stacktrace!("{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"1\",\"2\",\"3\"],\"order\":[0,1,2]}],\"warnings\":[]}"; 0b; ""; ());
        "structuredText is JSON"]};
skipSampleFnAndSizeApplied:{
    .qunit.assertEquals[
        .vscode.runQQuery `code`ctx`returnFormat`sampleFn`sampleSize!("1 2 3"; "."; "structuredText"; "last"; 1);
        `data`error`errorMsg`stacktrace!("{\"count\":1,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"3\"],\"order\":[0]}],\"warnings\":[]}"; 0b; ""; ());
        "sampleFn and sampleSize are applied"]};

testRunsInSpecifiedContext:{
    .qunit.assertEquals[query["\\d"; ".foo"; "text"]`data; "`.foo\n"; "the query runs in the specified context"]};
testContextIsRestored:{
    query["\\d"; ".foo"; "text"];
    .qunit.assertEquals[system "d"; `.; "the context is restored"]};

testStackTraceWithCustomEvaluator:{
    .test.foo:{.test.bar x};
    .test.bar:{1 + x};
    .vscode.customQEvaluator:{value x`code};
    fn:`.vscodeTest.testStackTraceWithCustomEvaluator;
    .qunit.assertEquals[query[".test.foo `"; "."; "text"];
        `data`error`errorMsg`stacktrace!(::; 1b; "type"; "\n" sv frame[3; fn; "{1 + x}"; 3],frame[2; fn; "{.test.bar x}"; 1],("  [1]  .test.foo `"; "       ^\n"));
        "stack traces are returned when using customQEvaluator"]};

testVersionIsDefined:{.qunit.assertTrue[all .vscode.version in .Q.n,"."; "the version is defined in a global"]};
testManifestHasVersion:{.qunit.assertEquals[.vscode.getManifest[]`version; .vscode.version; "the manifest includes the version number"]};
testManifestHasFeatures:{.qunit.assertEquals[.vscode.getManifest[]`features; `evaluateQ`listMem; "evaluateQ and listMem are available"]};

testListsViews:{
    value "foo: 1; bar: 2;";
    value "myView:: foo + bar";
    r:.vscode.getViews[];
    .qunit.assertTrue[(`myView in r) and not `foo in r; "a list of views is returned"]};
testListsVariables:{
    value "foo: 1; bar: 2;";
    value "myView:: foo + bar";
    v:.vscode.listMem[];
    .qunit.assertTrue[all (`id`pid`name`fname`typeNum`namespace`context`isNs ~ cols v; all `runQQuery`foo`myView in v`name); "a table of variables"]};

/ defined in the root context, as quke ran it, so foo and bar are root globals
system "d .";
.vscodeTest.skipStackTraceWithoutCustomEvaluator:{
    foo:: {bar x};
    bar:: {' "some error"};
    fn:`.vscodeTest.skipStackTraceWithoutCustomEvaluator;
    .qunit.assertEquals[.vscodeTest.query["foo `"; "."; "text"];
        `data`error`errorMsg`stacktrace!(::; 1b; "some error"; "\n" sv .vscodeTest.frame[3; fn; "{' \"some error\"}"; 1],.vscodeTest.frame[2; fn; "{bar x}"; 1],("  [1]  foo `"; "       ^\n"));
        "stack traces are returned when not using customQEvaluator"]};

.vscodeTest.skipped:`skipSampleFnAndSizeApplied`skipStackTraceWithoutCustomEvaluator!(
    "xexpect upstream: runs \"last\" 1 2 3 instead of last 1 2 3";
    "peachq names a lambda assigned by :: in a function foo:, where kdb names it parent@ (NOTES-FOR-PEACHQ)");
