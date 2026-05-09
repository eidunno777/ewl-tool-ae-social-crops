# Drive Tool Sync — Git post-commit → Google Drive

A reusable, cross-platform Git `post-commit` hook that mirrors a tool repo
into a Google Drive folder on every commit. Use it to keep your local Git
work and the `VR-Art-Tools` manager's Drive scan folder always in sync.

Works on **macOS** and **Windows (Git Bash)**.

---

## What's in this template

```
.drive-sync-ignore         # tracked  — rsync-style exclusions
.gitattributes             # tracked  — forces LF endings on .sh files
.gitignore                 # tracked  — ignores .drive-sync.config
scripts/sync-to-drive.sh   # tracked  — the actual sync logic
scripts/install-sync-hook.sh # tracked — one-time per-machine installer
.drive-sync.config         # UNTRACKED — created by installer, per-machine
```

After running the installer in a repo:

```
.git/hooks/post-commit     # symlink → ../../scripts/sync-to-drive.sh
```

---

## Install in a new repo

1. Copy these four tracked files into your tool repo:
   - `scripts/sync-to-drive.sh`
   - `scripts/install-sync-hook.sh`
   - `.drive-sync-ignore`
   - `.gitattributes` (merge into existing if present)
   - Add `.drive-sync.config` to `.gitignore`
2. From the repo root, run:

   ```bash
   bash scripts/install-sync-hook.sh
   ```

3. When prompted, paste the absolute Drive path for **this tool on this
   machine**, e.g.:
   - macOS: `/Users/<you>/Library/CloudStorage/GoogleDrive-<you>@meta.com/My Drive/VR Art Tools/AE Scripts/MyTool`
   - Windows: `G:/My Drive/VR Art Tools/AE Scripts/MyTool`
4. Done. Every `git commit` from now on syncs to Drive.

---

## Verify it works

```bash
git commit --allow-empty -m "test drive sync"
```

Expected line in your terminal:

```
✅ Synced <repo-name> → <drive-path> at <sha>
```

Then open the destination folder in Finder/Explorer — files should be
present and current. Delete a file, commit, and confirm it disappears
from Drive (the `--delete` flag is at work).

---

## Bypass the hook (one-off)

`post-commit` does not honor `--no-verify`. To skip a single commit:

```bash
mv .git/hooks/post-commit .git/hooks/post-commit.off
git commit -m "skipping sync this once"
mv .git/hooks/post-commit.off .git/hooks/post-commit
```

Or temporarily set `DRY_RUN=true` in `.drive-sync.config`.

---

## Cross-platform notes

| Concern        | macOS                                    | Windows (Git Bash)                               |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| `rsync`        | Preinstalled                             | Not bundled — script falls back to `robocopy`    |
| Symlinks       | Native                                   | Installer copies the script if symlinks blocked  |
| Drive root     | `~/Library/CloudStorage/GoogleDrive-…/`  | `G:/My Drive/` or `C:/Users/<user>/My Drive/`    |
| Line endings   | LF                                       | `.gitattributes` forces LF on `*.sh`             |

For identical behavior on both OSes, install rsync on Windows MSYS:

```bash
pacman -S rsync
```

---

## Failure modes (by design, none of these block your commit)

- **Missing config**: prints "run installer" message, exits 0.
- **Drive not mounted**: prints "destination parent does not exist", exits 0.
- **Invalid path / partial sync**: prints a warning with the rsync/robocopy
  return code, exits 0.

The commit always succeeds. Sync is best-effort.

---

## Optional knobs in `.drive-sync.config`

```ini
DRIVE_PATH=/absolute/path/in/google/drive
DRY_RUN=true     # preview without copying (rsync --dry-run, robocopy /L)
```
