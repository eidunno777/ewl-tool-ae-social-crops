"""
install-to-ae.py
Stage files and trigger UAC-elevated install into AE 2025 ScriptUI Panels.

Usage (from repo root):
    python scripts/build-merged.py
    python install-to-ae.py
"""
import os, shutil, subprocess, sys

REPO   = os.path.dirname(os.path.abspath(__file__))
BUILT  = os.path.join(REPO, "Social Crops.built.jsx")
IMAGES = os.path.join(REPO, "images")
STAGE  = r"C:\Temp\SocialCropsInstall"
ADMIN  = r"C:\Temp\sc-install-admin.ps1"

if not os.path.exists(BUILT):
    sys.exit("ERROR: Social Crops.built.jsx not found. Run: python scripts/build-merged.py first.")

# Stage files
if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "images"))
shutil.copy2(BUILT, os.path.join(STAGE, "Social Crops.jsx"))
for f in os.listdir(IMAGES):
    if f.lower().endswith(".png"):
        shutil.copy2(os.path.join(IMAGES, f), os.path.join(STAGE, "images", f))

print(f"Staged to {STAGE} - requesting admin to install...")

# Elevate via PowerShell Start-Process -Verb RunAs
ps_cmd = (
    "Start-Process powershell "
    "-Verb RunAs "
    "-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','" + ADMIN + "' "
    "-Wait"
)
subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True)

log_path = r"C:\Temp\sc-install.log"
if os.path.exists(log_path):
    result = open(log_path, encoding="utf-8").read().strip()
    if "SUCCESS" in result:
        print("Done. Restart After Effects, then open Window > Social Crops.jsx")
    else:
        print("Install may have failed:", result)
else:
    print("No log found - install may have been cancelled.")
