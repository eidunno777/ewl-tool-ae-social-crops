#!/usr/bin/env bash
# sync-to-drive.sh
# Mirrors the current repo into a Google Drive destination defined in
# .drive-sync.config (per-machine, untracked).
#
# Invoked automatically by .git/hooks/post-commit (symlink installed by
# scripts/install-sync-hook.sh).
#
# Cross-platform: macOS (rsync) and Windows Git Bash (rsync if available,
# otherwise robocopy).
#
# IMPORTANT: This script must always exit 0. A post-commit hook should never
# block your Git workflow — the commit has already happened.

set -u

# --- Locate repo root ---------------------------------------------------------
# When run as a hook, $PWD is the repo root, but be defensive in case the user
# runs the script directly from elsewhere.
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" || { echo "drive-sync: cannot cd to repo root"; exit 0; }

CONFIG_FILE="$REPO_ROOT/.drive-sync.config"
IGNORE_FILE="$REPO_ROOT/.drive-sync-ignore"

# --- Read config --------------------------------------------------------------
if [ ! -f "$CONFIG_FILE" ]; then
  echo "drive-sync: .drive-sync.config not found."
  echo "drive-sync: run 'bash scripts/install-sync-hook.sh' to set it up."
  exit 0
fi

# Parse KEY=VALUE lines (and a bare path on a single non-KEY line for
# backwards compatibility).
DRIVE_PATH=""
DRY_RUN="false"
while IFS= read -r line || [ -n "$line" ]; do
  # Skip blank lines and comments.
  case "$line" in
    ''|\#*) continue ;;
  esac
  if [[ "$line" == *"="* ]]; then
    key="${line%%=*}"
    val="${line#*=}"
    # Trim surrounding whitespace and matching quotes.
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    case "$key" in
      DRIVE_PATH) DRIVE_PATH="$val" ;;
      DRY_RUN)    DRY_RUN="$val" ;;
    esac
  else
    # Bare line — treat as the drive path.
    [ -z "$DRIVE_PATH" ] && DRIVE_PATH="$line"
  fi
done < "$CONFIG_FILE"

if [ -z "$DRIVE_PATH" ]; then
  echo "drive-sync: DRIVE_PATH not set in .drive-sync.config"
  exit 0
fi

# Expand a leading ~ to $HOME (config files don't get shell expansion).
case "$DRIVE_PATH" in
  "~"*) DRIVE_PATH="${HOME}${DRIVE_PATH#\~}" ;;
esac

# --- Verify destination exists ------------------------------------------------
DEST_PARENT="$(dirname "$DRIVE_PATH")"
if [ ! -d "$DEST_PARENT" ]; then
  echo "drive-sync: destination parent does not exist: $DEST_PARENT"
  echo "drive-sync: check that Google Drive is mounted and the path is correct."
  exit 0
fi

mkdir -p "$DRIVE_PATH" 2>/dev/null || true

# --- Detect environment -------------------------------------------------------
UNAME_OUT="$(uname -s 2>/dev/null || echo Unknown)"
IS_WINDOWS="false"
case "$UNAME_OUT" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS="true" ;;
esac

REPO_NAME="$(basename "$REPO_ROOT")"
COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# --- Build exclude list -------------------------------------------------------
EXCLUDE_ARGS=()
if [ -f "$IGNORE_FILE" ]; then
  EXCLUDE_ARGS=(--exclude-from="$IGNORE_FILE")
fi

# --- Sync ---------------------------------------------------------------------
SYNC_OK="false"

if command -v rsync >/dev/null 2>&1; then
  RSYNC_FLAGS=(--archive --delete --delay-updates --prune-empty-dirs --human-readable)
  if [ "$DRY_RUN" = "true" ]; then
    RSYNC_FLAGS+=(--dry-run --verbose)
  fi
  # Trailing slash on source: copy *contents* of repo into DRIVE_PATH.
  if rsync "${RSYNC_FLAGS[@]}" "${EXCLUDE_ARGS[@]}" "$REPO_ROOT/" "$DRIVE_PATH/"; then
    SYNC_OK="true"
  fi
elif [ "$IS_WINDOWS" = "true" ] && command -v cmd >/dev/null 2>&1; then
  # robocopy fallback for Windows when rsync isn't installed.
  # Convert /c/Users/... or /Users/... style paths to Windows form using cygpath
  # if available, otherwise rely on robocopy accepting the path as-is.
  src_win="$REPO_ROOT"
  dst_win="$DRIVE_PATH"
  if command -v cygpath >/dev/null 2>&1; then
    src_win="$(cygpath -w "$REPO_ROOT")"
    dst_win="$(cygpath -w "$DRIVE_PATH")"
  fi

  # Build robocopy exclude args from .drive-sync-ignore.
  RC_XF=()  # files
  RC_XD=()  # dirs
  if [ -f "$IGNORE_FILE" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in ''|\#*) continue ;; esac
      pat="${line%/}"  # strip trailing slash
      if [[ "$line" == */ ]] || [[ "$pat" != *.* && "$pat" != *\** ]]; then
        RC_XD+=("$pat")
      else
        RC_XF+=("$pat")
      fi
    done < "$IGNORE_FILE"
  fi

  RC_ARGS=("$src_win" "$dst_win" "/MIR" "/NFL" "/NDL" "/NJH" "/NJS" "/NP" "/R:1" "/W:1")
  if [ ${#RC_XF[@]} -gt 0 ]; then
    RC_ARGS+=("/XF"); RC_ARGS+=("${RC_XF[@]}")
  fi
  if [ ${#RC_XD[@]} -gt 0 ]; then
    RC_ARGS+=("/XD"); RC_ARGS+=("${RC_XD[@]}")
  fi
  if [ "$DRY_RUN" = "true" ]; then
    RC_ARGS+=("/L")
  fi

  # robocopy exit codes 0–7 are success-ish; 8+ are real errors.
  cmd //c robocopy "${RC_ARGS[@]}"
  rc=$?
  if [ $rc -lt 8 ]; then
    SYNC_OK="true"
  fi
else
  echo "drive-sync: neither rsync nor robocopy is available."
  echo "drive-sync: install rsync (macOS: preinstalled; Windows MSYS: 'pacman -S rsync')."
  exit 0
fi

# --- Report -------------------------------------------------------------------
if [ "$SYNC_OK" = "true" ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo "✅ [DRY RUN] $REPO_NAME → $DRIVE_PATH at $COMMIT_SHA"
  else
    echo "✅ Synced $REPO_NAME → $DRIVE_PATH at $COMMIT_SHA"
  fi
else
  echo "⚠️  drive-sync: mirror reported errors (commit was not affected)."
fi

exit 0
