/ Ported from formatQ.quke: evaluateQ.q then formatQ.q, as the extension runs them on a connection.
system "d .formatQTest";

.test.formatQ:value "\n" sv read0 `:resources/q/formatQ.q;
.test.evalSrc:"\n" sv read0 `:resources/q/evaluateQ.q;
.test.evaluateQ:{[args] 0i (.test.evalSrc; args)};
.test.evaluateAndFormat:{[args] .test.formatQ[args; .test.evaluateQ args]};

compare:{[a; e] .qunit.assertEquals[a; e; "compare"]; 1b};
tearDown:{setenv[`TABULAR_LIMIT; "600000"]};

testTheResultForAtomsToShowTheTypeOfTheUnderlyingAtomRatherThanTheColu:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "100f"; ::; "structuredText")]`data; "{\"count\":1,\"columns\":[{\"name\":\"values\",\"type\":\"float\",\"values\":[\"100f\"],\"order\":[0]}],\"warnings\":[]}"]; "the result for atoms to show the type of the underlying atom rather than the column"]
    };
testStructuredTextToHandleValidMixedLists:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "(1;`orange)"; ::; "structuredText")]`data; "{\"count\":2,\"columns\":[{\"name\":\"values\",\"type\":\"general\",\"values\":[\"1\",\"`orange\"],\"order\":[0,1]}],\"warnings\":[]}"]; "structured text to handle valid mixed lists // q bug causes the reverse (`orange;1) to throw a `type error"]
    };
testStructuredTextToPreserveAttributes:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "`s#10 + til 5"; ::; "structuredText")]`data; "{\"count\":5,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"10\",\"11\",\"12\",\"13\",\"14\"],\"order\":[0,1,2,3,4],\"attributes\":\"s\"}],\"warnings\":[]}"]; "structured text to preserve attributes"]
    };
testStructuredTextToHandleFunctions:{
    .test.exampleFunction: {[x;y]x + y};
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleFunction"; ::; "structuredText")]`data; "{\"count\":1,\"columns\":[{\"name\":\"values\",\"type\":\"lambda\",\"values\":[\"{[x;y]x + y}\"],\"order\":[0]}],\"warnings\":[]}"]; "structured text to handle functions"]
    };
testStructuredTextToHandleAsSamplingFunction:{
    sampleFn: 2?;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "0 0 0"; sampleFn; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"0\",\"0\"],\"order\":[0,1]}],\"warnings\":[]}"]; "structured text to handle ? as sampling function"]
    };
testStructuredTextToHandleAtoms:{
    .test.exampleAtom: {[x;y]x + y};
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleAtom"; ::; "structuredText")]`data; "{\"count\":1,\"columns\":[{\"name\":\"values\",\"type\":\"lambda\",\"values\":[\"{[x;y]x + y}\"],\"order\":[0]}],\"warnings\":[]}"]; "structured text to handle atoms"]
    };
testStructuredTextToHandleLists:{
    .test.exampleList: 1.1 452 -32.9;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"floats\",\"values\":[\"1.1\",\"452f\",\"-32.9\"],\"order\":[2,0,1]}],\"warnings\":[]}"]; "structured text to handle lists"]
    };
testStructuredTextToHandle2DLists:{
    .test.example2dList: (1.1 1.0 2.0; 452 112 561);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.example2dList"; ::; "structuredText")]`data; "{\"count\":2,\"columns\":[{\"name\":\"values\",\"type\":\"general\",\"values\":[\"1.1 1 2\",\"452 112 561\"],\"order\":[1,0]}],\"warnings\":[]}"]; "structured text to handle 2D lists"]
    };
testStructuredTextToHandleDictionaries:{
    .test.exampleDict: `tom`dick`harry!1040 59 27;    
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleDict"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"key\",\"type\":\"symbols\",\"values\":[\"`tom\",\"`dick\",\"`harry\"],\"order\":[1,2,0],\"isKey\":true},{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"1040\",\"59\",\"27\"],\"order\":[2,1,0]}],\"warnings\":[]}"]; "structured text to handle dictionaries"]
    };
