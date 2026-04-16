---
name: mason-update
version: 2.1.0
description: Update Mason commands to latest versions
---

# Mason Update Command

Check for and install updates to Mason commands.

## Overview

This command checks for updates to all Mason commands and optionally installs them. It compares local versions against the remote manifest and provides a clear update path.

## Usage

```
/mason-update [options]
```

Options:

- `--check`: Check for updates without installing
- `--force`: Update all commands even if versions match

Examples:

- `/mason-update` - Check and install available updates
- `/mason-update --check` - Only check for updates, don't install
- `/mason-update --force` - Force reinstall all commands

## Process

### Step 0: Self-Bootstrap (CRITICAL - RUN FIRST)

**This step ensures mason-update itself is current before updating other commands.**

```bash
echo "=== MASON-UPDATE SELF-CHECK ==="

BASE_URL="https://raw.githubusercontent.com/Assure-DeFi/mason/main/packages/mason-commands"
LOCAL_VERSION=$(grep -m1 "^version:" ".claude/commands/mason-update.md" 2>/dev/null | cut -d: -f2 | tr -d ' ')
REMOTE_MANIFEST=$(curl -fsSL --connect-timeout 5 "${BASE_URL%/commands}/versions.json" 2>/dev/null)
REMOTE_VERSION=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."mason-update".version // ""' 2>/dev/null)

echo "Local mason-update: v${LOCAL_VERSION:-not found}"
echo "Remote mason-update: v${REMOTE_VERSION}"

if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo ""
  echo "Updating mason-update itself..."
  curl -fsSL "${BASE_URL}/commands/mason-update.md" -o ".claude/commands/mason-update.md" 2>/dev/null
  echo "mason-update updated to v${REMOTE_VERSION}"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║  RESTART REQUIRED: Re-invoke /mason-update to use new version           ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  exit 0
fi

echo "mason-update is current."
echo "==============================="
echo ""
```

**IF mason-update was updated:** The agent MUST re-invoke `/mason-update` to continue with the new version. Do NOT proceed with the old logic.

---

### Step 1: Fetch Remote Version Manifest

```bash
echo "Mason Commands - Update Check"
echo "=============================="
echo ""

# Fetch remote versions
REMOTE_MANIFEST=$(curl -fsSL --connect-timeout 5 "https://raw.githubusercontent.com/Assure-DeFi/mason/main/packages/mason-commands/versions.json" 2>/dev/null)

if [ -z "$REMOTE_MANIFEST" ]; then
  echo "ERROR: Unable to fetch version manifest from GitHub."
  echo "Please check your internet connection and try again."
  exit 1
fi

MANIFEST_VERSION=$(echo "$REMOTE_MANIFEST" | jq -r '.manifest_version // 0')
echo "Remote manifest version: $MANIFEST_VERSION"
echo ""
```

### Step 2: Compare Local Versions

```bash
echo "Checking command versions..."
echo ""

UPDATES_AVAILABLE=0

# Define all commands to check
COMMANDS=("pm-review" "pm-banger" "pm-quick" "pm-focus" "execute-approved" "mason-update" "battle-test")

for cmd in "${COMMANDS[@]}"; do
  LOCAL_VERSION=$(grep -m1 "^version:" ".claude/commands/${cmd}.md" 2>/dev/null | cut -d: -f2 | tr -d ' ')
  REMOTE_VERSION=$(echo "$REMOTE_MANIFEST" | jq -r ".commands.\"${cmd}\".version // \"\"")

  if [ -z "$LOCAL_VERSION" ]; then
    echo "  ${cmd}: Not installed → $REMOTE_VERSION (new)"
    UPDATES_AVAILABLE=1
  elif [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
    echo "  ${cmd}: $LOCAL_VERSION → $REMOTE_VERSION (update available)"
    UPDATES_AVAILABLE=1
  else
    echo "  ${cmd}: $LOCAL_VERSION (up to date)"
  fi
done

echo ""
```

### Step 3: Handle Check-Only Mode

If `--check` flag is provided:

