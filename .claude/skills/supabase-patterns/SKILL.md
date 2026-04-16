---
name: supabase-patterns
description: Supabase database patterns, migrations, RLS policies, and schema conventions for article-intake project. Use when creating migrations, modifying tables, adding columns, working with database, SQL, or Supabase. Keywords: database, table, column, migration, supabase, sql, schema, RLS, policy, index.
---

# Supabase Patterns for Article-Intake

## Migration File Conventions

### Naming Pattern
```
supabase/migrations/{NNN}_{description}.sql
```
- NNN = zero-padded sequence number (001, 002, etc.)
- Current highest: 035 (check before creating new)
- Description in snake_case

### Migration Header Template
```sql
-- {Description}
-- Migration: {NNN}_{description}.sql
```

## Core Tables Overview

### Main Tables
| Table | Purpose | Key Fields |
|-------|---------|------------|
| topics | Content topics | id, title, article_type, status |
| articles | Generated articles | id, topic_id, title, slug, status |
| job_runs | Background jobs | id, topic_id, job_type, status |
| intel_items | Intelligence items | id, source_type, embedding |
| intel_clusters | Grouped intel | id, score_final, status |
| content_items | Content pipeline | id, topic_id, content_type |

### Status Enums (Use These Exact Values)

**topics.status**: `'SUGGESTED'`, `'APPROVED'`, `'REJECTED'`

**articles.status**: `'DRAFTING'`, `'DRAFT_READY'`, `'APPROVED_TO_PUBLISH'`, `'PUBLISHED'`, `'FAILED'`

**job_runs.status**: `'QUEUED'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'`

**intel_clusters.status**: `'NEW'`, `'SUGGESTED'`, `'CONVERTED'`, `'REJECTED'`

## Column Patterns

### Primary Key
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
```

### Timestamps
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
```

### Foreign Key with Cascade
```sql
topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
```

### Foreign Key with Set Null
```sql
cluster_id UUID REFERENCES intel_clusters(id) ON DELETE SET NULL,
```

### Array Fields
```sql
tags TEXT[] DEFAULT '{}',
source_urls TEXT[] DEFAULT '{}',
```

### JSONB Fields
```sql
stats JSONB DEFAULT '{}',
entities JSONB DEFAULT '{"protocols": [], "tokens": [], "people": [], "chains": []}',
```

### Vector Embeddings (pgvector)
```sql
embedding VECTOR(1536),
```

## Adding a New Column

### Template
```sql
-- Add {column_name} to {table_name}
-- Migration: {NNN}_{description}.sql

ALTER TABLE {table_name}
ADD COLUMN {column_name} {TYPE} {CONSTRAINTS};

-- Add index if frequently queried
CREATE INDEX idx_{table_name}_{column_name} ON {table_name}({column_name});
```

### Example: Adding view_count
```sql
-- Add view_count to articles
-- Migration: 036_add_article_view_count.sql

ALTER TABLE articles
ADD COLUMN view_count INTEGER DEFAULT 0;

-- Add index for sorting by views
CREATE INDEX idx_articles_view_count ON articles(view_count DESC);
```

## Index Patterns

### Standard Index
```sql
CREATE INDEX idx_{table}_{column} ON {table}({column});
```

### Descending Index (for sorts)
```sql
CREATE INDEX idx_{table}_{column} ON {table}({column} DESC);
```

### Vector Index (for similarity search)
```sql
CREATE INDEX idx_{table}_embedding ON {table}
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Constraint Patterns

### CHECK Constraint for Enum
```sql
CONSTRAINT {table}_{column}_check CHECK (
  {column} IN ('VALUE1', 'VALUE2', 'VALUE3')
)
```

### Unique Constraint
```sql
CONSTRAINT {table}_{column}_unique UNIQUE ({column})
```

## Row Level Security (RLS) Patterns

### Enable RLS
```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
```

### Standard Policies (used in this project)
```sql
-- Allow authenticated users full access
CREATE POLICY "Allow authenticated access to {table_name}"
  ON {table_name} FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role access to {table_name}"
  ON {table_name} FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## Trigger for updated_at

### Function (already exists)
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Attaching to New Table
```sql
CREATE TRIGGER update_{table_name}_updated_at
  BEFORE UPDATE ON {table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Creating a New Table

### Complete Template
```sql
-- {Description}
-- Migration: {NNN}_{description}.sql

CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

  -- Fields
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT {table_name}_status_check CHECK (
    status IN ('NEW', 'ACTIVE', 'COMPLETED')
  )
);

-- Indexes
CREATE INDEX idx_{table_name}_topic_id ON {table_name}(topic_id);
CREATE INDEX idx_{table_name}_status ON {table_name}(status);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at DESC);

-- Trigger
CREATE TRIGGER update_{table_name}_updated_at
  BEFORE UPDATE ON {table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to {table_name}"
  ON {table_name} FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role access to {table_name}"
  ON {table_name} FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## MCP Integration

The project has Supabase MCP configured in `.mcp.json`. Available tools:
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__apply_migration` - Apply migrations
- `mcp__supabase__list_tables` - List existing tables

## Quick Reference Checklist

When creating a migration:
- [ ] Check highest migration number (currently 035)
- [ ] Use NNN_description.sql naming
- [ ] Add migration header comment
- [ ] Use UUID for primary keys
- [ ] Include created_at/updated_at for tables
- [ ] Add appropriate indexes
- [ ] Enable RLS and add policies
- [ ] Attach updated_at trigger if needed
- [ ] Use CHECK constraints for enums
