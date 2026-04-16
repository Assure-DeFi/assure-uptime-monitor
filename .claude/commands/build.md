Auto-dispatch implementation tasks to the right builder agents with persistent memory. Use for ALL coding/building tasks in this repo.

Read the full skill definition at `.agents/skills/build/SKILL.md` and follow it exactly. The skill contains:
- Routing table matching task context to the right builder agent(s)
- Coordinator selection for multi-agent tasks
- Memory injection protocol (every agent reads/writes its memory file)
- Testing requirements by task type

Do NOT implement directly. Dispatch to the right agent.
