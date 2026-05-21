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
  # Strip a trailing CR so CRLF-encoded configs (the default on Windows
  # when written from PowerShell / VSCode) don't sneak a literal \r into
  # values, which turns "Motion-Lab" into "Motion-Lab<U+F00D>" on disk.
  line="${line%$'\r'}"
  if [[ "$line" == *"="* ]]; then
    key="${line%%=*}"
    val="${line#*=}"
    # Trim surrounding whitespace and matching quotes.
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    val="${val%$'\r'}"
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
# We try to create the full DRIVE_PATH up front (this is also where the
# share-root parents like .../Tools/EWL-Tools-Manager/Ae/ get bootstrapped
# on a fresh Drive). If mkdir fails AND the parent doesn't exist, we
# assume the Drive isn't mounted and bail (always exit 0 — never block
# the commit).
mkdir -p "$DRIVE_PATH" 2>/dev/null
if [ ! -d "$DRIVE_PATH" ]; then
  DEST_PARENT="$(dirname "$DRIVE_PATH")"
  echo "drive-sync: could not create $DRIVE_PATH"
  echo "drive-sync: parent=$DEST_PARENT — check that Google Drive is mounted and the path is correct."
  exit 0
fi

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
      # Strip trailing CR (CRLF-encoded ignore files would otherwise
      # smuggle \r into pattern names).
      line="${line%$'\r'}"
      case "$line" in
        ''|\#*) continue ;;
        # robocopy /XF /XD only understand simple name patterns. Skip
        # rsync-only forms so /XF and /XD don't error out with
        # "Invalid Parameter #NN":
        #   - negations (!foo)              — rsync include rules
        #   - any pattern containing **     — recursive globs
        #   - any path-glob ("foo/*", "a/b/*.json") — robocopy treats
        #     these as malformed args. The directory-name counterpart
        #     (e.g. "projects") is enough because robocopy /XD matches
        #     every directory level by name anyway.
        '!'*) continue ;;
        *'**'*) continue ;;
        */*\**) continue ;;
        */*\?*) continue ;;
      esac
      pat="${line%/}"  # strip trailing slash
      # Classify as directory if:
      #   - line ends with "/"                         (explicit dir)
      #   - pattern has no extension and no wildcard   (e.g. node_modules, .git)
      # The dotted-name case (".git", ".cursor", ".github") must also go to
      # /XD — otherwise robocopy will treat them as files and never exclude
      # the directories, leaking .git/ etc. onto Drive.
      if [[ "$line" == */ ]] \
         || [[ "$pat" != *.* && "$pat" != *\** ]] \
         || [[ "$pat" == .* && "$pat" != *\** ]]; then
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
  # MSYS_NO_PATHCONV=1 stops Git Bash from rewriting /MIR, /XF, /XD, etc.
  # into "C:/Program Files/Git/MIR" before they reach robocopy.
  # IMPORTANT: do NOT wrap with `cmd //c`. The cmd-shell re-parse of args
  # containing spaces (e.g. "G:\My Drive\...") silently drops args and
  # robocopy ends up running with no work to do. Calling robocopy.exe
  # directly works fine — it's already a Windows binary on PATH.
  MSYS_NO_PATHCONV=1 robocopy "${RC_ARGS[@]}" >/dev/null
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
