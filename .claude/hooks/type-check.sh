#!/bin/bash

# Type-Check Hook (PostToolUse)
# Runs TypeScript type-checker on modified TS/TSX files

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Check if file path is set and is a TypeScript file
if [[ -n "$FILE_PATH" && "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  # Determine which package this file belongs to and use its tsconfig
  if [[ "$FILE_PATH" == *"/dashboard/"* ]]; then
    cd dashboard && npx tsc --noEmit 2>&1 | head -20
  elif [[ "$FILE_PATH" == *"/outreach-bot/"* ]]; then
    cd outreach-bot && npx tsc -p tsconfig.build.json --noEmit 2>&1 | head -20
  elif [[ "$FILE_PATH" == *"/lead-enrichment/"* ]]; then
    cd lead-enrichment && npx tsc -p tsconfig.build.json --noEmit 2>&1 | head -20
  fi

  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "TypeScript: No type errors" >&2
  else
    echo "TypeScript: Type errors found (see above)" >&2
  fi
fi

exit 0