testStructuredTextToHandleUnkeyedTables:{
    .test.exampleTable: flip `name`iq!(`Dent`Beeblebrox`Prefect;98 42 126);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleTable"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"name\",\"type\":\"symbols\",\"values\":[\"`Dent\",\"`Beeblebrox\",\"`Prefect\"],\"order\":[1,0,2]},{\"name\":\"iq\",\"type\":\"longs\",\"values\":[\"98\",\"42\",\"126\"],\"order\":[1,0,2]}],\"warnings\":[]}"]; "structured text to handle unkeyed tables"]
    };
skipStructuredTextToHandleKeyedTables:{
    .test.exampleKeyedTable: ([sym: `AAPL`TSLA`GOOGL] price: 100 200 300);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleKeyedTable"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"sym\",\"type\":\"symbols\",\"values\":[\"`AAPL\",\"`TSLA\",\"`GOOGL\"],\"order\":[0,2,1],\"isKey\":true},{\"name\":\"price\",\"type\":\"longs\",\"values\":[\"100\",\"200\",\"300\"],\"order\":[0,1,2]}],\"warnings\":[]}"]; "structured text to handle keyed tables"]
    };
testStructuredTextToHandleStrings:{
    .test.exampleString: "ThisIsAExampleString";
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleString"; ::; "structuredText")]`data; "{\"count\":20,\"columns\":[{\"name\":\"values\",\"type\":\"chars\",\"values\":[\"\\\"ThisIsAExampleString\\\"\"],\"order\":[0]}],\"warnings\":[]}"]; "structured text to handle strings"]
    };
testStructuredTextToHandleEmptyLists:{
    .test.exampleEmptyList: ();
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleEmptyList"; ::; "structuredText")]`data; "{\"count\":0,\"columns\":[{\"name\":\"values\",\"type\":\"general\",\"values\":[],\"order\":[]}],\"warnings\":[]}"]; "structured text to handle empty lists"]
    };
testStructuredTextToHandleEmptyTables:{
    .test.exampleEmptyTable: ([] name:(); iq:());
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleEmptyTable"; ::; "structuredText")]`data; "{\"count\":0,\"columns\":[{\"name\":\"name\",\"type\":\"general\",\"values\":[],\"order\":[]},{\"name\":\"iq\",\"type\":\"general\",\"values\":[],\"order\":[]}],\"warnings\":[]}"]; "structured text to handle empty tables"]
    };
testStructuredTextToHandleEmptyDictionaries:{
    .test.exampleEmptyDict:(`$())!`float$();
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleEmptyDict"; ::; "structuredText")]`data; "{\"count\":0,\"columns\":[{\"name\":\"key\",\"type\":\"symbols\",\"values\":[],\"order\":[],\"isKey\":true},{\"name\":\"values\",\"type\":\"floats\",\"values\":[],\"order\":[]}],\"warnings\":[]}"]; "structured text to handle empty dictionaries"]
    };
testStructuredTextToHandleEnums:{
    .test.d:`a`b`c;
    .test.y:`a`b`c`b`a`b`c`c`c`c`c`c`c;
    .test.e: `.test.d$.test.y;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.e"; ::; "structuredText")]`data; "{\"count\":13,\"columns\":[{\"name\":\"values\",\"type\":\"enum\",\"values\":[\"`.test.d$`a\",\"`.test.d$`b\",\"`.test.d$`c\",\"`.test.d$`b\",\"`.test.d$`a\",\"`.test.d$`b\",\"`.test.d$`c\",\"`.test.d$`c\",\"`.test.d$`c\",\"`.test.d$`c\",\"`.test.d$`c\",\"`.test.d$`c\",\"`.test.d$`c\"],\"order\":[0,4,1,3,5,2,6,7,8,9,10,11,12]}],\"warnings\":[]}"]; "structured text to handle enums"]
    };
