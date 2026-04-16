#!/usr/bin/env node
/**
 * Blocks Write/Edit operations that would introduce hardcoded secrets.
 * Reads tool input from stdin (JSON), checks for secret patterns,
 * exits 2 to block the operation if secrets are found.
 */

const SECRET_PATTERNS = [
  // JWT tokens
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-.]{10,}/,
  // AWS access keys
  /AKIA[0-9A-Z]{16}/,
  // Generic API keys
  /sk[-_]live[-_][A-Za-z0-9]{20,}/,
  /sk[-_]test[-_][A-Za-z0-9]{20,}/,
  // OpenAI keys
  /sk-[A-Za-z0-9]{48,}/,
  // Anthropic keys
  /sk-ant-[A-Za-z0-9\-]{40,}/,
  // Database URLs with passwords
  /(?:postgres|mysql|mongodb)(?:ql)?:\/\/[^:]+:[^@\s]{8,}@/i,
  // Private keys
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  // Stripe keys
  /[sr]k_(?:live|test)_[A-Za-z0-9]{20,}/,
  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9]{36,}/,
  // Supabase service role keys (long JWTs)
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}/,
  // xAI/Grok keys
  /xai-[A-Za-z0-9]{20,}/,
];

const ALLOWLIST = [
  /\.env\.example$/,
  /secret-check\.cjs$/,
  /agentic-team-bootstrap-guide\.md$/,
];

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    if (toolName !== 'Write' && toolName !== 'Edit') process.exit(0);
    const filePath = toolInput.file_path || '';
    if (ALLOWLIST.some(p => p.test(filePath))) process.exit(0);
    const content = toolInput.content || toolInput.new_string || '';
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        process.stderr.write(
          `BLOCKED: Secret pattern detected in ${filePath}. Use environment variables instead.`
        );
        process.exit(2);
      }
    }
    process.exit(0);
  } catch { process.exit(0); }
});
