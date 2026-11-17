#!/usr/bin/env bash
# npm run q-test [dir|file]: the qunit tests on peachq. test/q/run.q refuses any q without .pq.version.
set -euo pipefail
cd "$(dirname "$0")/.."

q=${PEACHQ_Q:-$(command -v q || true)}
if [ -z "$q" ]; then
    version=$(cat .peachq-version)
    echo "q-test: no peachq. Set PEACHQ_Q to a peachq q, or install build $version with" >&2
    echo "  curl -fsSL https://raw.githubusercontent.com/peachq-org/setup-peachq/v1.0.0/install.sh | bash -s -- --version $version" >&2
    echo "or download it from https://peachq.org/file/peachq-v$version-<platform>.tar.gz" >&2
    exit 1
fi

node build-api.js > /dev/null
"$q" test/q/run.q "$@" -classic < /dev/null
