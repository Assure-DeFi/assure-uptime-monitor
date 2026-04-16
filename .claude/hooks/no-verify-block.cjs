#!/usr/bin/env node
/**
 * Blocks Bash commands that include --no-verify flag.
 * Prevents agents from bypassing pre-commit hooks.
 */

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'Bash') process.exit(0);
    const command = data.tool_input?.command || '';
    if (/--no-verify/.test(command)) {
      process.stderr.write('BLOCKED: --no-verify is not allowed. Fix the underlying issue instead.');
      process.exit(2);
    }
    process.exit(0);
  } catch { process.exit(0); }
});
