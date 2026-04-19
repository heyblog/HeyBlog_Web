#!/usr/bin/env bash
set -euo pipefail

module_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$module_dir/.cache/go-build" "$module_dir/.cache/go-tmp"

export GOCACHE="$module_dir/.cache/go-build"
export GOTMPDIR="$module_dir/.cache/go-tmp"

"$@"
