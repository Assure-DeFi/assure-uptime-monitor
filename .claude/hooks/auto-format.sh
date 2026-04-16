#!/bin/bash

# Auto-Format Hook (PostToolUse)
# Runs prettier on modified TypeScript/JavaScript files

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Check if file path is set and is a JS/TS file
if [[ -n "$FILE_PATH" && "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$FILE_PATH" 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "Formatted with Prettier" >&2
    fi
  fi
fi

exit 0
