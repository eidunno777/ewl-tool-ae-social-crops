#!/usr/bin/env bash
# install-sync-hook.sh
# One-time per-machine setup for the post-commit Drive sync.
#
# Run from the repo root:
#     bash scripts/install-sync-hook.sh
#
# What it does:
#   1. Symlinks .git/hooks/post-commit -> ../../scripts/sync-to-drive.sh
#      (falls back to a copy on systems without symlink support).
#   2. Makes scripts/sync-to-drive.sh executable.
#   3. Prompts for the absolute Google Drive destination path if
#      .drive-sync.config doesn't exist, then writes it.
#   4. Ensures .drive-sync.config and .drive-sync-ignore (optional) entries
#      are in .gitignore.
#   5. Prints a verification hint.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

SCRIPT_REL="scripts/sync-to-drive.sh"
SCRIPT_ABS="$REPO_ROOT/$SCRIPT_REL"
HOOK_PATH="$REPO_ROOT/.git/hooks/post-commit"
CONFIG_FILE="$REPO_ROOT/.drive-sync.config"
GITIGNORE="$REPO_ROOT/.gitignore"

# --- Sanity checks ------------------------------------------------------------
if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "install-sync-hook: not inside a Git repo (no .git directory at $REPO_ROOT)"
  exit 1
fi

if [ ! -f "$SCRIPT_ABS" ]; then
  echo "install-sync-hook: $SCRIPT_REL not found in repo."
  exit 1
fi

chmod +x "$SCRIPT_ABS" 2>/dev/null || true
mkdir -p "$REPO_ROOT/.git/hooks"

# --- Install the hook ---------------------------------------------------------
# Prefer a symlink so editing the script in the repo updates the hook live.
# Fall back to a copy on Windows where symlinks may not be permitted.
if [ -e "$HOOK_PATH" ] || [ -L "$HOOK_PATH" ]; then
  echo "install-sync-hook: existing post-commit hook found at $HOOK_PATH"
  printf "Overwrite? [y/N] "
  read -r reply
  case "$reply" in
    y|Y|yes|YES) rm -f "$HOOK_PATH" ;;
    *) echo "Aborting hook install (config step will still run)." ; SKIP_HOOK=1 ;;
  esac
fi

if [ -z "${SKIP_HOOK:-}" ]; then
  if ln -s "../../$SCRIPT_REL" "$HOOK_PATH" 2>/dev/null; then
    echo "✓ Symlinked post-commit hook -> $SCRIPT_REL"
  else
    cp "$SCRIPT_ABS" "$HOOK_PATH"
    chmod +x "$HOOK_PATH"
    echo "✓ Copied post-commit hook (symlinks unavailable on this system)"
    echo "  Note: re-run this installer if you edit $SCRIPT_REL."
  fi
fi

# --- Prompt for config --------------------------------------------------------
if [ -f "$CONFIG_FILE" ]; then
  echo "✓ .drive-sync.config already exists — leaving it alone."
else
  UNAME_OUT="$(uname -s 2>/dev/null || echo Unknown)"
  case "$UNAME_OUT" in
    Darwin*)
      SUGGEST="$HOME/Library/CloudStorage/GoogleDrive-<account>/My Drive/VR Art Tools/<ToolName>"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      SUGGEST="G:/My Drive/VR Art Tools/<ToolName>"
      ;;
    *)
      SUGGEST="/absolute/path/to/your/Google Drive/<ToolName>"
      ;;
  esac

  echo ""
  echo "Enter the absolute Google Drive destination path for THIS repo on THIS machine."
  echo "Suggested format:"
  echo "  $SUGGEST"
  echo ""
  printf "Drive path: "
  read -r DRIVE_INPUT

  if [ -z "$DRIVE_INPUT" ]; then
    echo "install-sync-hook: empty path; skipping config write."
    echo "  Create $CONFIG_FILE manually with a single line:"
    echo "    DRIVE_PATH=/your/path/here"
  else
    {
      echo "# .drive-sync.config — per-machine, untracked."
      echo "# Used by scripts/sync-to-drive.sh (post-commit hook)."
      echo "DRIVE_PATH=$DRIVE_INPUT"
      echo "# Optional: DRY_RUN=true to preview without copying."
    } > "$CONFIG_FILE"
    echo "✓ Wrote $CONFIG_FILE"
  fi
fi

# --- Update .gitignore --------------------------------------------------------
touch "$GITIGNORE"
add_ignore() {
  local pattern="$1"
  if ! grep -Fxq "$pattern" "$GITIGNORE"; then
    echo "$pattern" >> "$GITIGNORE"
    echo "✓ Added '$pattern' to .gitignore"
  fi
}
add_ignore ".drive-sync.config"

# --- Done ---------------------------------------------------------------------
echo ""
echo "Done. Test it with:"
echo "    git commit --allow-empty -m \"test drive sync\""
echo ""
echo "Expected output:  ✅ Synced <repo-name> → <drive-path> at <sha>"
