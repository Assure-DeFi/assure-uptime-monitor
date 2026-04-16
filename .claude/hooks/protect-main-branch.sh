#!/bin/bash

# Protect Main Branch Hook
# Blocks Edit/Write operations when on main or master branch
# Exit code 2 = blocking error

# Parse hook input to get file path
# Hook input is JSON on stdin: {"tool":"Edit","input":{"file_path":"/path/to/file",...}}
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)

# Get git root directory
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

# If we got a file path and git root, check if file is outside repo
if [[ -n "$FILE_PATH" ]] && [[ -n "$GIT_ROOT" ]]; then
  # Normalize paths for comparison
  REAL_FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
  REAL_GIT_ROOT=$(realpath "$GIT_ROOT" 2>/dev/null || echo "$GIT_ROOT")

  # If file is outside git root, allow it
  if [[ "$REAL_FILE_PATH" != "$REAL_GIT_ROOT"* ]]; then
    exit 0
  fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)

# Check if we're on main or master
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ][ "$CURRENT_BRANCH" = "master" ]; then
  echo '{"block": true, "message": "Cannot edit files on main/master branch. Create a feature branch first:\n\ngit checkout -b work/your-feature-name\n\nThen retry your edit."}' >&2
  exit 2
fi

# Allow the operation
exit 0
