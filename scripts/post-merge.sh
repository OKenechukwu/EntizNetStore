#!/bin/bash
# Post-merge setup: runs automatically after a task merge.
# Keep idempotent, non-interactive, and fast.
set -e

# Install any new/changed dependencies
npm install --no-audit --no-fund
