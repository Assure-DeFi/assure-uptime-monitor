# BEFORE Test: Supabase Patterns Skill

## Test Configuration
- **Date**: 2026-01-17
- **Test Prompt**: "Add a new column to the articles table to track view counts"
- **Context**: Working in article-intake project without Supabase patterns skill
- **Current State**: Schema in migration files, no consolidated knowledge

---

## Pre-Test Analysis

### Information Available to Claude WITHOUT Skill
1. Migration files exist but Claude must read them individually
2. 35+ migration files to potentially search through
3. No consolidated view of current schema
4. No documented patterns for migrations

### Predicted Behavior Without Supabase Skill

**Tool Calls Expected**:
1. Search for articles table (Grep for "articles")
2. Read multiple migration files to understand schema
3. Determine column naming conventions
4. Write new migration file

**Likely Issues**:
1. May miss existing view_count column if one exists
2. May not follow migration naming conventions (NNN_description.sql)
3. May forget to enable RLS policies for new column
4. May not add appropriate index
5. May use different data types than project convention

---

## Simulated Test Run

### Scenario: Claude responds to "Add a new column to the articles table to track view counts"

**Step 1**: Claude searches for articles table
```
Grep for "CREATE TABLE articles"
```

**Step 2**: Claude reads migration 001 (found the table)

**Step 3**: Claude may or may not check if view_count already exists
- Needs to read multiple files to be sure

**Step 4**: Claude creates migration
- May not follow NNN_ naming convention
- May forget updated_at trigger
- May forget RLS policies

---

## Metrics to Track

1. **Migration Naming**: Does it follow NNN_description.sql pattern?
2. **Column Naming**: Does it match existing conventions?
3. **Index Addition**: Is an appropriate index added?
4. **RLS Policies**: Are policies updated if needed?
5. **Timestamp Handling**: Does it consider updated_at trigger?

---

## Baseline Observation

Without the Supabase skill:
- Claude must read multiple migration files to understand patterns
- High risk of inconsistent naming
- May miss RLS, indexes, or triggers
- No single source of truth for conventions

**Quality Score (Predicted)**: 5/10
- Migration may work but likely inconsistent
- Requires manual verification of patterns
