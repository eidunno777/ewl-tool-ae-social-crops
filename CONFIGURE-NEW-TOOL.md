# Configure a New Tool from This Template

This repo is the starter for a new VR Art tool. Once you've created a
new repo from it (`gh repo create vr-tool-X --template …`), do these
steps **once per machine**.

---

## 1. Rename the GitHub repo to match the tool

Convention: `vr-tool-<kebab-case-name>`. For example:
`vr-tool-squirclizer`, `vr-tool-motion-manager`.

## 2. Edit `tool.manifest.json`

Open it and replace every `TODO` value. The `//-…` comment lines are
inline hints for what each field accepts — delete them when you're done.

The `id` field (kebab-case) **must be globally unique** across all VR
Art tools — the manager dedupes by it.

## 3. Decide where this tool lives in Drive

Pick a slot under `Shared drives/HzOS_Active Workstreams/Global_Assets/Tools/`.
Examples:
- `Ae/MyToolName/` for After Effects tools
- `C4D/MyToolName/` for Cinema 4D plugins
- `Figma/MyToolName/` for Figma plugins
- `OS/MyToolName/` for OS-level utilities

## 4. Run the installer

From the repo root:

```bash
bash scripts/install-sync-hook.sh
```

When prompted, paste the absolute Drive path:

```
/Users/<you>/Library/CloudStorage/GoogleDrive-<you>@meta.com/Shared drives/HzOS_Active Workstreams/Global_Assets/Tools/<Category>/<ToolName>
```

This installs the post-commit Drive sync hook and writes a per-machine
config file (`.drive-sync.config`, gitignored).

## 5. Add your tool's actual files

Drop your `.jsx`, `.aex`, `.pyp`, plugin source, etc. into the repo at
whatever folder structure makes sense. The `tool.manifest.json` `files`
field maps source paths → install destination names if needed.

## 6. Commit

```bash
git add .
git commit -m "Initial tool setup"
```

The hook fires automatically and mirrors the repo into Drive. Confirm
with the success line in the terminal:

```
✅ Synced vr-tool-X → /…/Shared drives/…/Tools/…/X at <sha>
```

## 7. Verify the manager sees it

Open the VR Art Tools manager → refresh catalog. Your tool should
appear under the right category. Install it on a test machine to
confirm end-to-end.

---

## Re-running on another machine

Same steps 4–6. Each developer machine has its own `.drive-sync.config`
because Drive's local mount path is different on each machine.

## Removing the hook

```bash
rm .git/hooks/post-commit
```

Or temporarily move it:

```bash
mv .git/hooks/post-commit .git/hooks/post-commit.off
```
