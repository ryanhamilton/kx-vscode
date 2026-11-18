/ Copyright (c) 2026 peachq contributors
/ SPDX-License-Identifier: Apache-2.0
/ The runner's falsifier: CI requires test/q/run.q to exit non-zero on this directory.
system "d .alwaysFailTest";

testPasses:{.qunit.assertEquals[1+1; 2; "a passing test does not hide the failure"]};
testFails:{.qunit.assertEquals[1+1; 3; "this assertion always fails"]};
testErrors:{'"this test always signals"};
