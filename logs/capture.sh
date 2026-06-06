#!/usr/bin/env bash
set -euo pipefail

STRIP_ANSI="s/\x1B\[[0-9;]*[JKmsu]//g"
LOG_FILE="logs/run-$(date +%Y-%m-%dT%H-%M-%S).log"

FORCE_COLOR=1 npm start -- "$@" 2>&1 | tee >(sed -u -E "$STRIP_ANSI" > "$LOG_FILE")
