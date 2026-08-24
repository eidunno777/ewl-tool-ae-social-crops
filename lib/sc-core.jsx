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
        _imgFolder = new Folder(root.fsName + "/images");
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
        addGuideLayer:   addGuideLayer,
        removeAllGuides: removeAllGuides,
        createComps:     createComps,
        getActiveComp:   getActiveComp
    };

})();
