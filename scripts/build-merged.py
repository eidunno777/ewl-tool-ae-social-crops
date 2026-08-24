#!/usr/bin/env python3
"""
build-merged.py
Merges sc-core.jsx + sc-ui.jsx into a single Social Crops.built.jsx
that can be dropped directly into AE's ScriptUI Panels folder.

Images are expected at:
  <ScriptUI Panels>/Social Crops/images/*.png
"""
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))

with open(os.path.join(ROOT, "lib", "sc-core.jsx"), encoding="utf-8") as f:
    core = f.read()

with open(os.path.join(ROOT, "lib", "sc-ui.jsx"), encoding="utf-8") as f:
    ui = f.read()

with open(os.path.join(ROOT, "Social Crops.jsx"), encoding="utf-8") as f:
    main = f.read()

# Inline the #include directives
merged = main.replace('#include "lib/sc-core.jsx"', core)
merged = merged.replace('#include "lib/sc-ui.jsx"', ui)

# The merged file lives at ScriptUI Panels root ($.fileName.parent = ScriptUI Panels/).
# Images live in a named subfolder: ScriptUI Panels/Social Crops/images/
merged = merged.replace(
    '_imgFolder = new Folder(root.fsName + "/images");',
    '_imgFolder = new Folder(root.fsName + "/Social Crops/images");'
)

out = os.path.join(ROOT, "Social Crops.built.jsx")
with open(out, "w", encoding="utf-8") as f:
    f.write(merged)

print(f"Built: Social Crops.built.jsx  ({len(merged):,} chars)")
