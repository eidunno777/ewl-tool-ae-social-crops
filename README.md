# VR Art Tool Template

The starter for new VR Art tools. Provides a git `post-commit` hook
that automatically mirrors the repo into the right Google Drive
folder so the **VR-Art-Tools manager app** picks it up.

> **Source of truth:** local Git repo
> **Distribution:** auto-mirrored to Google Drive on every commit
> **Backup:** GHE remote

---

## 🚀 Create a new tool (the easy way)

**Double-click [`new-tool.command`](./new-tool.command).**

It will:

1. Ask for a tool name, description, and category
2. Create a private GHE repo from this template
3. Clone it into `~/Documents/GitHub/vr-tool-<name>`
4. Wire up the post-commit Drive sync hook
5. Open the repo in Finder + GitHub Desktop

Then:

1. **Edit `tool.manifest.json`** — replace every `TODO` field
2. **Drop your tool files** in (`.jsx`, `.pyp`, `.pyz`, etc.)
3. **Commit via GitHub Desktop** → auto-syncs to Drive → manager sees it
4. **Push** in GitHub Desktop to back it up to GHE

That's it.

---

## 🧰 Create a new tool (manual / GitHub Desktop only)

If you don't have/want `gh` CLI, the all-Desktop flow:

1. **Browser**: open this template's GHE page → click **Use this template**
   → **Create a new repository** → name it `vr-tool-<name>`, private.
2. **GitHub Desktop**: `File → Clone repository` → pick your new repo,
   clone to `~/Documents/GitHub/`.
3. **Repository menu → Open in Terminal**, then run:
   ```bash
   bash scripts/install-sync-hook.sh
   ```
   Paste the absolute Drive path when prompted.
4. Edit `tool.manifest.json`, drop in your files, commit via GitHub Desktop.

---

## 🔁 Daily workflow (existing tool)

```bash
cd ~/Documents/GitHub/vr-tool-<name>
# edit code…
git add . && git commit -m "..."
# → ✅ auto-syncs to Drive → manager picks up update
git push   # backup
```

Or just do all that in GitHub Desktop. The post-commit hook fires
either way.

---

## 🖥️ Using the same tool on a second machine

```bash
cd ~/Documents/GitHub
gh repo clone edlivingstone/vr-tool-<name>
cd vr-tool-<name>
bash scripts/install-sync-hook.sh   # writes machine-local Drive path
```

`.drive-sync.config` is per-machine (gitignored) so Mac vs Windows can
have different paths to their respective Google Drive mounts.

---

## 🪟 Cross-platform notes

| Concern        | macOS                                    | Windows (Git Bash)                               |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| `rsync`        | Preinstalled                             | Not bundled — script falls back to `robocopy`    |
| Symlinks       | Native                                   | Installer copies the script if symlinks blocked  |
| Drive root     | `~/Library/CloudStorage/GoogleDrive-…/`  | `G:/My Drive/` or `C:/Users/<user>/My Drive/`    |
| Line endings   | LF                                       | `.gitattributes` forces LF on `*.sh`             |

For identical behavior on Windows, install rsync via MSYS2:
```bash
pacman -S rsync
```

---

## 🛟 Bypass the hook (one-off)

`post-commit` doesn't honor `--no-verify`. To skip a single commit:

```bash
mv .git/hooks/post-commit .git/hooks/post-commit.off
git commit -m "skipping sync this once"
mv .git/hooks/post-commit.off .git/hooks/post-commit
```

Or set `DRY_RUN=true` in `.drive-sync.config` to preview without copying.

---

## 🩺 Failure modes (none of these block your commit)

- **Missing config**: prints "run installer" message, exits 0
- **Drive not mounted**: prints "destination parent does not exist", exits 0
- **Invalid path / partial sync**: prints a warning, exits 0

The commit always succeeds. Sync is best-effort.

---

## 📁 What's in this template

```
new-tool.command           # double-click bootstrap (this file is removed from new tools)
scripts/sync-to-drive.sh   # the actual sync logic (Mac + Windows)
scripts/install-sync-hook.sh # interactive one-time installer
.drive-sync-ignore         # rsync exclusion patterns
.drive-sync.config         # UNTRACKED — per-machine Drive path (created by installer)
.gitattributes             # forces LF endings on .sh files
.gitignore                 # ignores .drive-sync.config
tool.manifest.json         # placeholder — edit for each tool
CONFIGURE-NEW-TOOL.md      # detailed manual setup steps (also removed from new tools)
```

After running the installer in any tool repo:

```
.git/hooks/post-commit     # symlink → ../../scripts/sync-to-drive.sh
```
