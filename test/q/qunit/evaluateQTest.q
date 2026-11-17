/ Ported from evaluateQ.quke: evaluateQ.q as the extension sends it over a connection.
system "d .evaluateQTest";

.test.src:"\n" sv read0 `:resources/q/evaluateQ.q;
.test.evaluateQ:{[args] 0i (.test.src; args)};
.test.dims:system "c";
.test.precision:system "P";
.test.attrLines:("dict: `s#`a`b`c`d`e`f`g!enlist each 7?0"; "dict[`e] : dict[`e] , 1"; "attr dict");

tearDown:{
    .qunit.setConsole .test.dims;
    system "P ",string .test.precision;
    .qunit.removeVar each `dict`myVal1`myVal2;
    };

testSimpleExpressionOf33ToReturn6:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "3+3"; ::; "serialized")]`data; 6; "simple expression of 3+3 to return 6"]
    };
skipProjectionNullToReturnAsGenericNull:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "last value (;;)"; "serialized")]`data; (::); "projection null to return as generic null"]
    };
skipFunctionDefinitionToWork:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; ".test.fn333: {: 333}"; ::; "serialized")]`data; {: 333}; "function definition to work"]
    };
testFunctionCallToWorkAndReturn333:{
    .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; ".test.fn333: {: 333}"; ::; "serialized")];
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; ".test.fn333 []"; ::; "serialized")]`data; 333; "function call to work and return 333"]
    };
skipEachRightAndEachLeftOfSimilarExpressionsToBeEqual:{
    .qunit.assertTrue[.com_kx_edi.dropIrrelevantRecords[.com_kx_ediNoCoverage.evaluate["1 2 3 +\\: 10"; "."]] ~ .com_kx_edi.dropIrrelevantRecords  .com_kx_ediNoCoverage.evaluate["10 +/: 1 2 3"; "."]; "each right and each left of similar expressions to be equal"]
    };
testScanToWorkAndReturn111316:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "10 +\\ 1 2 3"; ::; "serialized")]`data; 11 13 16; "scan to work and return 11 13 16"]
    };
testOverToWorkAndReturn16:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "10 +/ 1 2 3"; ::; "serialized")]`data; 16; "over to work and return 16"]
    };
testAListCreatedByEDIToBeEqualToTheList:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "1 2 3 4 5 6 7 8"; ::; "serialized")]`data; 1 2 3 4 5 6 7 8; "a list created by EDI to be equal to the list"]
    };
testAnExpressionThatCreatesAListToReturnTheCorrectList:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "`char$97+til 26"; ::; "serialized")]`data; "abcdefghijklmnopqrstuvwxyz"; "an expression that creates a list to return the correct list"]
    };
testTheConcatOfTwoListsToBeTheSame:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "(til 100),(til 100)"; ::; "serialized")]`data; (til[100], til 100); "the concat of two lists to be the same"]
    };
skipSimpleKExpressionsToWork336:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) 3 + 3"; ::; "serialized")]`data; 6; "simple k expressions to work, 3+3=6"]
    };
skipMoreComplicatedKExpressionsToWorkSuchAsOver:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) +/1 2 3 4"; ::; "serialized")]`data; 10; "more complicated k expressions to work such as over"]
    };
skipMoreComplicatedKExpressionsToWorkSuchAsDyadicFunctionOver:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) {x+2*y}/1 2 3 4"; ::; "serialized")]`data; 19; "more complicated k expressions to work such as dyadic function over"]
    };
skipMoreComplicatedKExpressionsToWorkSuchAsMonadicEachBoth:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) (-':)1 2 3 4"; ::; "serialized")]`data; 1 1 1 1; "more complicated k expressions to work such as monadic each both"]
    };
skipMoreComplicatedKExpressionsToWorkSuchAsMonadicEachBoth2:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) +\\1 2 3 4"; ::; "serialized")]`data; 1 3 6 10; "more complicated k expressions to work such as monadic each both"]
    };
skipAStringToBeAStringInK:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "k) \"hello\\\\there\""; ::; "serialized")]`data; "hello\\there"; "a string to be a string in k"]
    };
testItToReturnTimingInformation:{
    / this fails intermittently on windows for some reason ...
    .qunit.assertTrue[10 > .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\t count \"doug\""; ::; "serialized")]`data; "it to return timing information"]
    };
testExpressionInTToSetZzCorrectly:{
    .qunit.assertTrue[(.test.zz ~ 4) and (10 > .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\t .test.zz: count \"doug\""; ::; "serialized")]`data); "expression in t to set zz correctly"]
    };
testSimpleExpressionInTToWorkCorrectly:{
    .qunit.assertTrue[(.test.zz ~ 4) and (10 > .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\t .test.zz: 1 + 1 + 1 + 1"; ::; "serialized")]`data); "simple expression in t to work correctly"]
    };
