# install-to-ae.ps1 — convenience wrapper; delegates to the Python installer
# Usage (from repo root, any PowerShell):
#   python scripts/build-merged.py
#   .\install-to-ae.ps1
python (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'install-to-ae.py')
