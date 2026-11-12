
// =====================================================================
// SelectionBox
//
// Ermöglicht die Auswahl mehrerer Bauteile durch Ziehen eines
// Rechtecks im Viewport.
//
// Aktivierung: Linke Maustaste + Drag auf freier Fläche (kein aktiver
//              Placement-Modus und kein Bauteil direkt unter dem Cursor).
//
// Koordination: Setzt this.enabled = false wenn Placement aktiv ist,
//               damit keine konkurrierenden Events entstehen.
// =====================================================================

export class SelectionBox {

    /**
     * @param {THREE.Camera}   camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {import('./MultiSelectionManager.js').MultiSelectionManager} multiSelectionManager
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     */
    constructor(camera, renderer, multiSelectionManager, library) {
        this._camera   = camera;
        this._renderer = renderer;
        this._multi    = multiSelectionManager;
        this._library  = library;

        /** DOM-Overlay für das Auswahlrechteck */
        this._boxEl = this._createBoxElement();

        this._dragging = false;
        this._startX   = 0;
        this._startY   = 0;

        /** Mindest-Drag-Distanz in Pixel, bevor als Rechteckauswahl gilt */
        this._DRAG_THRESHOLD = 6;

        /**
         * Wenn false (z. B. im Placement-Modus), reagiert SelectionBox nicht.
         * @type {boolean}
         */
        this.enabled = true;

        this._onDown  = this._onPointerDown.bind(this);
        this._onMove  = this._onPointerMove.bind(this);
        this._onUp    = this._onPointerUp.bind(this);

        renderer.domElement.addEventListener('pointerdown', this._onDown);
        renderer.domElement.addEventListener('pointermove', this._onMove);
        renderer.domElement.addEventListener('pointerup',   this._onUp);
    }


    // ------------------------------------------------------------------
    // DOM-Hilfsmethoden
    // ------------------------------------------------------------------

    _createBoxElement() {
        const el = document.createElement('div');
        el.id = 'selection-box-overlay';
        el.style.cssText = [
            'position:fixed',
            'border:2px dashed #00aaff',
            'background:rgba(0,170,255,0.07)',
            'pointer-events:none',
            'display:none',
            'z-index:9000',
        ].join(';');
        document.body.appendChild(el);
        return el;
    }

    _updateBox(x1, y1, x2, y2) {
        const left   = Math.min(x1, x2);
        const top    = Math.min(y1, y2);
        const width  = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        const s = this._boxEl.style;
        s.left    = left   + 'px';
        s.top     = top    + 'px';
        s.width   = width  + 'px';
        s.height  = height + 'px';
        s.display = 'block';
    }

    _hideBox() {
        this._boxEl.style.display = 'none';
    }


    // ------------------------------------------------------------------
    // Pointer-Events
    // ------------------------------------------------------------------

    _onPointerDown(event) {
        if (!this.enabled) return;
        if (event.button !== 0) return;

        this._startX   = event.clientX;
        this._startY   = event.clientY;
        this._dragging = false;
    }

    _onPointerMove(event) {
        if (!this.enabled) return;
        if (!(event.buttons & 1)) return;   // Linke Taste gedrückt?

        const dx = event.clientX - this._startX;
        const dy = event.clientY - this._startY;

        if (Math.hypot(dx, dy) > this._DRAG_THRESHOLD) {
            this._dragging = true;
            this._updateBox(this._startX, this._startY, event.clientX, event.clientY);
        }
    }

    _onPointerUp(event) {
        if (!this.enabled) return;
        if (event.button !== 0) return;

        if (this._dragging) {
            this._hideBox();
            this._selectBricksInRect(
                this._startX, this._startY,
                event.clientX, event.clientY,
                event.ctrlKey || event.metaKey,
            );
        }

        this._dragging = false;
        this._startX   = 0;
        this._startY   = 0;
    }


    // ------------------------------------------------------------------
    // Bauteil-Selektion
    // ------------------------------------------------------------------

    /**
     * Projiziert alle Brick-Mittelpunkte in Screen-Space und selektiert
     * jene, deren Projektion im Auswahlrechteck liegt.
     *
     * @param {number}  x1       Screen-Koordinate Start
     * @param {number}  y1
     * @param {number}  x2       Screen-Koordinate Ende
     * @param {number}  y2
     * @param {boolean} additive true → zur bestehenden Auswahl hinzufügen
     */
    _selectBricksInRect(x1, y1, x2, y2, additive) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        const canvasRect = this._renderer.domElement.getBoundingClientRect();
        const cW = canvasRect.width;
        const cH = canvasRect.height;

        const inside = [];

        for (const brick of this._library.getAll()) {
            // Weltmittelpunkt des Steins
            const worldPos = brick.group.position.clone();
            worldPos.y    += brick.height / 2;

            // NDC-Koordinaten
            const ndc = worldPos.project(this._camera);

            // Hinter der Kamera (clipping-plane)?
            if (ndc.z > 1) continue;

            // NDC → absolute Screen-Pixel
            const sx = (ndc.x  + 1) / 2 * cW + canvasRect.left;
            const sy = (-ndc.y + 1) / 2 * cH + canvasRect.top;

            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
                inside.push(brick);
            }
        }

        if (additive) {
            inside.forEach(b => this._multi.addSelection(b));
        } else {
            this._multi.setSelection(inside);
        }
    }


    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    dispose() {
        this._renderer.domElement.removeEventListener('pointerdown', this._onDown);
        this._renderer.domElement.removeEventListener('pointermove', this._onMove);
        this._renderer.domElement.removeEventListener('pointerup',   this._onUp);
        this._boxEl.remove();
    }
}
