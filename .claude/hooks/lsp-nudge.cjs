#!/usr/bin/env node
/**
 * LSP Nudge Hook — PreToolUse handler
 *
 * Intercepts Grep and Read calls on code files that look like
 * code navigation tasks (symbol lookup, definition finding, etc.)
 * and injects additionalContext reminding the agent to use LSP tools.
 *
 * LSP tools available: goToDefinition, findReferences, workspaceSymbol,
 * documentSymbol, hover, diagnostics, incomingCalls, outgoingCalls
 */

const fs = require('fs');

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

const CODE_EXTS = /\.(py|ts|tsx|js|jsx)$/;
const CODE_TYPES = new Set(['py', 'ts', 'js', 'tsx', 'jsx', 'python', 'typescript', 'javascript']);

// Patterns that indicate symbol/definition navigation, not text search
const SYMBOL_PATTERNS = [
  /^(def|class|function|const|let|var|export|import)\s+\w/,
  /^(async\s+)?function\s/,
  /^class\s+[A-Z]/,
  /^[A-Z][a-zA-Z0-9]+$/,
  /^[a-z_][a-zA-Z0-9_]{2,}$/,
  /\bimport\b.*\bfrom\b/,
  /^(interface|type|enum)\s+/,
  /^export\s+(default\s+)?(class|function|const|interface)/,
];

// Patterns that are legitimate text/content searches (NOT code navigation)
const TEXT_SEARCH_PATTERNS = [
  /["'`]/,
  /\/\//,
  /TODO|FIXME|HACK/i,
  /\.(env|json|md|yml|yaml|toml|cfg|ini)$/,
  /console\.(log|error|warn)/,
  /\b(error|warning|debug)\b/i,
];

function isCodeNavigation(toolName, toolInput) {
  if (toolName === 'Grep') {
    const pattern = toolInput.pattern || '';
    const filePath = toolInput.path || '';
    const glob = toolInput.glob || '';
    const type = toolInput.type || '';

    const isCodeTarget = CODE_TYPES.has(type)
      || (glob && CODE_EXTS.test(glob))
      || (filePath && CODE_EXTS.test(filePath));

    if (!isCodeTarget && !type && !glob) {
      // No type/glob filter = broad search, could be code nav if pattern matches
    } else if (!isCodeTarget) {
      return false;
    }

    if (TEXT_SEARCH_PATTERNS.some(re => re.test(pattern))) {
      return false;
    }

    return SYMBOL_PATTERNS.some(re => re.test(pattern));
  }

  return false;
}

function getLspSuggestion(pattern) {
  const lines = [
    'LSP REMINDER: LSP tools are enabled and are faster + more accurate for code navigation.',
    '',
  ];

  if (/^(def|class|function|const|let|var|export|interface|type|enum)\s/.test(pattern)) {
    lines.push('To find this definition: use `workspaceSymbol` with the symbol name');
    lines.push('To find all references: use `findReferences` after locating it');
  } else if (/^[A-Z][a-zA-Z0-9]+$/.test(pattern)) {
    lines.push(`To find class "${pattern}": use \`workspaceSymbol\` with query "${pattern}"`);
    lines.push('Then use `goToDefinition` to jump to the source');
  } else if (/^[a-z_][a-zA-Z0-9_]{2,}$/.test(pattern)) {
    lines.push(`To find symbol "${pattern}": use \`workspaceSymbol\` with query "${pattern}"`);
    lines.push('To find all usages: use `findReferences` on the definition');
    lines.push('To check its type: use `hover` on any occurrence');
  } else if (/import.*from/.test(pattern)) {
    lines.push('To trace imports: use `goToDefinition` on the import path');
  }

  lines.push('');
  lines.push('Grep is appropriate for: text searches, comments, strings, config values, non-code files.');
  lines.push('LSP is appropriate for: finding definitions, references, symbols, types, and call chains.');

  return lines.join('\n');
}

function main() {
  const input = readInput();

  if (input.hook_event_name !== 'PreToolUse') return;

  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  if (!isCodeNavigation(toolName, toolInput)) return;

  const pattern = toolInput.pattern || '';

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: getLspSuggestion(pattern)
    }
  }));
}

main();
