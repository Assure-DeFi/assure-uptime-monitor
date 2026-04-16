# Git Workflow Rules

These rules apply to ALL git operations.

## Branch Strategy

### Branch Naming
```
work/<feature-name>
fix/<bug-description>
refactor/<area>
```

### Protected Branches
- `main` - Production code, never edit directly
- `master` - Same as main (legacy repos)

## Commit Rules

### Format
```
<type>: <description>

[optional body]

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types
| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring |
| `docs` | Documentation |
| `test` | Tests |
| `chore` | Maintenance |

### Guidelines
- One logical change per commit
- Clear, descriptive messages
- Include Co-Authored-By for AI collaboration

## Workflow

### Starting Work
```bash
# Ensure on latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b work/feature-name
```

### During Development
```bash
# Commit frequently
git add .
git commit -m "feat: add feature"

# Push to remote
git push origin HEAD
```

### Prohibited Actions
- **Never force push** (`git push --force`)
- **Never commit secrets** (check before push)
- **Never edit main directly** (use branches)
- **Never use interactive commands** (`git rebase -i`)

## Pull Requests

### Before Creating PR
- [ ] All tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Branch is up to date with main

### PR Format
```markdown
## Summary
Brief description of changes

## Test Plan
How to verify the changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets committed
```

## Emergency Procedures

### Accidentally Committed Secret
1. Do NOT push
2. Reset the commit: `git reset HEAD~1`
3. Remove the secret
4. Re-commit

### Wrong Branch
1. Stash changes: `git stash`
2. Switch branch: `git checkout correct-branch`
3. Apply changes: `git stash pop`
