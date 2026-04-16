## HARD RULE: Agent-First Development

This repo has 40+ specialized agents with persistent memory in `.claude/agents/`.
Agent dispatch is enforced by skills, not optional.

### How It Works

- **`/build`** — Routes implementation tasks to the right builder agents. Use for ALL coding tasks. Agents read their memory at start, write learnings at end.
- **`/qa`** — Tiered quality gate before commits. Mechanical checks always run. Code Reviewer + Issue Validation on multi-file changes. Full review (Reality Checker + Evidence Collector + Adversary) on features/UI.
- **Agent roster**: `.claude/agents/README.md` — the authoritative list of all agents + file paths
- **Agent memory**: `.claude/agents/memory/{name}.md` — persistent, append-only, committed to git

### HARD RULE: Agent Dispatch Parameters

Every `Agent()` call MUST include:

1. **`subagent_type`**: The agent's exact display name from its frontmatter `name:` field (e.g., `"Full-Stack Dev"`, `"Code Reviewer"`). This loads the agent definition as the system prompt and enables tracking.
2. **`mode: "bypassPermissions"`**: Required on ALL dispatches so subagents execute autonomously.

**NEVER use `subagent_type: "general-purpose"`.** It makes agents invisible to monitoring and doesn't load any agent definition.

**Dispatch format:**

```
Agent(
  subagent_type: "{Agent Display Name}",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "{TASK DESCRIPTION}"
)
```

### HARD RULE: Task-Type Routing (ALL Tasks)                                  
                                                                                
  You MUST NOT investigate, research, analyze, or implement tasks directly.     
  ALWAYS dispatch to the appropriate agent from this table. The ONLY exception  
  is trivial clarification questions (e.g., "what's the DB column name for X?").
                                                                             
  If you catch yourself reading code, querying databases, or writing code       
  without having dispatched an agent first — STOP. Look up the right agent and
  dispatch it.
  
  Every task routes through the agent team — not just `/build`:


| Task Type | Route To | subagent_type |
|---|---|---|
| Implementation / coding | /build skill (auto-routes) | (per routing table) |
| Discovery pipeline ops | Pipeline Operations Lead | `"Pipeline Operations Lead"` |
| Dashboard features / analytics | Data & Analytics Lead | `"Data & Analytics Lead"` |
| DM quality / classification / playbooks | Sales Intel Lead | `"Sales Intel Lead"` |
| Cross-team coordination, blockers | Chief of Staff | `"Chief of Staff"` |
| Product roadmap, feature prioritization | VP Product | `"VP Product"` |
| Security review | Security Auditor | `"Security Auditor"` |
| Railway/Vercel deployments | Deploy Specialist | `"Deploy Specialist"` |
| Repair scripts, backfills | Ops Scripts Specialist | `"Ops Scripts Specialist"` |
| Entity classification tuning | Autoresearch Specialist | `"Autoresearch Specialist"` |
| DM writing quality, AI-tell audit | DM Quality Specialist | `"DM Quality Specialist"` |
| InboxApp integration | InboxApp Specialist | `"InboxApp Specialist"` |
| Supabase migrations, schema | Migration & Schema Specialist | `"Migration & Schema Specialist"` |
| Cost tracking, budget | Cost & Budget Analyst | `"Cost & Budget Analyst"` |

For tasks spanning multiple teams, dispatch the team lead — they decompose and delegate.

### Agent Memory Protocol

Every agent reads its memory file at session start and appends learnings at session end.
Quality failures = training data. Memory files are committed to git — the whole team benefits.

**Required entry format for all new memory entries:**

```markdown
## [Category]: [Brief Title]
**Domain**: [discovery | enrichment | outreach | dashboard | classification | security | ops | general]
**Discovered**: [today's date]
**Type**: pattern | constraint | decision | temporal | observation
**Supersedes**: [optional — date + title of entry this replaces, or "none"]
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: [only for temporal type — YYYY-MM-DD or "ongoing"]
**Context**: [What task triggered this learning]
**Pattern**: [What to do or avoid]
**Why**: [Explanation of why this matters]
```

**Type field meanings:**
- `pattern`: Proven knowledge, validated across 2+ sessions. Never auto-expires.
- `constraint`: Hard rule, safety-critical avoidance. Always loaded, never archived.
- `decision`: Why we chose X over Y, architectural choice. Never auto-expires.
- `temporal`: Time-bound fact. Requires `Valid-Until` date. Archived when expired.
- `observation`: Unvalidated learning. Promoted to `pattern` after 2+ session references.

## Bugs

When I report a bug, don't start by trying to fix it. Instead, start by writing a test that reproduces the bug. Then, have subagents try to fix the bug and prove it with a passing test.
