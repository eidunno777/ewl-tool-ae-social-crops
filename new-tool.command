#!/usr/bin/env bash
# new-tool.command
#
# Bootstrap a new VR Art tool from this template.
#
# Double-click in Finder OR run from terminal.
# - Prompts for tool name, category, Drive folder
# - Creates the GHE repo from this template
# - Clones it into ~/Documents/GitHub/vr-tool-<name>
# - Wires the post-commit Drive sync hook
# - Opens the new repo in Finder + GitHub Desktop
#
# After this, edit tool.manifest.json + drop your tool files in,
# then commit via GitHub Desktop. Sync happens automatically.

set -e

# Always work from a known cwd (script may be double-clicked from anywhere)
cd ~/Documents/GitHub

clear
cat <<'BANNER'
══════════════════════════════════════════════════
  Create a new VR Art tool from template
══════════════════════════════════════════════════

BANNER

# --- preflight ----------------------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
  echo "✗ gh CLI not installed. Run:  brew install gh"
  echo ""
  read -p "Press Enter to close..." _
  exit 1
fi

if ! gh auth status -h ghe.oculus-rep.com >/dev/null 2>&1; then
  echo "✗ Not authenticated with GHE. Run:  gh auth login --hostname ghe.oculus-rep.com"
  echo ""
  read -p "Press Enter to close..." _
  exit 1
fi

# --- prompts ------------------------------------------------------------------
echo "Tool name (kebab-case, no 'vr-tool-' prefix)"
echo "Examples:  color-grader, scene-cleaner, layer-picker"
read -p "→ " NAME
[ -z "$NAME" ] && { echo "✗ name required"; read -p "Press Enter to close..." _; exit 1; }
REPO="vr-tool-$NAME"

if [ -e "$REPO" ]; then
  echo "✗ ~/Documents/GitHub/$REPO already exists"
  read -p "Press Enter to close..." _
  exit 1
fi

echo ""
echo "Short description (one sentence — what does this tool do?)"
read -p "→ " DESC
[ -z "$DESC" ] && DESC="VR Art tool"

echo ""
echo "Category:"
echo "  1) ae    — After Effects"
echo "  2) c4d   — Cinema 4D"
echo "  3) figma — Figma"
echo "  4) os    — OS-level utility"
read -p "→ [1-4] " CAT_CHOICE
case "$CAT_CHOICE" in
  1) CAT_ID="ae";    CAT_DIR="Ae";    APP_ID="aftereffects"; TOOL_TYPE="jsx_script" ;;
  2) CAT_ID="c4d";   CAT_DIR="C4D";   APP_ID="cinema4d";     TOOL_TYPE="c4d_plugin" ;;
  3) CAT_ID="figma"; CAT_DIR="Figma"; APP_ID="figma";        TOOL_TYPE="figma_plugin" ;;
  4) CAT_ID="os";    CAT_DIR="OS";    APP_ID="";             TOOL_TYPE="os_tool" ;;
  *) echo "✗ invalid choice"; read -p "Press Enter to close..." _; exit 1 ;;
esac

# Suggest a Drive folder name (snake_case from the kebab name)
DEFAULT_DRIVE_NAME=$(echo "$NAME" | sed 's/-/_/g' | awk '{
  for (i=1; i<=NF; i++) printf "%s%s", toupper(substr($i,1,1)), substr($i,2)
}')
echo ""
echo "Drive folder name [default: $DEFAULT_DRIVE_NAME]"
read -p "→ " DRIVE_NAME
DRIVE_NAME="${DRIVE_NAME:-$DEFAULT_DRIVE_NAME}"

DRIVE_ROOT="/Users/$USER/Library/CloudStorage/GoogleDrive-edlivingstone@meta.com/Shared drives/HzOS_Active Workstreams/Global_Assets/Tools"
DRIVE_PATH="$DRIVE_ROOT/$CAT_DIR/$DRIVE_NAME"

