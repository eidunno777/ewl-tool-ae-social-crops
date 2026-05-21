# ewl-tool-template

Starter for new **EWL Tools** — the per-tool repos that the [EWL Tools Manager](https://github.com/eidunno777/ewl-tools) discovers and installs.

Every new tool starts from this template. It ships a Git `post-commit` hook
that mirrors the repo to a Google Drive folder on every commit, so the
manager picks the tool up automatically. GitHub (private) is the source of
truth and backup; Drive is the distribution channel.

> **Source of truth:** local Git repo + GitHub (private)
> **Distribution:** auto-mirrored to Google Drive on every commit
> **Discovery:** EWL Tools Manager walks `G:/My Drive/Tools/EWL-Tools-Manager/`
> looking for `tool.manifest.json` files

---

## Create a new tool from this template

### 1. Make a new private repo from this template

On GitHub: open this repo, click **Use this template → Create a new repository**.

- **Owner:** `eidunno777`
- **Name:** `ewl-tool-<kebab-name>` (e.g. `ewl-tool-color-grader`)
- **Visibility:** Private

### 2. Clone it locally

```bash
cd W:/Projects/GitHub        # or wherever you keep repos
gh repo clone eidunno777/ewl-tool-<name>
cd ewl-tool-<name>
```

### 3. Wire up the Drive sync hook (one-time per machine)

```bash
bash scripts/install-sync-hook.sh
```

When it prompts for the Drive path, paste the absolute path that this
tool should live at on Drive. Convention:

```
G:/My Drive/Tools/EWL-Tools-Manager/<Category>/<ToolName>
```

`<Category>` ∈ `Ae`, `C4D`, `Figma`, `OS`. The installer creates the
folder if it doesn't exist.

### 4. Fill in the manifest

Open `tool.manifest.json` and replace every `TODO` value. The `//-…`
hint lines are inline comments — delete them once you're done.

The `id` field must be globally unique across all EWL tools — the
manager dedupes by it.

### 5. Drop your tool's actual source files in

`.jsx`, `.aex`, `.pyp`, plugin source, NSIS installer output, whatever
the tool needs. The manager reads the manifest's `fileName` /
`installDetection.relativePath` to figure out what to copy where.

### 6. Commit

```bash
git add .
git commit -m "Initial tool setup"
git push
```

The post-commit hook fires automatically and mirrors the repo into Drive.
Expected last line:

```
✅ Synced ewl-tool-<name> → G:/My Drive/Tools/EWL-Tools-Manager/<Cat>/<Name> at <sha>
```

### 7. Wire the tool into the manager's catalog

Edit `W:/Projects/GitHub/ewl-tools/catalog.json` and add a new entry
pointing at the same `id` you used in the manifest. Then restart the
manager to verify it picks the tool up.

> **Do not run `npm run build-catalog`** in `ewl-tools/`. It regenerates
> `catalog.json` from manifests but drops the `toolsBasePath` block that
> the renderer needs. Hand-edit `catalog.json` instead.

---

## What's in this template

```
scripts/sync-to-drive.sh         # the actual sync logic (rsync on Mac/Linux, robocopy on Windows)
scripts/install-sync-hook.sh     # one-time per-machine installer
.drive-sync-ignore               # tracked exclusion patterns (.git, node_modules, etc.)
.drive-sync.config               # UNTRACKED — per-machine Drive path (created by installer)
.gitattributes                   # forces LF endings on .sh files and .drive-sync-ignore
.gitignore                       # ignores .drive-sync.config and OS junk
tool.manifest.json               # placeholder — replace every TODO field
README.md                        # this file
```

After running the installer, the post-commit hook lives at:

```
.git/hooks/post-commit           # symlink → ../../scripts/sync-to-drive.sh (Mac/Linux)
                                 # OR a file copy (Windows without dev-mode symlinks)
```

---

## Drive sync behavior

- **Always exits 0.** A failed mirror never blocks a commit.
- **Cross-platform:** rsync if available, otherwise robocopy on Windows.
- **`.drive-sync-ignore`** uses rsync-style glob patterns. The robocopy
  fallback skips patterns it can't translate (negations, `**` globs,
  `path/glob` forms) and uses the simple-name fallbacks. Trailing slash
  means "directory only".
- **`.drive-sync.config`** is per-machine and gitignored, so Mac vs
  Windows can point at different Drive mount paths.

### Daily workflow once set up

```bash
# edit code…
git add . && git commit -m "..."   # auto-syncs to Drive
git push                            # backup to GitHub
```

### Bypass the hook for a single commit

`post-commit` doesn't honor `--no-verify`. To skip one commit:

```bash
mv .git/hooks/post-commit .git/hooks/post-commit.off
git commit -m "skipping sync this once"
mv .git/hooks/post-commit.off .git/hooks/post-commit
```

Or set `DRY_RUN=true` in `.drive-sync.config` to preview without copying.

### Second machine

```bash
gh repo clone eidunno777/ewl-tool-<name>
cd ewl-tool-<name>
bash scripts/install-sync-hook.sh   # writes a machine-local Drive path
```

`.drive-sync.config` is per-machine (gitignored), so Mac and Windows can
have different paths to their respective Google Drive mounts.

---

## Cross-platform notes

| Concern        | macOS                                      | Windows (Git Bash)                                  |
| -------------- | ------------------------------------------ | --------------------------------------------------- |
| `rsync`        | Preinstalled                               | Not bundled — script falls back to `robocopy`       |
| Symlinks       | Native                                     | Installer copies the script if symlinks blocked     |
| Drive root     | `~/Library/CloudStorage/GoogleDrive-…/`    | `G:/My Drive/Tools/EWL-Tools-Manager/`              |
| Line endings   | LF                                         | `.gitattributes` forces LF on `*.sh`                |

For identical behavior on Windows, install rsync via MSYS2: `pacman -S rsync`.

---

## Failure modes (none of these block your commit)

- **Missing config**: prints "run installer", exits 0
- **Drive not mounted**: prints "could not create $DRIVE_PATH", exits 0
- **Invalid path / partial sync**: prints a warning, exits 0

The commit always succeeds. Sync is best-effort.