skipStructuredTextToHandleForeignKeyColumns:{
    / stubbing out test due to automatically adding attribute sorted s into data. Filed in https://kxl.atlassian.net/browse/KXI-59085
    .test.name:`$("Stock Exchange";"Boersen";"NYSE");
    .test.country:`$("United Kingdom";"Denmark";"United States");
    .test.city:`$("London";"Copenhagen";"New York");
    .test.id:1001 1002 1003;
    .test.market:([.test.id].test.name;.test.country;.test.city);
    .test.trade:([]
        stock:  `ibm`APPL;
        market: `.test.market$1001 1001;
        price:  122.5 320.9;
        amount: 500 40i;
        time:   09:04:59:000 08:03:58:000);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.trade"; ::; "structuredText")]`data; "{\"count\":2,\"columns\":[{\"name\":\"stock\",\"type\":\"symbols\",\"values\":[\"`ibm\",\"`APPL\"],\"order\":[1,0]},{\"name\":\"market\",\"type\":\"enum\",\"values\":[\"`.test.market$1001\",\"`.test.market$1001\"],\"order\":[0,1]},{\"name\":\"price\",\"type\":\"floats\",\"values\":[\"122.5\",\"320.9\"],\"order\":[0,1],\"attributes\":\"s\"},{\"name\":\"amount\",\"type\":\"ints\",\"values\":[\"500i\",\"40i\"],\"order\":[1,0]},{\"name\":\"time\",\"type\":\"times\",\"values\":[\"09:04:59.000\",\"08:03:58.000\"],\"order\":[1,0]}],\"warnings\":[]}"]; "structured text to handle foreign key columns"]
    };
skipStructuredTextToHandleListsOfDictionaries:{
    .test.exampleList:((`tom`dick`harry!1040 59 27);(`Adrian`Ben!10 20);(`Nathaniel`Igor!("a";"string")));
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"general\",\"values\":[\"tom  | 1040\\ndick | 59\\nharry| 27\",\"Adrian| 10\\nBen   | 20\",\"Nathaniel| \\\"a\\\"\\nIgor     | \\\"string\\\"\"],\"order\":[2,1,0]}],\"warnings\":[]}"]; "structured text to handle lists of dictionaries"]
    };
skipStructuredTextToHandleAnymap:{
    originalDir: first system "pwd";
    .test.anymap: get`:/tmp/anymap set ((1 2;3 4);`time`price`vol!(09:30:00;1.;100i);([]a:1 2;b:("ab";"cd")));
    system "cd " , originalDir;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.anymap"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"compoundGeneral\",\"values\":[\"1 2\\n3 4\",\"time | 09:30:00\\nprice| 1f\\nvol  | 100i\",\"a b   \\n------\\n1 \\\"ab\\\"\\n2 \\\"cd\\\"\"],\"order\":[0,2,1]}],\"warnings\":[]}"]; "structured text to handle anymap"]
    };
testStructuredTextToHandleTruncatedResultsForAllOtherCases:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.exampleDict: `tavon`kira`zane`milo`dax`nilo`sera`jax`luma`reon`vela`tari`senn`korin`bryn`aiko`dran`lira`zev`orin!(1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleDict"; ::; "structuredText")]`data; "{\"count\":5,\"columns\":[{\"name\":\"key\",\"type\":\"symbols\",\"values\":[\"`tavon\",\"`kira\",\"`zane\",\"`milo\",\"`dax\"],\"order\":[4,1,3,0,2],\"isKey\":true},{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"1\",\"2\",\"3\",\"4\",\"5\"],\"order\":[0,1,2,3,4]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"]; "structured text to handle truncated results for all other cases"]
    };
testStructuredTextToHandleTruncatedResultsForTables:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.exampleTable: flip `name`id!(`Dent`Beeblebrox`Prefect`Zan`Bob`Kox`Lind`Ozy`Drax`Rox`Mop`Lomp;98 42 126 11 21 634 72 212 76 12 156 217);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleTable"; ::; "structuredText")]`data; "{\"count\":5,\"columns\":[{\"name\":\"name\",\"type\":\"symbols\",\"values\":[\"`Dent\",\"`Beeblebrox\",\"`Prefect\",\"`Zan\",\"`Bob\"],\"order\":[1,4,0,2,3]},{\"name\":\"id\",\"type\":\"longs\",\"values\":[\"98\",\"42\",\"126\",\"11\",\"21\"],\"order\":[3,4,1,0,2]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"]; "structured text to handle truncated results for tables"]
    };
