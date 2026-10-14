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
# Some install paths (EWL Tools Manager's jsx_script installer, older builds)
# can only copy files flat into that root — no subfolders. So the built/
# distributed script expects images flattened alongside it, each prefixed
# with "sc-" to avoid colliding with other tools' assets.
merged = merged.replace(
    '_imgFolder = new Folder(root.fsName + "/images");       // dev/source layout: sibling images/ folder',
    '_imgFolder = new Folder(root.fsName);                   // installed layout: flat, alongside script'
)
merged = merged.replace(
    'return _imgFolder.fsName + "/" + filename;   // dev/source layout: unprefixed filename',
    'return _imgFolder.fsName + "/sc-" + filename;   // installed layout: "sc-" prefixed, flat'
)

out = os.path.join(ROOT, "Social Crops.built.jsx")
with open(out, "w", encoding="utf-8") as f:
    f.write(merged)

print(f"Built: Social Crops.built.jsx  ({len(merged):,} chars)")