# --- confirm ------------------------------------------------------------------
echo ""
echo "──────────────────────────────────────────────────"
echo "  Repo:        $REPO  (private, on GHE)"
echo "  Local:       ~/Documents/GitHub/$REPO"
echo "  Drive:       Tools/$CAT_DIR/$DRIVE_NAME"
echo "  Category:    $CAT_ID"
echo "  ToolType:    $TOOL_TYPE  (you can change in manifest)"
echo "  Description: $DESC"
echo "──────────────────────────────────────────────────"
read -p "Proceed? [y/N] " YN
[[ ! "$YN" =~ ^[yY]$ ]] && { echo "Aborted."; read -p "Press Enter to close..." _; exit 0; }

# --- create + clone -----------------------------------------------------------
echo ""
echo "→ Creating GHE repo + cloning..."
gh repo create "$REPO" \
  --private \
  --template edlivingstone/vr-art-tool-template \
  --clone \
  --description "$DESC" >/dev/null

cd "$REPO"

# --- strip template-only docs that don't belong in a tool repo ----------------
rm -f CONFIGURE-NEW-TOOL.md README.md new-tool.command

# --- write a prefilled manifest -----------------------------------------------
APP_ID_LINE=""
if [ -n "$APP_ID" ]; then
  APP_ID_LINE='
  "appId": "'$APP_ID'",'
fi

cat > tool.manifest.json <<EOF
{
  "id": "$NAME",
  "name": "TODO Display Name",
  "description": "$DESC",
  "category": "$CAT_ID",
  "toolType": "$TOOL_TYPE",
  "version": "1.0.0",
  "author": "Eddie Livingstone",
  "downloadUrl": "",
  "localSourcePath": "$CAT_DIR/$DRIVE_NAME",
  "fileName": "TODO main file name",
  "installDetection": {
    "method": "file_exists",
    "relativePath": "TODO main file name"
  },
  "icon": "wrench",
  "requiresAppVersion": true,$APP_ID_LINE
  "TODO_NEXT_STEPS": "Replace every TODO above. Then delete this TODO_NEXT_STEPS field."
}
EOF

# --- per-machine config + hook ------------------------------------------------
mkdir -p "$DRIVE_PATH"
cat > .drive-sync.config <<EOF
# .drive-sync.config — per-machine, untracked.
DRIVE_PATH=$DRIVE_PATH
EOF
ln -sf ../../scripts/sync-to-drive.sh .git/hooks/post-commit
chmod +x scripts/sync-to-drive.sh

# --- write a starter README ---------------------------------------------------
cat > README.md <<EOF
# $REPO

$DESC

## Edit & deploy

\`\`\`bash
# 1. Edit code
# 2. Commit (auto-syncs to Drive on commit)
git add . && git commit -m "..."
git push   # backup to GHE
\`\`\`

Drive destination: \`Tools/$CAT_DIR/$DRIVE_NAME\` (on this machine, see \`.drive-sync.config\`).
EOF

# --- commit the bootstrap state -----------------------------------------------
git add .
git -c commit.gpgsign=false commit -m "Bootstrap from template" >/dev/null
git push -u origin main >/dev/null 2>&1

# --- open in Finder + GitHub Desktop ------------------------------------------
open .
if [ -d "/Applications/GitHub Desktop.app" ]; then
  open -a "GitHub Desktop" .
fi

# --- done ---------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Created $REPO"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Local repo:  ~/Documents/GitHub/$REPO"
echo "Drive:       Tools/$CAT_DIR/$DRIVE_NAME"
echo "GHE:         https://ghe.oculus-rep.com/edlivingstone/$REPO"
echo ""
echo "Next steps:"
echo "  1. Edit tool.manifest.json — replace every TODO field."
echo "  2. Drop your tool files (.jsx / .pyp / .pyz / etc.) into the repo."
echo "  3. Commit via GitHub Desktop → auto-syncs to Drive → manager sees it."
echo ""
read -p "Press Enter to close..." _
