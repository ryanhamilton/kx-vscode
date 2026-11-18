#!/usr/bin/env bash
# Copyright (c) 2026 peachq contributors
# SPDX-License-Identifier: Apache-2.0
# tools/alpine-smoke.sh <vsix> [alpine-x64|alpine-arm64]: runs the vsix's peachq in musl Alpine, with no glibc.
set -euo pipefail
cd "$(dirname "$0")/.."

vsix=$1
target=${2:-alpine-x64}
image=alpine@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
case "$target" in
    alpine-x64) platform=linux/amd64 ;;
    alpine-arm64) platform=linux/arm64 ;;
    *) echo "alpine-smoke: $target is not an alpine target" >&2; exit 2 ;;
esac

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
unzip -q -j "$vsix" "extension/bin/peachq/$target/q" -d "$work"
test -x "$work/q"

docker run --rm --platform "$platform" -v "$work:/pq:ro" \
    -e WANT="$(cat .peachq-version)" "$image" sh -euc '
fail() { echo "alpine-smoke: $*" >&2; exit 1; }
expect() { [ "$2" = "$3" ] || fail "$1 printed [$2], not [$3]"; echo "ok $1: $2"; }
echo "Alpine $(cat /etc/alpine-release), $(uname -m)"
! ls /lib64/ld-linux-* /lib/ld-linux-* > /dev/null 2>&1 || fail "image has a glibc loader"
q=/pq/q
expect .pq.version "$(echo .pq.version | $q -q)" "\"$WANT\""
expect query "$(echo "exec sum v from ([] v:til 10)" | $q -q)" 45
expect -classic "$(echo "1+1" | $q -q -classic)" 2
$q -p 127.0.0.1:5010 -q -classic < /dev/null > /dev/null &
for _ in $(seq 50); do
    got=$(printf "h:hopen 5010\nh\"a:6*7\"\nh\"a\"\n" | $q -q -classic 2>&1 || true)
    [ "$got" = 42 ] && break
    sleep 0.2
done
kill $!
expect "IPC round trip" "$got" 42
'
