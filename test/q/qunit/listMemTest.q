/ Ported from listMem.quke. Every root namespace present at setUp is the environment, so it is blacklisted.
system "d .listMemTest";

fnStr:"\n" sv read0 `:resources/q/listMem.q;

setUp:{
    `.listMemTest.blacklist set " `.q`.Q`.h`.z`.o`.j`.m`.ignore`.comkxic`.com_kx_log`.kurl`.pykx`.p`.s`.foo",
        "`","`" sv string {` sv `,x} each key[`] except `test;
    `.ignore set enlist[`]!enlist(::);
    .ignore.r:();
    `.test set enlist[`]!enlist(::);
    .test.namespace:enlist[`]!enlist(::);
    .test.otherNs.var:1 2 3;
    };
tearDown:{![`.;();0b;`test`ignore`a`b`testview`noDot`var1 inter key `.]};

listMem:{[extra] value fnStr,blacklist,extra};
withViews:{value each ("a:: 1";"b:: 2";"testview:: a + b"); listMem ""};
withBadNs:{.test.badns:enlist[`]!enlist(::); .test.badns[`.something]:123; withViews[]};

testListsAllNamespaces:{
    .qunit.assertEquals[exec fname from listMem "" where isNs; `.`.test`.test.namespace`.test.otherNs; "it lists all namespaces in memory"]};
testSkipsBlacklistedRootNamespaces:{
    .qunit.assertFalse[`.ignore in exec fname from listMem ""; "it skips root namespaces specified in the blacklist"]};
testContextsAreBaseNamespace:{
    .qunit.assertEquals[exec context from listMem "" where isNs; ```.test`.test; "the contexts are set to the base namespace"]};
testSkipsBlacklistedSubNamespaces:{
    r:listMem "`.test.otherNs";
    .qunit.assertFalse[any {x like ".test.otherNs*"} each exec fname from r; "it skips sub-namespaces specified in the blacklist"]};

testEnumeratesItemsAndTypes:{
    e:([]
        id: `int$til 8;
        pid: (2#0Ni), (3#0i), 1 1 6i;
        name: `.`.test`a`b`testview`namespace`otherNs`var;
        fname: `.`.test`a`b`testview`.test.namespace`.test.otherNs`.test.otherNs.var;
        typeNum: 99 99 -7 -7 -7 99 99 7h;
        namespace: `.`.`.`.`.`.test`.test`.test.otherNs;
        context: (5#`),3#`.test;
        isNs: 11000110b);
    .qunit.assertEquals[withViews[]; e; "it enumerates all items with types, contexts, etc."]};

testRootItemsHaveNullParent:{
    .qunit.assertEquals[exec fname from withViews[] where pid=0Ni; `.`.test; "all root level items have a null parent"]};
testGlobalItemsAreChildrenOfDot:{
    .qunit.assertEquals[exec fname from withViews[] where pid=0i; `a`b`testview; "items in the global namespace are children of `."]};
testEveryItemHasValidParent:{
    r:withViews[];
    ids:0Ni,exec id from r;
    .qunit.assertEquals[count select from r where not pid in ids; 0; "each item has a valid pid (parent id)"]};

testContinuesPastAnErroringNamespace:{
    e:([]
        id: `int$til 9;
        pid: (2#0Ni), (3#0i), 1 1 1 6i;
        name: `.`.test`a`b`testview`namespace`otherNs`badns`var;
        fname: `.`.test`a`b`testview`.test.namespace`.test.otherNs`.test.badns`.test.otherNs.var;
        typeNum: 99 99 -7 -7 -7 99 99 99 7h;
        namespace: `.`.`.`.`.`.test`.test`.test`.test.otherNs;
        context: (5#`),4#`.test;
        isNs: 110001110b);
    .qunit.assertEquals[withBadNs[]; e; "it continues enumerating other namespaces when one errors"]};

testRootNamespacesWithoutDot:{
    withBadNs[];
    value each ("noDot.table: ([] til 100)";"var1: 1");
    e:([]
        id: 0 1 2 3 4 5 6 8 9 10 11 7i;
        pid: (3#0Ni), (4#0i), (3#2i), 9 1i;
        name: `.`noDot`.test`a`b`testview`var1`namespace`otherNs`badns`var`table;
        fname: `.`noDot`.test`a`b`testview`var1`.test.namespace`.test.otherNs`.test.badns`.test.otherNs.var`noDot.table;
        typeNum: (3# 99h), (4#-7h), 99 99 99 7 98h;
        namespace: `.`.`.`.`.`.`.`.test`.test`.test`.test.otherNs`noDot;
        context: (7#`),(4#`.test),`noDot;
        isNs: 111000011100b);
    .qunit.assertEquals[listMem ""; e; "namespaces not prefixed with `. are handled"]};
