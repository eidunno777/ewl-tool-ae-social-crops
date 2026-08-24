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
        g.preferredSize   = [-1, 1];
        g.margins         = [0, topMargin || 0, 0, bottomMargin || 0];
        g.alignment       = ["fill", "center"];
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
        row.margins       = [0, 10, 0, 6];
        row.spacing       = 8;

        var lbl = row.add("statictext", undefined, label);
        lbl.graphics.font = font("Arial", true, 10);
        setColor(lbl, null, C.accent);

        var rule = row.add("group");
        rule.preferredSize  = [-1, 1];
        rule.alignment      = ["fill", "center"];
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
        {
            label:   "LinkedIn",
            overlay: "linkedin-overlay.png",
            crop:    "linkedin-crop.png"
        },
        {
            label:   "Instagram Feed",
            overlay: null,                          // no UI overlay for feed
            crop:    "instagram-feed-crop.png"
        },
        {
            label:   "Instagram Reels",
            overlay: "reel-overlay.png",
            crop:    "reels-crop.png"
        },
        {
            label:   "TikTok",
            overlay: "tiktok-overlay.png",
            crop:    "tiktok-crop.png"
        },
        {
            label:   "All Platforms",
            overlay: "all-overlay.png",
            crop:    "all-crop.png"
        }
    ];

    var RATIO_GUIDES = [
        { label: "1:1",  file: "ratio-1x1-crop.png",  fitToWidth: false },
        { label: "9:16", file: "ratio-9x16-crop.png", fitToWidth: false },
        { label: "16:9", file: "ratio-16x9-crop.png", fitToWidth: true  },
        { label: "4:5",  file: "ratio-4x5-crop.png",  fitToWidth: false }
    ];

    /**
     * One platform block: label on top, icon buttons below (vertically stacked).
     * Overlay button omitted when platform.overlay is null.
     *
     * Button icons (Arial-safe Unicode):
     *   \u2261  ≡  three lines   — "UI Overlay / app chrome"
     *   \u25A1  □  hollow square — "Safe Zone / crop boundary"
     */
    function addPlatformRow(parent, platform) {
        var block = parent.add("group");
        block.orientation   = "column";
        block.alignChildren = ["left", "top"];
        block.alignment     = ["left", "top"];
        block.margins       = [0, 4, 0, 8];   // extra bottom margin separates sections
        block.spacing       = 4;

        var nameLbl = block.add("statictext", undefined, platform.label);
        nameLbl.graphics.font = font("Arial", false, 10);
        nameLbl.alignment     = ["left", "top"];
        setColor(nameLbl, null, C.text);

        var btnRow = block.add("group");
        btnRow.orientation   = "row";
        btnRow.alignChildren = ["left", "center"];
        btnRow.alignment     = ["left", "top"];
        btnRow.spacing       = 4;

        if (platform.overlay) {
            var ovBtn = btnRow.add("button", undefined, "\u2261");
            ovBtn.preferredSize = [32, 24];
            ovBtn.graphics.font = font("Arial", false, 12);
            ovBtn.helpTip       = platform.label + " \u2014 UI Overlay (shows app chrome)";
            (function (p, b) { b.onClick = function () { SC_Core.addGuideLayer(p.overlay); }; })(platform, ovBtn);
        }

        var czBtn = btnRow.add("button", undefined, "\u25A1");
        czBtn.preferredSize = [32, 24];
        czBtn.graphics.font = font("Arial", false, 12);
        czBtn.helpTip       = platform.label + " \u2014 Safe Zone (content-safe crop guide)";
        (function (p, b) { b.onClick = function () { SC_Core.addGuideLayer(p.crop); }; })(platform, czBtn);
    }

    /** Aspect-ratio crop guide buttons — evenly spaced row. */
    function addRatioGuideRow(parent) {
        addSubLabel(parent, "Aspect Ratios");

        var row = parent.add("group");
        row.orientation   = "row";
        row.alignChildren = ["center", "center"];
        row.alignment     = ["fill", "center"];
        row.margins       = [0, 2, 0, 4];
        row.spacing       = 4;

        for (var i = 0; i < RATIO_GUIDES.length; i++) {
            (function (g) {
                var btn = row.add("button", undefined, g.label);
                btn.preferredSize = [-1, 26];
                btn.minimumSize   = [36, 26];
                btn.graphics.font = font("Arial", false, 10);
                btn.helpTip       = "Drop " + g.label + " aspect-ratio guide into active comp";
                btn.onClick = function () { SC_Core.addGuideLayer(g.file, g.fitToWidth); };
            })(RATIO_GUIDES[i]);
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
        createBtn.preferredSize = [-1, 36];
        createBtn.alignment     = ["fill", "bottom"];
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
        win.margins       = [8, 8, 8, 10];
        win.spacing       = 0;
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

        addSubLabel(win, "Drop a guide into the active comp:");

        for (var pi = 0; pi < PLATFORMS.length; pi++) {
            addPlatformRow(win, PLATFORMS[pi]);
        }

        // Aspect-ratio crop guides
        addHRule(win, 6, 2);
        addRatioGuideRow(win);

        // ── Divider ──────────────────────────────────────────────────────
        addHRule(win, 8, 0);

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
