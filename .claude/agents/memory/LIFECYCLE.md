# Memory Lifecycle Protocol

Specification for how agent memory entries progress through their lifecycle.

---

## The Lifecycle Flow

```
                    +---------------------------------------------+
                    |                                             |
   CREATE           |    VALIDATE         PROMOTE       IMMUTABLE |
  ---------> observation -------> pattern -------> constraint     |
                    |       ^                                     |
                    |       | referenced                          |
                    |       | in 2+ sessions                      |
                    |                                             |
                    |    NEGLECT (5+ invocations, 0 references)   |
                    |  ---------> REVIEW QUEUE                    |
                    |               |                             |
                    |          +----+----+                        |
                    |       promote   archive                     |
                    |                                             |
                    +---------------------------------------------+
```

## Memory Entry Types

| Type | Description | Lifecycle |
|------|-------------|-----------|
| `observation` | Raw session finding, initial hypothesis | Promoted to `pattern` after 2+ session references. Flagged for review after 5+ invocations with 0 references. |
| `pattern` | Proven knowledge, validated across 2+ sessions | Never auto-expires. Only demoted if explicitly wrong. |
| `decision` | Architectural choice with rationale (why X over Y) | Never auto-expires. Historical context even if superseded. |
| `constraint` | Hard rule, safety-critical. **Always loaded, every session.** | Never archived. Only removable by the user directly. |
| `temporal` | Time-bound fact (deadline, prospect status) | Requires explicit `Valid-Until` date. Archived (not deleted) when expired. |

## Agent Read Protocol (per session)

1. **Always read**: Constraint entries (hard rules -- load every session, no exceptions)
2. **Read if task-relevant**: Pattern and decision entries that match the current task domain
3. **Skip unless needed**: Observation entries where `Invocations-Since >= 5` and `References == 0` (review queue candidates)
4. **Skip if expired**: Temporal entries where `Valid-Until` date has passed
5. **After session**: Increment `Invocations-Since` on ALL entries. Reset to 0 on any entry that was actively used.

## Agent Write Protocol (per session)

1. **Dedup check**: Search existing entries for same title or similar pattern
2. **If duplicate found**: Update the existing entry's `Discovered` date and reset `Invocations-Since` to 0
3. **If new**: Append as `observation` type with `Invocations-Since: 0`, `References: 0`
4. **Promotion check**: If the agent recognizes an observation it's seen work across sessions, change type to `pattern`

## Entry Format

```markdown
## [Category]: [Brief Title]
**Domain**: [engineering | marketing | sales | security | strategy | ops | general]
**Discovered**: [YYYY-MM-DD]
**Type**: pattern | constraint | decision | temporal | observation
**Supersedes**: [optional -- date + title of entry this replaces, or "none"]
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: [only for temporal type -- YYYY-MM-DD or "ongoing"]
**Context**: [What task triggered this learning]
**Pattern**: [What to do or avoid]
**Why**: [Explanation of why this matters]
```

## Key Principles

- **No memory is deleted automatically.** Only archived (moved, not destroyed). Git history is the safety net.
- **Entry maturity is earned, not assumed.** Observations become patterns through validation.
- **Invocation count drives lifecycle, not wall-clock time.** An agent that runs daily has different memory pressure than one invoked monthly.
- **Calendar time is the wrong dimension. Relevance under use is what matters.**