```bash
if [ "$UPDATES_AVAILABLE" -eq 0 ]; then
  echo "All commands are up to date!"
else
  echo "$UPDATES_AVAILABLE update(s) available."
  echo ""
  echo "Run /mason-update to install updates."
fi
exit 0
```

### Step 4: Prompt for Confirmation (Interactive)

If updates are available and not in check-only mode:

```markdown
Updates are available. Proceed with installation?

This will:

1. Back up existing command files to .claude/commands/backup/
2. Download latest versions from GitHub
3. Update .claude/.mason-state.json with new versions

**Note:** Your mason.config.json and domain knowledge will NOT be modified.
```

Use AskUserQuestion tool to confirm:

```json
{
  "questions": [
    {
      "question": "Proceed with updating Mason commands?",
      "header": "Update",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes, update commands",
          "description": "Download and install latest command versions"
        },
        {
          "label": "No, cancel",
          "description": "Keep current versions"
        }
      ]
    }
  ]
}
```

### Step 5: Create Backups

```bash
# Create backup directory with timestamp
BACKUP_DIR=".claude/commands/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backups..."

# Backup existing files
COMMANDS=("pm-review" "pm-banger" "pm-quick" "pm-focus" "execute-approved" "mason-update" "battle-test")
for cmd in "${COMMANDS[@]}"; do
  if [ -f ".claude/commands/${cmd}.md" ]; then
    cp ".claude/commands/${cmd}.md" "$BACKUP_DIR/"
    echo "  Backed up: ${cmd}.md"
  fi
done

echo ""
```

### Step 6: Download Updates

```bash
BASE_URL="https://raw.githubusercontent.com/Assure-DeFi/mason/main/packages/mason-commands"

echo "Downloading updates..."

# Download each command that needs updating
download_command() {
  local cmd=$1
  local local_ver=$2
  local remote_ver=$3

  if [ "$local_ver" != "$remote_ver" ] || [ "$FORCE_UPDATE" = "true" ]; then
    curl -fsSL "${BASE_URL}/commands/${cmd}.md" -o ".claude/commands/${cmd}.md" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "  Updated: ${cmd}.md ($local_ver → $remote_ver)"
    else
      echo "  ERROR: Failed to download ${cmd}.md"
      return 1
    fi
  fi
}

# Update all commands
COMMANDS=("pm-review" "pm-banger" "pm-quick" "pm-focus" "execute-approved" "mason-update" "battle-test")
for cmd in "${COMMANDS[@]}"; do
  LOCAL_VERSION=$(grep -m1 "^version:" ".claude/commands/${cmd}.md" 2>/dev/null | cut -d: -f2 | tr -d ' ')
  REMOTE_VERSION=$(echo "$REMOTE_MANIFEST" | jq -r ".commands.\"${cmd}\".version // \"\"")
  download_command "$cmd" "$LOCAL_VERSION" "$REMOTE_VERSION"
done

echo ""
```

### Step 7: Update State File

```bash
# Get all remote versions for state file
PM_REVIEW_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."pm-review".version // ""')
PM_BANGER_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."pm-banger".version // ""')
PM_QUICK_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."pm-quick".version // ""')
PM_FOCUS_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."pm-focus".version // ""')
EXEC_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."execute-approved".version // ""')
UPDATE_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."mason-update".version // ""')
BATTLE_VER=$(echo "$REMOTE_MANIFEST" | jq -r '.commands."battle-test".version // ""')

# Record installed versions
cat > .claude/.mason-state.json << EOF
{
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "manifest_version": $MANIFEST_VERSION,
  "installed_versions": {
    "pm-review": "$PM_REVIEW_VER",
    "pm-banger": "$PM_BANGER_VER",
    "pm-quick": "$PM_QUICK_VER",
    "pm-focus": "$PM_FOCUS_VER",
    "execute-approved": "$EXEC_VER",
    "mason-update": "$UPDATE_VER",
    "battle-test": "$BATTLE_VER"
  }
}
EOF

echo "State file updated: .claude/.mason-state.json"
echo ""
```

### Step 8: Verify Installation