testTsToReturnTimeAndSpace:{
    .qunit.assertEquals[count .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\ts til 10000"; ::; "serialized")]`data; 2; "ts to return time and space"]
    };
testWorkspaceInformationToReturnCorrectly:{
    .qunit.assertTrue[(last system "w") ~ last .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\w"; ::; "serialized")]`data; "workspace information to return correctly (should usually work but may fail)"]
    };
testLsOsCommandToReturnDataBackAsAGeneralListEquivalentToSystemCall:{
    .qunit.assertTrue[$["w" ~ first string .z.o;
        / The /b is needed to show the simple results,
        / as if just "dir" is used, the results can change between the two calls
        (system "dir /b") ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\dir /b"; ::; "serialized")]`data;
        (system "ls") ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\ls"; ::; "serialized")]`data]; "ls os command to return data back as a general list equivalent to system call"]
    };
testPwdOsCommandToReturnTheCurrentDirectoryEquivalentToSystemCall:{
    .qunit.assertTrue[(system "cd") ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\cd"; ::; "serialized")]`data; "pwd os command to return the current directory equivalent to system call"]
    };
testAToReturnAListOfTables:{
    .qunit.assertTrue[11h ~ type .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\a"; ::; "serialized")]`data; "a to return a list of tables"]
    };
testCToReturnTheConsoleSize:{
    .qunit.assertTrue[6h ~ type .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\c"; ::; "serialized")]`data; "c to return the console size"]
    };
testC100100ToSetTheConsoleTo100100:{
    .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\c 100 100"; ::; "serialized")]`data;
    .qunit.assertTrue[100 100i ~ system "c"; "c 100 100 to set the console to 100 100"]
    };
testPToProvideThePort:{
    .qunit.assertTrue[system["p"] ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\p"; ::; "serialized")]`data; "p to provide the port"]
    };
testPToProvideThePrecision:{
    .qunit.assertTrue[system["P"] ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\P"; ::; "serialized")]`data; "P to provide the precision"]
    };
testSettingPrecisionTo4ForItToBeSetTo4:{
    .qunit.assertTrue[(system ["P"] ~ 4i) and (::) ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\P 4"; ::; "serialized")]`data; "setting precision to 4 for it to be set to 4"]
    };
testSettingThePrecisionTo0SetsItToMax:{
    .qunit.assertTrue[(system ["P"] ~ 0i) and (::) ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\P 0"; ::; "serialized")]`data; "setting the precision to 0 sets it to max (same as 16)"]
    };
testCorrectResultInNonDefaultContext:{
    .qunit.assertTrue[6 ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!(".test"; "3+3"; ::; "serialized")]`data; "correct expression result"]
    };
skipFunctionToBeCompiledInTheCorrectContext:{
    .qunit.assertTrue[`foo ~ first @[;3] value .test.evaluateQ[`ctx`code`sampleFn`returnFormat!(".foo"; "fn:{3+3}"; ::; "serialized")]`data; "function to be compiled in the correct context"]
    };
testDotContextAcceptsAlternateValues:{
    .test.ctx: system "d";
    system "d .ignore";
    .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "myVal1: `first"; ::; "serialized")]`data;
    .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "myVal2: `second"; ::; "serialized")]`data;
    system "d " , string .test.ctx;
    .qunit.assertTrue[`first`second ~ get each `..myVal1`..myVal2; "correct expression result"]
    };
testTheTestToNotBeRemoved:{
    / This needs the trim, because it returns "/test " on windows
    .qunit.assertTrue[trim[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\\echo /test"; ::; "serialized")]`data] ~ enlist "/test"; "the /test to not be removed"]
    };
testThisToBeTreatedAsASingleExpression:{
    .qunit.assertEquals[.test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "(1\r\n\r\n    2 3)"; ::; "serialized")]`data; 1 2 3; "this to be treated as a single expression"]
    };
testAnAttributeWithNoSemiColons:{
    .qunit.assertTrue[`s ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\n" sv .test.attrLines; ::; "serialized")]`data; "an attribute with no semi colons"]
    };
testAnAttributeWithSemiColons:{
    .qunit.assertTrue[`s ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\n" sv .test.attrLines ,\: ";"; ::; "serialized")]`data; "an attribute with semi colons"]
    };
testAnAttributeWithNoSemiColonsWithTwoNewlines:{
    .qunit.assertTrue[`s ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\n\n" sv .test.attrLines; ::; "serialized")]`data; "an attribute with no semi colons with two newlines"]
    };
testAnAttributeWithSemiColonsWithTwoNewlines:{
    .qunit.assertTrue[`s ~ .test.evaluateQ[`ctx`code`sampleFn`returnFormat!("."; "\n\n" sv .test.attrLines ,\: ";"; ::; "serialized")]`data; "an attribute with semi colons with two newlines"]
    };

skipped:(!) . flip (
    (`skipSimpleKExpressionsToWork336; "peachq has no k mode");
    (`skipMoreComplicatedKExpressionsToWorkSuchAsOver; "peachq has no k mode");
    (`skipMoreComplicatedKExpressionsToWorkSuchAsDyadicFunctionOver; "peachq has no k mode");
    (`skipMoreComplicatedKExpressionsToWorkSuchAsMonadicEachBoth; "peachq has no k mode");
    (`skipMoreComplicatedKExpressionsToWorkSuchAsMonadicEachBoth2; "peachq has no k mode");
    (`skipAStringToBeAStringInK; "peachq has no k mode");
    (`skipFunctionDefinitionToWork; "peachq: an assignment ending a [;] block answers ::, where kdb answers the value (NOTES-FOR-PEACHQ)");
    (`skipFunctionToBeCompiledInTheCorrectContext; "peachq: an assignment ending a [;] block answers ::, where kdb answers the value (NOTES-FOR-PEACHQ)");
    (`skipProjectionNullToReturnAsGenericNull; "xexpect upstream: coverage mishandles generic null in QBUILD 1.0.17+ (KXI-12260)");
    (`skipEachRightAndEachLeftOfSimilarExpressionsToBeEqual; "xexpect upstream: calls .com_kx_edi, which the extension does not ship"));
