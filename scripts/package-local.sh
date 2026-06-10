#!/usr/bin/env bash
# Build fmd-server from the local working tree and package it for Ansible deploy.
# Output: dist/fmd-server-securepouch-v<VERSION>.zip
#
# Usage: ./scripts/package-local.sh [version]
# Example: ./scripts/package-local.sh 0.1.0

set -euo pipefail

VERSION=${1:-0.1.0}
ZIPNAME="fmd-server-securepouch-v${VERSION}.zip"
OUTDIR="$PWD/dist"

mkdir -p "$OUTDIR"

echo "==> Building web frontend..."
(cd web && pnpm install --frozen-lockfile && pnpm run build)

echo "==> Compiling Go binary (linux/amd64)..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "fmd-server-amd64" .
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "fmd-server-ctl-amd64" ./ctl

echo "==> Packaging..."
zip -j "$OUTDIR/$ZIPNAME" fmd-server-amd64 fmd-server-ctl-amd64
rm -f fmd-server-amd64 fmd-server-ctl-amd64

echo "==> Done: $OUTDIR/$ZIPNAME"