testStructuredTextToHandleTruncatedResultsForDictionaries:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.exampleDict: `tavon`kira`zane`milo`dax`nilo`sera`jax`luma`reon`vela`tari`senn`korin`bryn`aiko`dran`lira`zev`orin!(1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleDict"; ::; "structuredText")]`data; "{\"count\":5,\"columns\":[{\"name\":\"key\",\"type\":\"symbols\",\"values\":[\"`tavon\",\"`kira\",\"`zane\",\"`milo\",\"`dax\"],\"order\":[4,1,3,0,2],\"isKey\":true},{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"1\",\"2\",\"3\",\"4\",\"5\"],\"order\":[0,1,2,3,4]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"]; "structured text to handle truncated results for dictionaries"]
    };
testStructuredTextToHandleInvalidTABULARLIMIT:{
    setenv[`TABULAR_LIMIT;"ADRIAN"];
    .test.exampleList: 1.1 452 -32.9;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`data; "{\"count\":3,\"columns\":[{\"name\":\"values\",\"type\":\"floats\",\"values\":[\"1.1\",\"452f\",\"-32.9\"],\"order\":[2,0,1]}],\"warnings\":[]}"]; "structured text to handle invalid TABULAR_LIMIT"]
    };
testTheFirstNRowsOfALargeTableWithTheFullRowCount:{
    .test.bigTable: ([] x: til 1000000);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.bigTable"; ::; "structuredText"; `size`from!(10f; "first"))]`data; "{\"count\":1000000,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\"],\"order\":[0,1,2,3,4,5,6,7,8,9]}],\"warnings\":[]}"]; "the first N rows of a large table, with the full row count"]
    };
testTheLastNRowsOfALargeTableWithTheFullRowCount:{
    .test.bigTable: ([] x: til 1000000);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.bigTable"; ::; "structuredText"; `size`from!(10f; "last"))]`data; "{\"count\":1000000,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"999990\",\"999991\",\"999992\",\"999993\",\"999994\",\"999995\",\"999996\",\"999997\",\"999998\",\"999999\"],\"order\":[0,1,2,3,4,5,6,7,8,9]}],\"warnings\":[]}"]; "the last N rows of a large table, with the full row count"]
    };
testOnlyTheFinalRowWhenTheLimitIsTheLast1:{
    .test.bigTable: ([] x: til 1000000);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.bigTable"; ::; "structuredText"; `size`from!(1f; "last"))]`data; "{\"count\":1000000,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"999999\"],\"order\":[0]}],\"warnings\":[]}"]; "only the final row when the limit is the last 1"]
    };
testTheWholeTableWhenTheLimitIsLargerThanTheTable:{
    .test.smallTable: ([] name: `a`b`c; v: 1 2 3);
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.smallTable"; ::; "structuredText"; `size`from!(100f; "last"))]`data; "{\"count\":3,\"columns\":[{\"name\":\"name\",\"type\":\"symbols\",\"values\":[\"`a\",\"`b\",\"`c\"],\"order\":[0,1,2]},{\"name\":\"v\",\"type\":\"longs\",\"values\":[\"1\",\"2\",\"3\"],\"order\":[0,1,2]}],\"warnings\":[]}"]; "the whole table when the limit is larger than the table"]
    };
