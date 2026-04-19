#!/usr/bin/env bash
set -euo pipefail

module_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$module_dir"

mapfile -t test_packages < <(
  go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./... | sed '/^$/d'
)

if [ "${#test_packages[@]}" -eq 0 ]; then
  echo "no Go test packages found"
  exit 0
fi

go test -v "${test_packages[@]}"
