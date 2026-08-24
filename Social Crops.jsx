/**
 * Social Crops.jsx
 * After Effects ScriptUI Panel — v1.0
 *
 * FEATURES
 *   1. Guide Layers  — drop reference images (UI overlays + safe-zone crop
 *      guides) for LinkedIn, Instagram Feed, Instagram Reels, TikTok, All
 *      Platforms, and four generic aspect-ratio guides (1:1, 9:16, 16:9, 4:5).
 *      Guides are set as AE Guide Layers so they never render when you export,
 *      and are automatically excluded when the comp is nested anywhere.
 *
 *   2. Create Comps  — wraps the active comp in new parent comps at your chosen
 *      aspect ratios.  Each wrapper contains only the original comp as a single
 *      pre-comp layer, which keeps one source of truth: edit the original and
 *      every sized variant updates automatically.
 *
 * INSTALL
 *   Copy the entire "Social Crops" folder (this file + lib/ + images/) to:
 *     Windows : C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
 *     macOS   : /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
 *
 *   Restart After Effects, then open via  Window > Social Crops.jsx
 *   (or find it under  Window  if AE picked it up as a dockable panel).
 *
 * DEPENDENCIES
 *   All bundled — no external installs required.
 *   To regenerate the guide images:  pip install pillow && python scripts/generate-guide-assets.py
 */

// ---------------------------------------------------------------------------
// Wrap everything in an IIFE that receives `this` so the script works both
// as a standalone Window (File > Scripts) and as a dockable Panel
// (Scripts/ScriptUI Panels/).
// ---------------------------------------------------------------------------
(function buildSocialCrops(thisObj) {

    // Resolve the folder containing this script.  $.fileName is reliable when
    // the script is run from a saved file (the normal use case).
    var MAIN_FILE = $.fileName;

    if (!MAIN_FILE) {
        // Running from ExtendScript Toolkit or eval() — tell the user.
        alert(
            "Social Crops: Cannot locate the script file path.\n\n" +
            "Please run Social Crops.jsx from After Effects via\n" +
            "File \u203a Scripts \u203a Run Script File\u2026\n" +
            "or install it into the ScriptUI Panels folder."
        );
        return;
    }

    // #include is a preprocessor directive — resolved relative to this file
    #include "lib/sc-core.jsx"
    #include "lib/sc-ui.jsx"

    // Pass the images folder path to the core module
    SC_Core.initPaths(MAIN_FILE);

    // Build and show the panel
    var panel = SC_UI.buildPanel(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