testTABULARLIMITToTrimTheLastRowsFromTheEndAndWarn:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.table20: ([] x: til 20; y: 100 + til 20);
    result: compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.table20"; ::; "structuredText"; `size`from!(15f; "last"))]`data; "{\"count\":20,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"15\",\"16\",\"17\",\"18\",\"19\"],\"order\":[0,1,2,3,4]},{\"name\":\"y\",\"type\":\"longs\",\"values\":[\"115\",\"116\",\"117\",\"118\",\"119\"],\"order\":[0,1,2,3,4]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"];
    setenv[`TABULAR_LIMIT;"600000"];
    .qunit.assertTrue[result; "TABULAR_LIMIT to trim the last rows from the end and warn"]
    };
testTABULARLIMITToTrimTheFirstRowsFromTheStartAndWarn:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.table20: ([] x: til 20; y: 100 + til 20);
    result: compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.table20"; ::; "structuredText"; `size`from!(15f; "first"))]`data; "{\"count\":20,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"0\",\"1\",\"2\",\"3\",\"4\"],\"order\":[0,1,2,3,4]},{\"name\":\"y\",\"type\":\"longs\",\"values\":[\"100\",\"101\",\"102\",\"103\",\"104\"],\"order\":[0,1,2,3,4]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"];
    setenv[`TABULAR_LIMIT;"600000"];
    .qunit.assertTrue[result; "TABULAR_LIMIT to trim the first rows from the start and warn"]
    };
testTABULARLIMITWithoutARowLimitToKeepReportingTheTruncatedCount:{
    setenv[`TABULAR_LIMIT;"10"];
    .test.table20: ([] x: til 20; y: 100 + til 20);
    result: compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.table20"; ::; "structuredText")]`data; "{\"count\":5,\"columns\":[{\"name\":\"x\",\"type\":\"longs\",\"values\":[\"0\",\"1\",\"2\",\"3\",\"4\"],\"order\":[0,1,2,3,4]},{\"name\":\"y\",\"type\":\"longs\",\"values\":[\"100\",\"101\",\"102\",\"103\",\"104\"],\"order\":[0,1,2,3,4]}],\"warnings\":[\"Results truncated to TABULAR_LIMIT. Console view is faster for large data.\"]}"];
    setenv[`TABULAR_LIMIT;"600000"];
    .qunit.assertTrue[result; "TABULAR_LIMIT without a rowLimit to keep reporting the truncated count"]
    };
testTheLastNItemsOfAList:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "til 10"; ::; "structuredText"; `size`from!(3f; "last"))]`data; "{\"count\":10,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"7\",\"8\",\"9\"],\"order\":[0,1,2]}],\"warnings\":[]}"]; "the last N items of a list"]
    };
testTheLastNEntriesOfADictionary:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "`a`b`c`d`e!1 2 3 4 5"; ::; "structuredText"; `size`from!(2f; "last"))]`data; "{\"count\":5,\"columns\":[{\"name\":\"key\",\"type\":\"symbols\",\"values\":[\"`d\",\"`e\"],\"order\":[0,1],\"isKey\":true},{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"4\",\"5\"],\"order\":[0,1]}],\"warnings\":[]}"]; "the last N entries of a dictionary"]
    };
skipTheLastNRowsOfAKeyedTable:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "([k: `a`b`c`d] v: 10 20 30 40)"; ::; "structuredText"; `size`from!(2f; "last"))]`data; "{\"count\":4,\"columns\":[{\"name\":\"k\",\"type\":\"symbols\",\"values\":[\"`c\",\"`d\"],\"order\":[0,1],\"isKey\":true},{\"name\":\"v\",\"type\":\"longs\",\"values\":[\"30\",\"40\"],\"order\":[0,1]}],\"warnings\":[]}"]; "the last N rows of a keyed table"]
    };
testAtomsToBeUnaffected:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "42"; ::; "structuredText"; `size`from!(5f; "last"))]`data; "{\"count\":1,\"columns\":[{\"name\":\"values\",\"type\":\"long\",\"values\":[\"42\"],\"order\":[0]}],\"warnings\":[]}"]; "atoms to be unaffected"]
    };
testStringsToBeLeftWholeWhenTakingTheFirstN:{
    .test.exampleString: "ThisIsAExampleString";
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.exampleString"; ::; "structuredText"; `size`from!(5f; "first"))]`data; "{\"count\":20,\"columns\":[{\"name\":\"values\",\"type\":\"chars\",\"values\":[\"\\\"ThisIsAExampleString\\\"\"],\"order\":[0]}],\"warnings\":[]}"]; "strings to be left whole when taking the first N"]
    };
testStringsToBeLeftWholeWhenTakingTheLastN:{
    .test.exampleString: "ThisIsAExampleString";
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; ".test.exampleString"; ::; "structuredText"; `size`from!(5f; "last"))]`data; "{\"count\":20,\"columns\":[{\"name\":\"values\",\"type\":\"chars\",\"values\":[\"\\\"ThisIsAExampleString\\\"\"],\"order\":[0]}],\"warnings\":[]}"]; "strings to be left whole when taking the last N"]
    };
testALongSizeToWorkTheSameAsTheFloatNodeQSends:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "til 10"; ::; "structuredText"; `size`from!(3; "last"))]`data; .test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "til 10"; ::; "structuredText"; `size`from!(3f; "last"))]`data]; "a long size to work the same as the float node-q sends"]
    };
testNoRowLimitToLeaveTheResultUnchanged:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "til 10"; ::; "structuredText")]`data; "{\"count\":10,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\"],\"order\":[0,1,2,3,4,5,6,7,8,9]}],\"warnings\":[]}"]; "no rowLimit to leave the result unchanged"]
    };
