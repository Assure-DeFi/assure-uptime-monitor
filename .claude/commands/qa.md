Tiered quality gate before commits. Scale QA to match change size.

Read the full skill definition at `.agents/skills/qa/SKILL.md` and follow it exactly. The skill contains:
- Change scope analysis (files, lines, types)
- Tier selection: Mechanical (single-file <20 lines) → Standard (multi-file, adds Code Reviewer) → Full (new features/UI, adds Reality Checker + Evidence Collector)
- Issue Validation Gate (validates Code Reviewer findings before fixes are attempted)
- Execution steps per tier with exact commands
- Report format
- Escalation rules (max 3 fix-retry cycles)

Run BEFORE committing. Tier is determined by the highest matching criterion.