```bash
echo "Verifying installation..."

ERRORS=0

verify_version() {
  local cmd=$1
  local expected=$2
  local actual=$(grep -m1 "^version:" ".claude/commands/${cmd}.md" 2>/dev/null | cut -d: -f2 | tr -d ' ')

  if [ "$actual" = "$expected" ]; then
    echo "  [OK] ${cmd}: $actual"
  else
    echo "  [ERROR] ${cmd}: expected $expected, got $actual"
    ERRORS=$((ERRORS + 1))
  fi
}

COMMANDS=("pm-review" "pm-banger" "pm-quick" "pm-focus" "execute-approved" "mason-update" "battle-test")
for cmd in "${COMMANDS[@]}"; do
  REMOTE_VERSION=$(echo "$REMOTE_MANIFEST" | jq -r ".commands.\"${cmd}\".version // \"\"")
  verify_version "$cmd" "$REMOTE_VERSION"
done

echo ""

if [ $ERRORS -gt 0 ]; then
  echo "WARNING: $ERRORS verification error(s)."
  echo "Backups available at: $BACKUP_DIR"
else
  echo "Update complete! All commands verified."
fi
```

## Output Format

### Successful Update

```
Mason Commands - Update Check
==============================

Remote manifest version: 3

Checking command versions...

  pm-review: 2.15.0 → 3.0.0 (update available)
  pm-banger: Not installed → 3.0.0 (new)
  pm-quick: Not installed → 3.0.0 (new)
  pm-focus: Not installed → 3.0.0 (new)
  execute-approved: 2.10.0 (up to date)
  mason-update: 1.0.0 → 2.0.0 (update available)
  battle-test: 1.0.0 (up to date)

Creating backups...
  Backed up: pm-review.md
  Backed up: mason-update.md

Downloading updates...
  Updated: pm-review.md (2.15.0 → 3.0.0)
  Updated: pm-banger.md (null → 3.0.0)
  Updated: pm-quick.md (null → 3.0.0)
  Updated: pm-focus.md (null → 3.0.0)
  Updated: mason-update.md (1.0.0 → 2.0.0)

State file updated: .claude/.mason-state.json

Verifying installation...
  [OK] pm-review: 3.0.0
  [OK] pm-banger: 3.0.0
  [OK] pm-quick: 3.0.0
  [OK] pm-focus: 3.0.0
  [OK] execute-approved: 2.10.0
  [OK] mason-update: 2.0.0
  [OK] battle-test: 1.0.0

Update complete! All commands verified.
```

### No Updates Available

```
Mason Commands - Update Check
==============================

Remote manifest version: 3

Checking command versions...

  pm-review: 3.0.0 (up to date)
  pm-banger: 3.0.0 (up to date)
  pm-quick: 3.0.0 (up to date)
  pm-focus: 3.0.0 (up to date)
  execute-approved: 2.10.0 (up to date)
  mason-update: 2.0.0 (up to date)
  battle-test: 1.0.0 (up to date)

All commands are up to date!
```

## Error Handling

| Error               | Resolution                                           |
| ------------------- | ---------------------------------------------------- |
| Network timeout     | Retry with longer timeout, check internet connection |
| Invalid manifest    | Report issue, use --force to reinstall from latest   |
| Download failed     | Restore from backup, retry                           |
| Verification failed | Check backup directory, report issue                 |

## Important Notes

1. **Backups are always created** before any files are modified
2. **mason.config.json is never modified** - only command files are updated
3. **Domain knowledge is preserved** - your customizations remain intact
4. **State file tracks versions** - enables future update checks
5. **Idempotent** - safe to run multiple times

## Command Reference

| Command             | Purpose                        |
| ------------------- | ------------------------------ |
| `/pm-review`        | Full review (25 items)         |
| `/pm-banger`        | Single banger idea (1 item)    |
| `/pm-quick`         | Quick pulse check (9 items)    |
| `/pm-focus`         | Domain deep dive (5 items)     |
| `/execute-approved` | Execute approved backlog items |
| `/mason-update`     | Update commands (this)         |
| `/battle-test`      | E2E testing framework          |