testARowLimitOfToBeTreatedAsNoRowLimit:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat`rowLimit!("."; "til 10"; ::; "structuredText"; ::)]`data; "{\"count\":10,\"columns\":[{\"name\":\"values\",\"type\":\"longs\",\"values\":[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\"],\"order\":[0,1,2,3,4,5,6,7,8,9]}],\"warnings\":[]}"]; "a rowLimit of (::) to be treated as no rowLimit"]
    };
testReturnDictionaryToContainProperKeysInTheFormOfDataErrorErrorMsgSta:{
    .test.exampleList: 1.1 452 -32.9;
    a: .test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")];
    .qunit.assertTrue[compare[key a; `data`error`errorMsg`stacktrace]; "return dictionary to contain proper keys in the form of `data`error`errorMsg`stacktrace"]
    };
testReturnDictionaryToContain0bForError:{
    .test.exampleList: 1.1 452 -32.9;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`error; 0b]; "return dictionary to contain 0b for error"]
    };
testReturnDictionaryToContainProperErrorMsg:{
    .test.exampleList: 1.1 452 -32.9;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`errorMsg; ""]; "return dictionary to contain proper errorMsg"]
    };
testReturnDictionaryToContainAEmptyStacktrace:{
    .test.exampleList: 1.1 452 -32.9;
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.exampleList"; ::; "structuredText")]`stacktrace; ()]; "return dictionary to contain a empty stacktrace"]
    };
testErrorDictionaryToContainKeysInTheFormOfDataErrorErrorMsgStacktrace:{
    a: .test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "something"; ::; "text")];
    .qunit.assertTrue[compare[key a; `data`error`errorMsg`stacktrace]; "error dictionary to contain keys in the form of `data`error`errorMsg`stacktrace"]
    };
testErrorDictionaryToContainNullForData:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "something"; ::; "text")]`data; ::]; "error dictionary to contain null for data"]
    };
testErrorDictionaryToContainA1bForError:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "something"; ::; "text")]`error; 1b]; "error dictionary to contain a 1b for error"]
    };
testErrorDictionaryToContainProperErrorMsg:{
    .qunit.assertTrue[compare[.test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; "something"; ::; "text")]`errorMsg; "something"]; "error dictionary to contain proper errorMsg"]
    };
testErrorDictionaryToContainStacktrace:{
    a: .j.j .test.evaluateAndFormat[`ctx`code`sampleFn`returnFormat!("."; ".test.adr"; ::; "text")];
    b:  "{\"data\":null,\"error\":true,\"errorMsg\":\".test.adr\",\"stacktrace\":\"  [1]  .test.adr\\n       ^\\n\"}";
    .qunit.assertTrue[compare[a;b]; "error dictionary to contain stacktrace"]
    };


skipped:(!) . flip (
    (`skipStructuredTextToHandleForeignKeyColumns; "xexpect upstream: formatQ adds the sorted attribute to the price column (KXI-59085)");
    (`skipStructuredTextToHandleAnymap; "peachq get of a mapped general list answers 0h, not anymap 77h (NOTES-FOR-PEACHQ)");
    (`skipStructuredTextToHandleKeyedTables; "peachq joins the key and value column dicts into a table, adding isKey:false (NOTES-FOR-PEACHQ)");
    (`skipTheLastNRowsOfAKeyedTable; "peachq joins the key and value column dicts into a table, adding isKey:false (NOTES-FOR-PEACHQ)");
    (`skipStructuredTextToHandleListsOfDictionaries; "peachq iasc of a list of dicts answers 0 1 2 where kdb answers 2 1 0 (NOTES-FOR-PEACHQ)"));
