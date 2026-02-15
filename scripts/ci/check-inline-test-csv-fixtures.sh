#!/usr/bin/env bash
set -euo pipefail

determine_range() {
  if [[ "${GITHUB_EVENT_NAME:-}" == "pull_request" && -n "${GITHUB_BASE_REF:-}" ]]; then
    git fetch --no-tags --depth=1 origin "${GITHUB_BASE_REF}"
    local base_ref="origin/${GITHUB_BASE_REF}"
    local merge_base
    merge_base="$(git merge-base "${base_ref}" HEAD)"
    echo "${merge_base}..HEAD"
    return 0
  fi

  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    echo "HEAD^..HEAD"
    return 0
  fi

  return 1
}

if ! RANGE="$(determine_range)"; then
  echo "fixture-guardrail: no diff range available, skipping"
  exit 0
fi

ALLOWLIST_REGEX='^src/etl/importDataset\.test\.ts$'
DIFF_OUTPUT="$(git diff --no-color --unified=0 "${RANGE}" -- ':(glob)**/*.test.ts')"

violations="$(
  printf '%s\n' "${DIFF_OUTPUT}" | awk -v allowlist_regex="${ALLOWLIST_REGEX}" '
    /^\+\+\+ b\// {
      file = substr($0, 7);
      next;
    }
    /^\+[^+]/ {
      if (file ~ allowlist_regex) next;
      if ($0 ~ /\.join\(['\''"]\\n['\''"]\)[[:space:]]*\+[[:space:]]*['\''"]\\n['\''"]/) {
        print file ": " $0;
      }
    }
  ' || true
)"

if [[ -n "${violations}" ]]; then
  echo "fixture-guardrail: inline CSV fixtures detected in added test lines."
  echo "Move CSV fixtures into a fixtures module under src/test/fixtures."
  echo "Legacy allowlist: ${ALLOWLIST_REGEX}"
  echo
  printf '%s\n' "${violations}"
  exit 1
fi

echo "fixture-guardrail: OK"
