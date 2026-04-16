# Claude Code Setup Recommendations

## Executive Summary

After analyzing the reference repository (ChrisWiles/claude-code-showcase) and comparing it with your current setup, I've identified several high-impact improvements. Your current setup is minimal but functional - you have the foundation (CLAUDE.md files, .mcp.json, ralph-loop plugin), but you're missing the automation and knowledge-capture layers that make Claude Code truly powerful.

## Current State

### What You Have
- `.claude/settings.json` - Only enables claude-stt plugin
- `.claude/settings.local.json` - Extensive permissions list
- `.claude/ralph-loop.local.md` - Task execution context
- `CLAUDE.md` files in projects (ralph-lab has good template, article-intake is minimal)
- `.mcp.json` in article-intake with Supabase connection
- Well-organized brand files in projects

### What's Missing
- No `.claude/skills/` directory (domain knowledge documents)
- No `.claude/commands/` directory (slash commands)
- No `.claude/agents/` directory (specialized AI assistants)
- No `.claude/hooks/` directory (automation scripts)
- No `.claude/rules/` directory (modular instruction files)
- No automated guardrails (branch protection, auto-format)

---

## Prioritized Recommendations

### 1. [HIGH IMPACT] Create Brand Guidelines Skill
**Gap**: Brand rules are buried in project folders; Claude must be explicitly told to read them.
**Solution**: Create a skill that packages brand knowledge so Claude automatically applies it.

**Test Prompt**: "Create a new button component for the dashboard"

**Expected Impact**: Claude will automatically use brand colors, follow DO-NOT rules, and apply professional dark-mode styling without being reminded.

---

### 2. [HIGH IMPACT] Add Main Branch Protection Hook
**Gap**: No safeguard against accidental edits on main branch.
**Solution**: Add PreToolUse hook that blocks Edit/Write on main branch.

**Test Prompt**: "Fix the typo in README.md" (while on main branch)

**Expected Impact**: Claude will be blocked from editing and prompted to create a feature branch first.

---

### 3. [HIGH IMPACT] Create Supabase Patterns Skill
**Gap**: Claude doesn't know your Supabase schema or patterns without reading migration files each time.
**Solution**: Skill document describing tables, RLS patterns, and conventions.

**Test Prompt**: "Add a new column to track article view counts"

**Expected Impact**: Claude will follow existing migration patterns and RLS conventions automatically.

---

### 4. [MEDIUM IMPACT] Create /ralph Command
**Gap**: Ralph Loop requires reading the ralph-loop.local.md file manually.
**Solution**: Slash command that initializes Ralph execution with proper context.

**Test Prompt**: "/ralph Continue with Phase 2 of the Topic Intelligence Engine"

**Expected Impact**: Streamlined Ralph workflow with automatic context loading.

---

### 5. [MEDIUM IMPACT] Create Next.js Patterns Skill
**Gap**: Claude may use different patterns for App Router, API routes, etc.
**Solution**: Skill documenting your specific Next.js conventions.

**Test Prompt**: "Create an API endpoint for fetching articles by topic"

**Expected Impact**: Consistent API route patterns, error handling, and typing conventions.

---

### 6. [MEDIUM IMPACT] Add PostToolUse Hooks for Auto-Format and Type-Check
**Gap**: No automatic quality enforcement after edits.
**Solution**: Hooks that run prettier and tsc after file modifications.

**Test Prompt**: "Add a new utility function in src/lib/utils.ts"

**Expected Impact**: Code automatically formatted and type-checked after each edit.

---

### 7. [MEDIUM IMPACT] Create Code Review Agent
**Gap**: No automated review process for changes.
**Solution**: Agent that reviews code against project standards.

**Test Prompt**: "Review the changes I made to the article component"

**Expected Impact**: Structured review following TypeScript standards, error handling patterns, and conventions.

---

### 8. [LOW IMPACT] Enhance article-intake CLAUDE.md
**Gap**: Current CLAUDE.md is too minimal (15 lines vs ralph-lab's 93 lines).
**Solution**: Expand with specific commands, directory structure, and CI/CD information.

**Test Prompt**: "What commands do I use to run tests in this project?"

**Expected Impact**: Claude knows project commands without searching through package.json.

---

### 9. [LOW IMPACT] Create Centralized Rules Directory
**Gap**: Rules scattered across project folders.
**Solution**: Centralize common rules in .claude/rules/ for cross-project consistency.

**Test Prompt**: "What are the UI guidelines for this project?"

**Expected Impact**: Consistent rule application across all projects.

---

### 10. [LOW IMPACT] Add UserPromptSubmit Hook for Skill Suggestion
**Gap**: No automatic skill matching based on prompt content.
**Solution**: Hook that analyzes prompts and suggests relevant skills.

**Test Prompt**: "Help me write tests for the article component"

**Expected Impact**: Automatic suggestion to load testing-patterns skill.

---

## Testing Framework

For each recommendation, we'll:
1. Run a test prompt BEFORE making changes
2. Document Claude's response, tool usage, and quality
3. Apply the recommended change
4. Run the SAME test prompt AFTER changes
5. Compare and analyze the difference
6. Determine if the change had meaningful impact

Files:
- `before/{recommendation-id}.md` - Notes from pre-change test
- `after/{recommendation-id}.md` - Notes from post-change test
- `reports/{recommendation-id}-analysis.md` - Comparative analysis

---

## Implementation Order

1. Brand Guidelines Skill (highest impact, foundational)
2. Main Branch Protection Hook (safety guardrail)
3. Supabase Patterns Skill (frequent use case)
4. PostToolUse Hooks (quality enforcement)
5. Enhanced CLAUDE.md (low effort, immediate benefit)
6. Remaining items based on initial results
