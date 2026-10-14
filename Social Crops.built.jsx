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
    /**
 * sc-core.jsx — Social Crops core logic
 * Loaded via #include from Social Crops.jsx
 *
 * Exposes a single global namespace: SC_Core
 */

var SC_Core = (function () {

    // ── Paths ──────────────────────────────────────────────────────────────────

    /** Absolute path to the images/ folder, resolved relative to the
     *  main .jsx file so it works regardless of install location. */
    var _imgFolder = null;

    function initPaths(mainFilePath) {
        var root = File(mainFilePath).parent;
        _imgFolder = new Folder(root.fsName + "/Social Crops/images");
    }

    function imgPath(filename) {
        if (!_imgFolder) {
            alert("Social Crops: image folder not initialised.");
            return null;
        }
        return _imgFolder.fsName + "/" + filename;
    }


    // ── Project helpers ────────────────────────────────────────────────────────

    function getActiveComp() {
        if (!app.project) {
            alert("Social Crops: No project is open.");
            return null;
        }
        var item = app.project.activeItem;
        if (!(item instanceof CompItem)) {
            alert("Social Crops: Please click on a composition to make it active.");
            return null;
        }
        return item;
    }

    /**
     * Return an existing FootageItem for the given file path if already
     * imported, otherwise import it fresh.  Prevents duplicate project items
     * when the user clicks the same guide button multiple times.
     */
    function findOrImportFootage(path) {
        var f = new File(path);
        if (!f.exists) {
            alert("Social Crops: Guide image not found.\n\n" + path +
                  "\n\nRe-run scripts/generate-guide-assets.py to regenerate missing assets.");
            return null;
        }
        var fsn = f.fsName;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.items[i];
            if ((item instanceof FootageItem) &&
                (item.mainSource instanceof FileSource) &&
                (item.mainSource.file !== null) &&
                (item.mainSource.file.fsName === fsn)) {
                return item;
            }
        }
        var io = new ImportOptions(f);
        io.importAs = ImportAsType.FOOTAGE;
        return app.project.importFile(io);
    }


    // ── Guide layer operations ─────────────────────────────────────────────────

    function addGuideLayer(imageFilename, fitToWidth) {
        var comp = getActiveComp();
        if (!comp) { return; }

        var path = imgPath(imageFilename);
        if (!path) { return; }

        app.beginUndoGroup("Social Crops: Add Guide - " + imageFilename);
        try {
            var footage = findOrImportFootage(path);
            if (!footage) { app.endUndoGroup(); return; }

            var layer = comp.layers.add(footage);
            layer.guideLayer = true;

            var srcW = footage.width;
            var srcH = footage.height;
            // fitToWidth=true → scale so guide width matches comp width (e.g. 16:9 landscape)
            // fitToWidth=false (default) → scale so guide height matches comp height
            var scale = fitToWidth
                ? (comp.width  / srcW) * 100
                : (comp.height / srcH) * 100;

            // Anchor at source centre so Position == visual centre
            layer.property("Anchor Point").setValue([srcW / 2, srcH / 2]);
            layer.property("Position").setValue([comp.width / 2, comp.height / 2]);
            layer.property("Scale").setValue([scale, scale]);

        } catch (e) {
            alert("Social Crops error (addGuideLayer):\n" + e.toString());
        }
        app.endUndoGroup();
    }


    function removeAllGuides() {
        var comp = getActiveComp();
        if (!comp) { return; }

        var guides = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layers[i].guideLayer) {
                guides.push(comp.layers[i]);
            }
        }

        if (guides.length === 0) {
            alert("Social Crops: No guide layers found in \"" + comp.name + "\".");
            return;
        }

        app.beginUndoGroup("Social Crops: Remove All Guide Layers");
        try {
            for (var j = 0; j < guides.length; j++) {
                guides[j].remove();
            }
        } catch (e) {
            alert("Social Crops error (removeAllGuides):\n" + e.toString());
        }
        app.endUndoGroup();
    }


    // ── Create-Comps operations ────────────────────────────────────────────────

    // Fixed pixel targets for "Optimal Sizes for Socials"
    var OPTIMAL_SIZES = {
        "16:9": [1920, 1080],
        "4:5":  [1080, 1350],
        "1:1":  [1080, 1080],
        "9:16": [1080, 1920]
    };

    var RATIO_DEFS = [
        { key: "1:1",  rw: 1,  rh: 1,  suffix: "1x1"  },
        { key: "9:16", rw: 9,  rh: 16, suffix: "9x16"  },
        { key: "16:9", rw: 16, rh: 9,  suffix: "16x9"  },
        { key: "4:5",  rw: 4,  rh: 5,  suffix: "4x5"   }
    ];

    /** Resolve target [width, height] for the given ratio and settings. */
    function targetDims(ratioDef, sourceComp, useOptimal, preserveWidth) {
        if (useOptimal) {
            return OPTIMAL_SIZES[ratioDef.key];
        }
        if (preserveWidth) {
            var nw = sourceComp.width;
            var nh = Math.round(nw * ratioDef.rh / ratioDef.rw);
            return [nw, nh];
        }
        var nh2 = sourceComp.height;
        var nw2 = Math.round(nh2 * ratioDef.rw / ratioDef.rh);
        return [nw2, nh2];
    }

    /**
     * Create a new parent comp at [newW × newH] that wraps sourceComp as a
     * single pre-comp layer, scaled and centred.
     *
     * Guide layers inside sourceComp are automatically excluded from the new
     * comp's render (AE never renders guide layers from nested comps).
     */
    function createWrappedComp(sourceComp, newW, newH, suffix, useOptimal) {
        var newName = sourceComp.name + "_" + suffix;
        var newComp = app.project.items.addComp(
            newName,
            newW, newH,
            sourceComp.pixelAspect,
            sourceComp.duration,
            sourceComp.frameRate
        );
        newComp.bgColor = sourceComp.bgColor;

        // Keep the new comp next to the source in the Project panel
        newComp.parentFolder = sourceComp.parentFolder;

        var layer = newComp.layers.add(sourceComp);

        // Anchor at source centre → Position at new comp centre
        layer.property("Anchor Point").setValue([sourceComp.width / 2, sourceComp.height / 2]);
        layer.property("Position").setValue([newW / 2, newH / 2]);

        if (useOptimal) {
            // Contain-scale: fit entirely inside the new dimensions, no cropping
            var scaleX = newW / sourceComp.width;
            var scaleY = newH / sourceComp.height;
            var s = Math.min(scaleX, scaleY) * 100;
            layer.property("Scale").setValue([s, s]);
        } else {
            // Canvas-only change: keep content at 100 % pixel scale.
            // The non-preserved axis adds letterbox space or reveals less.
            layer.property("Scale").setValue([100, 100]);
        }

        layer.quality = LayerQuality.BEST;
        return newComp;
    }


    /** Main entry point called by the UI "Create Comps" button. */
    function createComps(selectedKeys, useOptimal, preserveWidth) {
        var comp = getActiveComp();
        if (!comp) { return; }

        if (selectedKeys.length === 0) {
            alert("Social Crops: Please select at least one aspect ratio.");
            return;
        }

        // Build lookup
        var defMap = {};
        for (var d = 0; d < RATIO_DEFS.length; d++) {
            defMap[RATIO_DEFS[d].key] = RATIO_DEFS[d];
        }

        app.beginUndoGroup("Social Crops: Create Comps");
        var created = [];
        try {
            for (var i = 0; i < selectedKeys.length; i++) {
                var key = selectedKeys[i];
                var r = defMap[key];
                if (!r) { continue; }

                var dims = targetDims(r, comp, useOptimal, preserveWidth);
                var nw = dims[0], nh = dims[1];
                var newComp = createWrappedComp(comp, nw, nh, r.suffix, useOptimal);
                created.push(newComp.name + "  (" + nw + " \u00d7 " + nh + ")");
            }
        } catch (e) {
            alert("Social Crops error (createComps):\n" + e.toString());
        }
        app.endUndoGroup();

        if (created.length > 0) {
            var plural = created.length > 1 ? "s" : "";
            alert("Social Crops \u2014 Created " + created.length + " comp" + plural + ":\n\n" +
                  created.join("\n"));
        }
    }


    // ── Public API ─────────────────────────────────────────────────────────────

    return {
        initPaths:       initPaths,
        getImgPath:      imgPath,
        addGuideLayer:   addGuideLayer,
        removeAllGuides: removeAllGuides,
        createComps:     createComps,
        getActiveComp:   getActiveComp
    };

})();

    /**
 * sc-ui.jsx — Social Crops panel UI
 * Loaded via #include from Social Crops.jsx
 * Requires SC_Core to be in scope (loaded first).
 *
 * Exposes: SC_UI.buildPanel(thisObj)
 */

