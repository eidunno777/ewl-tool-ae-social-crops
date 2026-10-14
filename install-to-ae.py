"""
install-to-ae.py
Stage files and trigger UAC-elevated install into every detected AE version's
ScriptUI Panels folder (Windows: C:\\Program Files\\Adobe\\Adobe After Effects */Support Files/Scripts/ScriptUI Panels).

Usage (from repo root):
    python scripts/build-merged.py
    python install-to-ae.py
"""
import glob, os, shutil, subprocess, sys

REPO     = os.path.dirname(os.path.abspath(__file__))
BUILT    = os.path.join(REPO, "Social Crops.built.jsx")
IMAGES   = os.path.join(REPO, "images")
STAGE    = r"C:\Temp\SocialCropsInstall"
ADMIN    = r"C:\Temp\sc-install-admin.ps1"
LOG_PATH = r"C:\Temp\sc-install.log"

if not os.path.exists(BUILT):
    sys.exit("ERROR: Social Crops.built.jsx not found. Run: python scripts/build-merged.py first.")

# Discover every installed AE version's ScriptUI Panels folder.
ae_panels_dirs = [
    os.path.join(p, "Support Files", "Scripts", "ScriptUI Panels")
    for p in glob.glob(r"C:\Program Files\Adobe\Adobe After Effects*")
]
ae_panels_dirs = [d for d in ae_panels_dirs if os.path.isdir(d)]

if not ae_panels_dirs:
    sys.exit("ERROR: No installed After Effects versions found under C:\\Program Files\\Adobe\\.")

print("Found AE installs:")
for d in ae_panels_dirs:
    print(f"  {d}")

# Stage files — flat layout: built script + "sc-"-prefixed images side by
# side in the same folder. (Social Crops.built.jsx expects images next to
# it, prefixed, to match what the EWL Tools Manager's installer can copy —
# see scripts/build-merged.py.)
if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(STAGE)
shutil.copy2(BUILT, os.path.join(STAGE, "Social Crops.jsx"))
for f in os.listdir(IMAGES):
    if f.lower().endswith(".png"):
        shutil.copy2(os.path.join(IMAGES, f), os.path.join(STAGE, "sc-" + f))

panels_ps_list = ",".join("'" + d.replace("'", "''") + "'" for d in ae_panels_dirs)

ADMIN_SCRIPT = f"""
$panelsDirs = @({panels_ps_list})
$stage      = '{STAGE}'
$log        = '{LOG_PATH}'
try {{
    foreach ($panels in $panelsDirs) {{
        # Clean up any stale legacy install (old subfoldered layout, or a
        # raw un-merged single-file install from an older tool-manager build).
        if (Test-Path "$panels\\Social Crops")     {{ Remove-Item "$panels\\Social Crops"     -Recurse -Force }}
        if (Test-Path "$panels\\Social Crops.jsx") {{ Remove-Item "$panels\\Social Crops.jsx" -Force }}
        Get-ChildItem "$stage" -File | ForEach-Object {{
            Copy-Item $_.FullName (Join-Path $panels $_.Name) -Force
        }}
    }}
    "SUCCESS" | Out-File $log -Encoding UTF8
}} catch {{
    "ERROR: $_" | Out-File $log -Encoding UTF8
}}
"""
with open(ADMIN, "w", encoding="utf-8") as f:
    f.write(ADMIN_SCRIPT)

print(f"Staged to {STAGE} - requesting admin to install...")

# Elevate via PowerShell Start-Process -Verb RunAs
ps_cmd = (
    "Start-Process powershell "
    "-Verb RunAs "
    "-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','" + ADMIN + "' "
    "-Wait"
)
subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True)

if os.path.exists(LOG_PATH):
    result = open(LOG_PATH, encoding="utf-8").read().strip()
    if "SUCCESS" in result:
        print("Done. Restart After Effects, then open Window > Social Crops.jsx")
    else:
        print("Install may have failed:", result)
else:
    print("No log found - install may have been cancelled.")
