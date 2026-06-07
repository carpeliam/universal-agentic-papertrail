#!/usr/bin/env bash
set -euo pipefail

STRIP_ANSI="s/\x1B\[[0-9;]*[JKmsu]//g"
LOG_FILE="logs/run-$(date +%Y-%m-%dT%H-%M-%S).log"

trap 'echo "" >> "$LOG_FILE"; cat data/metrics.json >> "$LOG_FILE"' INT

git --no-pager log -1 --oneline > $LOG_FILE
git --no-pager diff --stat >> $LOG_FILE
FORCE_COLOR=1 npm start -- "$@" 2>&1 | tee >(sed -u -E "$STRIP_ANSI" >> "$LOG_FILE")