var SC_UI = (function () {

    // ── Colour theme ───────────────────────────────────────────────────────────
    // Values are [r, g, b] floats 0-1, matching AE's default dark UI.

    var C = {
        bg:      [0.169, 0.169, 0.169],   // #2B2B2B  panel background
        section: [0.141, 0.141, 0.141],   // #242424  section header strip
        text:    [0.820, 0.820, 0.820],   // #D1D1D1  standard label text
        textHi:  [0.941, 0.941, 0.941],   // #F0F0F0  bright / title text
        dim:     [0.494, 0.494, 0.494],   // #7E7E7E  muted / hint text
        accent:  [0.949, 0.655, 0.231],   // #F2A73B  warm orange (matches all-crop guide)
        onAcc:   [0.110, 0.063, 0.008],   // dark text on accent background
        line:    [0.282, 0.282, 0.282],   // #484848  divider lines
    };

    // ── Graphics helpers ───────────────────────────────────────────────────────

    function brush(gfx, col) {
        return gfx.newBrush(gfx.BrushType.SOLID_COLOR, col);
    }
    function pen(gfx, col, w) {
        return gfx.newPen(gfx.PenType.SOLID_COLOR, col, w || 1);
    }
    function setColor(el, bg, fg) {
        try {
            if (bg && el.graphics) { el.graphics.backgroundColor = brush(el.graphics, bg); }
            if (fg && el.graphics) { el.graphics.foregroundColor  = pen(el.graphics, fg); }
        } catch (e) { /* colour not supported on this element/version — skip silently */ }
    }
    function font(name, bold, size) {
        return ScriptUI.newFont(name, bold ? "BOLD" : "REGULAR", size);
    }


    // ── Reusable layout primitives ─────────────────────────────────────────────

    /** Horizontal rule drawn via onDraw (1 px, spans full parent width). */
    function addHRule(parent, topMargin, bottomMargin) {
        var g = parent.add("group");
        g.preferredSize   = [-1, 2];
        g.margins         = [0, topMargin || 0, 0, bottomMargin || 0];
        g.alignment       = ["fill", "top"];   // "top" avoids grabbing leftover column height
        g.onDraw = function () {
            try {
                var gfx = this.graphics;
                var w = (this.size && this.size[0]) ? this.size[0] : (this.size && this.size.width) ? this.size.width : this.bounds[2];
                gfx.newPath();
                gfx.moveTo(0, 0);
                gfx.lineTo(w, 0);
                gfx.strokePath(pen(gfx, C.line));
            } catch (e) {}
        };
        return g;
    }

    /** Section header: ACCENT LABEL + trailing rule in the same row. */
    function addSectionHeader(parent, label) {
        var row = parent.add("group");
        row.orientation   = "row";
        row.alignChildren = ["fill", "center"];
        row.margins       = [0, 6, 0, 4];
        row.spacing       = 8;

        var lbl = row.add("statictext", undefined, label);
        lbl.graphics.font = font("Arial", true, 10);
        setColor(lbl, null, C.accent);

        var rule = row.add("group");
        rule.preferredSize  = [-1, 2];
        rule.alignment      = ["fill", "center"];   // center is vertical within the row, fine here
        rule.onDraw = function () {
            try {
                var gfx = this.graphics;
                var w = (this.size && this.size[0]) ? this.size[0] : (this.size && this.size.width) ? this.size.width : this.bounds[2];
                gfx.newPath();
                gfx.moveTo(0, 0);
                gfx.lineTo(w, 0);
                gfx.strokePath(pen(gfx, C.line));
            } catch (e) {}
        };
    }

    /** Small dim label (used for sub-section descriptions). */
    function addSubLabel(parent, text) {
        var lbl = parent.add("statictext", undefined, text);
        lbl.graphics.font = font("Arial", false, 10);
        lbl.alignment     = ["left", "top"];   // opt out of fill
        setColor(lbl, null, C.dim);
        lbl.margins = [0, 2, 0, 2];
        return lbl;
    }


    // ── Guide section ──────────────────────────────────────────────────────────

    var PLATFORMS = [
        { label: "LinkedIn",  icon: "icon-linkedin.png",  overlay: "linkedin-overlay.png", crop: "linkedin-crop.png"       },
        { label: "Reels",     icon: "icon-instagram.png", overlay: "reel-overlay.png",       crop: "reels-crop.png"          },
        { label: "TikTok",    icon: "icon-tiktok.png",    overlay: "tiktok-overlay.png",    crop: "tiktok-crop.png"         }
    ];

    var RATIO_GUIDES = [
        { label: "1:1",  file: "ratio-1x1-crop.png",  fitToWidth: false },
        { label: "9:16", file: "ratio-9x16-crop.png", fitToWidth: false },
        { label: "16:9", file: "ratio-16x9-crop.png", fitToWidth: true  },
        { label: "4:5",  file: "ratio-4x5-crop.png",  fitToWidth: false }
    ];

    /**
     * One platform row: [32x32 icon OR "All" text] + icon buttons, all horizontal.
     * Overlay button omitted when platform.overlay is null.
     * Icon loaded from images/ folder via SC_Core.getImgPath; falls back to text.
     *
     * Button icons (Arial-safe Unicode):
     *   \u2261  ≡  three lines   — UI Overlay / app chrome
     *   \u25A1  □  hollow square — Safe Zone / crop boundary
     */
    function addPlatformRow(parent, platform) {
        var row = parent.add("group");
        row.orientation   = "row";
        row.alignChildren = ["left", "center"];
        row.alignment     = ["left", "top"];
        row.margins       = [0, 2, 0, 2];
        row.spacing       = 8;

        // ── Left: icon image or text fallback ──────────────────────────
        if (platform.icon) {
            var iconLoaded = false;
            try {
                var iconPath = SC_Core.getImgPath(platform.icon);
                if (iconPath) {
                    var iconFile = new File(iconPath);
                    if (iconFile.exists) {
                        var iconEl = row.add("image", undefined, iconFile);
                        iconEl.preferredSize = [32, 32];
                        iconEl.alignment     = ["left", "center"];
                        iconLoaded = true;
                    }
                }
            } catch (e) {}
            if (!iconLoaded) {
                // Fallback: dim text label in fixed-width slot
                var fb = row.add("statictext", undefined, platform.label.slice(0, 3));
                fb.preferredSize  = [32, -1];
                fb.alignment      = ["left", "center"];
                fb.graphics.font  = font("Arial", false, 9);
                setColor(fb, null, C.dim);
            }
        } else {
            // "All" — plain text in the icon slot
            var lbl = row.add("statictext", undefined, platform.label);
            lbl.preferredSize = [32, -1];
            lbl.alignment     = ["left", "center"];
            lbl.graphics.font = font("Arial", false, 11);
            setColor(lbl, null, C.text);
        }

        // ── Right: action buttons ───────────────────────────────────────
        if (platform.overlay) {
            var ovBtn = row.add("button", undefined, "\u2261");
            ovBtn.preferredSize = [30, 26];
            ovBtn.graphics.font = font("Arial", false, 12);
            ovBtn.helpTip       = platform.label + " \u2014 UI Overlay (shows app chrome)";
            (function (p, b) { b.onClick = function () { SC_Core.addGuideLayer(p.overlay); }; })(platform, ovBtn);
        }

        var czBtn = row.add("button", undefined, "\u25A1");
        czBtn.preferredSize = [30, 26];
        czBtn.graphics.font = font("Arial", false, 12);
        czBtn.helpTip       = platform.label + " \u2014 Safe Zone (content-safe crop guide)";
        (function (p, b) { b.onClick = function () { SC_Core.addGuideLayer(p.crop); }; })(platform, czBtn);
    }

    /** Aspect-ratio crop guide buttons — 2x2 grid. */
    function addRatioGuideRow(parent) {
        addSubLabel(parent, "Aspect Ratios");

        for (var i = 0; i < RATIO_GUIDES.length; i += 2) {
            var row = parent.add("group");
            row.orientation   = "row";
            row.alignChildren = ["fill", "top"];
            row.alignment     = ["fill", "top"];
            row.margins       = [0, 2, 0, 2];
            row.spacing       = 3;

            (function (pair) {
                for (var j = 0; j < pair.length; j++) {
                    (function (g) {
                        var btn = row.add("button", undefined, g.label);
                        btn.alignment     = ["left", "top"];
                        btn.preferredSize = [56, 28];
                        btn.graphics.font = font("Arial", false, 10);
                        btn.helpTip       = "Drop " + g.label + " aspect-ratio guide into active comp";
                        btn.onClick = function () { SC_Core.addGuideLayer(g.file, g.fitToWidth); };
                    })(pair[j]);
                }
            })(RATIO_GUIDES.slice(i, i + 2));
        }
    }


    // ── Create-Comps section ───────────────────────────────────────────────────

    /**
     * Builds the full Create Comps section and appends it to parent.
     * Returns nothing — wires all interactions internally.
     */
    function addCreateCompsSection(parent) {
        addSectionHeader(parent, "CREATE COMPS");

        // ── Ratio checkboxes ────────────────────────────────────────────
        addSubLabel(parent, "Select aspect ratios:");

        var cbRow1 = parent.add("group");
        cbRow1.orientation   = "row";
        cbRow1.alignChildren = ["left", "center"];
        cbRow1.alignment     = ["left", "top"];   // opt out of fill
        cbRow1.margins       = [0, 2, 0, 2];
        cbRow1.spacing       = 16;

        var cbRow2 = parent.add("group");
        cbRow2.orientation   = "row";
        cbRow2.alignChildren = ["left", "center"];
        cbRow2.alignment     = ["left", "top"];   // opt out of fill
        cbRow2.margins       = [0, 0, 0, 2];
        cbRow2.spacing       = 16;

        var cb11  = cbRow1.add("checkbox", undefined, "1:1");
        var cb916 = cbRow1.add("checkbox", undefined, "9:16");
        var cb169 = cbRow2.add("checkbox", undefined, "16:9");
        var cb45  = cbRow2.add("checkbox", undefined, "4:5");
        var cbs   = [cb11, cb916, cb169, cb45];

        for (var ci = 0; ci < cbs.length; ci++) {
            cbs[ci].graphics.font = font("Arial", false, 11);
            setColor(cbs[ci], null, C.text);
        }

        // "Select All" toggle
        var selRow = parent.add("group");
        selRow.orientation   = "row";
        selRow.alignChildren = ["left", "center"];
        selRow.alignment     = ["left", "top"];   // opt out of fill
        selRow.margins       = [0, 2, 0, 8];

        var selBtn = selRow.add("button", undefined, "Select All");
        selBtn.preferredSize = [80, 20];
        selBtn.graphics.font = font("Arial", false, 10);
        selBtn.helpTip = "Toggle all aspect ratios on / off";
        selBtn.onClick = function () {
            var allOn = cb11.value && cb916.value && cb169.value && cb45.value;
            cb11.value = cb916.value = cb169.value = cb45.value = !allOn;
        };

        // ── Optimal Sizes toggle ────────────────────────────────────────
        var optRow = parent.add("group");
        optRow.orientation   = "row";
        optRow.alignChildren = ["left", "center"];
        optRow.alignment     = ["left", "top"];   // opt out of fill
        optRow.margins       = [0, 0, 0, 4];

        var optCb = optRow.add("checkbox", undefined, "Use Optimal Sizes for Socials");
        optCb.value          = true;
        optCb.graphics.font  = font("Arial", false, 11);
        setColor(optCb, null, C.text);
        optCb.helpTip =
            "ON: use fixed pixel dimensions (e.g. 1920\u00d71080 for 16:9).\n" +
            "OFF: derive new dimensions from the current comp, preserving one axis.";

        // Optimal-sizes reference text (visible when toggle = ON)
        var optInfo = parent.add("statictext", undefined,
            "16:9 \u2192 1920\u00d71080   |   4:5 \u2192 1080\u00d71350\n" +
            "1:1  \u2192 1080\u00d71080   |   9:16 \u2192 1080\u00d71920",
            { multiline: true });
        optInfo.graphics.font = font("Arial", false, 9);
        optInfo.alignment     = ["left", "top"];   // opt out of fill
        setColor(optInfo, null, C.dim);
        optInfo.margins = [20, 0, 0, 8];

        // ── Preserve dimension radios (visible when toggle = OFF) ───────
        var preserveGroup = parent.add("group");
        preserveGroup.orientation   = "column";
        preserveGroup.alignChildren = ["left", "top"];
        preserveGroup.alignment     = ["left", "top"];   // opt out of fill
        preserveGroup.margins       = [20, 2, 0, 8];
        preserveGroup.spacing       = 6;
        preserveGroup.visible       = false;

        var pLbl = preserveGroup.add("statictext", undefined, "When resizing, preserve:");
        pLbl.graphics.font = font("Arial", false, 10);
        setColor(pLbl, null, C.text);

        var pHRadio = preserveGroup.add("radiobutton", undefined,
            "Height  (width changes to match ratio)");
        var pWRadio = preserveGroup.add("radiobutton", undefined,
            "Width   (height changes to match ratio)");
        pHRadio.value = true;

        var radios = [pHRadio, pWRadio];
        for (var ri = 0; ri < radios.length; ri++) {
            radios[ri].graphics.font = font("Arial", false, 10);
            setColor(radios[ri], null, C.text);
        }

        // Wire toggle → show/hide panels
        optCb.onClick = function () {
            optInfo.visible      = optCb.value;
            preserveGroup.visible = !optCb.value;
            var win = optCb.window;
            if (win && win.layout) { win.layout.layout(true); }
        };

        // ── Spacer ─────────────────────────────────────────────────────
        var spacer = parent.add("group");
        spacer.preferredSize = [-1, 6];

        // ── Create Comps primary button ─────────────────────────────────
        var createBtn = parent.add("button", undefined, "Create Comps");
        createBtn.preferredSize = [115, 36];
        createBtn.alignment     = ["left", "top"];
        createBtn.graphics.font = font("Arial", true, 12);
        createBtn.helpTip =
            "Wrap the active comp in new parent comps at each selected aspect ratio.";
        setColor(createBtn, C.accent, C.onAcc);

        createBtn.onClick = function () {
            var sel = [];
            if (cb11.value)  { sel.push("1:1");  }
            if (cb916.value) { sel.push("9:16"); }
            if (cb169.value) { sel.push("16:9"); }
            if (cb45.value)  { sel.push("4:5");  }
            SC_Core.createComps(sel, optCb.value, pWRadio.value);
        };
    }


    // ── Main panel builder ─────────────────────────────────────────────────────

    function buildPanel(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Social Crops", undefined, { resizeable: true });

        win.orientation   = "column";
        win.alignChildren = ["fill", "top"];
        win.margins       = [10, 8, 10, 10];
        win.spacing       = 2;
        setColor(win, C.bg);

        // ── Header ──────────────────────────────────────────────────────
        var hdr = win.add("group");
        hdr.orientation   = "row";
        hdr.alignChildren = ["left", "center"];
        hdr.alignment     = ["left", "top"];   // opt out of fill
        hdr.margins       = [0, 0, 0, 4];
        hdr.spacing       = 6;

        var dot = hdr.add("statictext", undefined, "\u25cf");
        dot.graphics.font = font("Arial", false, 8);
        setColor(dot, null, C.accent);

        var title = hdr.add("statictext", undefined, "SOCIAL CROPS");
        title.graphics.font = font("Arial", true, 12);
        setColor(title, null, C.textHi);

        var ver = hdr.add("statictext", undefined, "v1.0");
        ver.graphics.font = font("Arial", false, 9);
        setColor(ver, null, C.dim);

        addHRule(win, 0, 4);

        // ── Guides section ───────────────────────────────────────────────
        addSectionHeader(win, "GUIDES");

        for (var pi = 0; pi < PLATFORMS.length; pi++) {
            addPlatformRow(win, PLATFORMS[pi]);
        }

        // Aspect-ratio crop guides
        addHRule(win, 4, 2);
        addRatioGuideRow(win);

        // ── Divider ──────────────────────────────────────────────────────
        addHRule(win, 6, 0);

        // ── Create Comps section ─────────────────────────────────────────
        addCreateCompsSection(win);

        // ── Layout ───────────────────────────────────────────────────────
        win.layout.layout(true);
        win.layout.resize();
        if (win instanceof Window) {
            win.onResizing = win.onResize = function () { win.layout.resize(); };
        }

        return win;
    }

    function buildPanelSafe(thisObj) {
        try {
            return buildPanel(thisObj);
        } catch (e) {
            alert("Social Crops failed to load:\n\n" + e.toString() +
                  "\n\nLine: " + e.line);
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    return {
        buildPanel: buildPanelSafe
    };

})();


    // Pass the images folder path to the core module
    SC_Core.initPaths(MAIN_FILE);

    // Build and show the panel
    var panel = SC_UI.buildPanel(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
