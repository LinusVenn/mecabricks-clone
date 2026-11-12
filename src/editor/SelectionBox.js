import * as THREE from 'three';

// =====================================================================
// SelectionBox
//
// Eine Bereichsauswahl wird NUR gestartet, wenn die Leertaste gedrückt
// gehalten wird und anschließend die linke Maustaste gezogen wird.
// Ohne Leertaste bleibt die linke Maustaste vollständig für OrbitControls
// (Kameradrehung) und die normale Einzelauswahl verfügbar.
// =====================================================================

export class SelectionBox {
    /**
     * @param {THREE.Camera} camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {import('./MultiSelectionManager.js').MultiSelectionManager} multiSelectionManager
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     * @param {import('../scene/SceneManager.js').SceneManager['controls']} controls
     */
    constructor(camera, renderer, multiSelectionManager, library, controls = null) {
        this._camera = camera;
        this._renderer = renderer;
        this._multi = multiSelectionManager;
        this._library = library;
        this._controls = controls;

        this.enabled = true;
        this.canStart = () => true;

        this._spaceDown = false;
        this._dragging = false;
        this._active = false;
        this._pointerId = null;
        this._startX = 0;
        this._startY = 0;
        this._additive = false;
        this._dragThreshold = 5;
        this._previousControlsEnabled = null;

        this._boxEl = this._createBoxElement();

        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        this._onBlur = this._handleWindowBlur.bind(this);
        this._onPointerDown = this._handlePointerDown.bind(this);
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
        this._onPointerCancel = this._handlePointerCancel.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);

        const canvas = this._renderer.domElement;
        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.addEventListener('pointermove', this._onPointerMove);
        canvas.addEventListener('pointerup', this._onPointerUp);
        canvas.addEventListener('pointercancel', this._onPointerCancel);
    }

    isSpacePressed() {
        return this._spaceDown;
    }

    _isEditableTarget(target) {
        const tagName = target?.tagName;
        return Boolean(
            target?.isContentEditable ||
            tagName === 'INPUT' ||
            tagName === 'TEXTAREA' ||
            tagName === 'SELECT'
        );
    }

    _handleKeyDown(event) {
        if (event.code !== 'Space' || this._isEditableTarget(event.target)) return;

        this._spaceDown = true;
        // Verhindert, dass die Seite beim Drücken der Leertaste scrollt.
        event.preventDefault();
        this._disableOrbitControls();
    }

    _handleKeyUp(event) {
        if (event.code !== 'Space') return;

        this._spaceDown = false;
        this._restoreOrbitControlsIfPossible();
    }

    _handleWindowBlur() {
        this._spaceDown = false;
        this._cancelDrag();
        this._restoreOrbitControlsIfPossible();
    }

    _disableOrbitControls() {
        if (!this._controls || this._previousControlsEnabled !== null) return;

        this._previousControlsEnabled = this._controls.enabled;
        this._controls.enabled = false;
    }

    _restoreOrbitControlsIfPossible() {
        // Während eines laufenden Rechteck-Drags bleiben die Controls aus,
        // selbst wenn die Leertaste vor der Maustaste losgelassen wird.
        if (this._spaceDown || this._active) return;
        if (!this._controls || this._previousControlsEnabled === null) return;

        this._controls.enabled = this._previousControlsEnabled;
        this._previousControlsEnabled = null;
    }

    _createBoxElement() {
        const element = document.createElement('div');
        element.id = 'selection-box-overlay';
        element.style.cssText = [
            'position:fixed',
            'border:2px dashed #00aaff',
            'background:rgba(0,170,255,0.10)',
            'box-sizing:border-box',
            'pointer-events:none',
            'display:none',
            'z-index:9000',
        ].join(';');
        document.body.appendChild(element);
        return element;
    }

    _updateBox(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const style = this._boxEl.style;
        style.left = `${left}px`;
        style.top = `${top}px`;
        style.width = `${Math.abs(x2 - x1)}px`;
        style.height = `${Math.abs(y2 - y1)}px`;
        style.display = 'block';
    }

    _hideBox() {
        this._boxEl.style.display = 'none';
    }

    _handlePointerDown(event) {
        if (!this.enabled || !this._spaceDown || event.button !== 0) return;
        if (!this.canStart()) return;

        this._active = true;
        this._dragging = false;
        this._pointerId = event.pointerId;
        this._startX = event.clientX;
        this._startY = event.clientY;
        this._additive = event.ctrlKey || event.metaKey;

        this._disableOrbitControls();
        event.preventDefault();
        event.stopPropagation();

        // Pointer-Events bleiben auch dann beim Canvas, wenn der Cursor
        // während des Ziehens den Canvas verlässt.
        try {
            this._renderer.domElement.setPointerCapture(event.pointerId);
        } catch {
            // Nicht jede Test-/Browserumgebung unterstützt Pointer Capture.
        }
    }

    _handlePointerMove(event) {
        if (!this._active || event.pointerId !== this._pointerId) return;

        const distance = Math.hypot(
            event.clientX - this._startX,
            event.clientY - this._startY
        );

        if (distance < this._dragThreshold) return;

        this._dragging = true;
        this._updateBox(this._startX, this._startY, event.clientX, event.clientY);
        event.preventDefault();
    }

    _handlePointerUp(event) {
        if (!this._active || event.pointerId !== this._pointerId || event.button !== 0) return;

        if (this._dragging) {
            this._selectBricksInRect(
                this._startX,
                this._startY,
                event.clientX,
                event.clientY,
                this._additive
            );
        }

        this._cancelDrag();
        this._restoreOrbitControlsIfPossible();
    }

    _handlePointerCancel(event) {
        if (!this._active || event.pointerId !== this._pointerId) return;
        this._cancelDrag();
        this._restoreOrbitControlsIfPossible();
    }

    _cancelDrag() {
        this._active = false;
        this._dragging = false;
        this._pointerId = null;
        this._startX = 0;
        this._startY = 0;
        this._additive = false;
        this._hideBox();
    }

    /**
     * Wählt alle Bauteile aus, deren projizierte Bildschirm-Bounding-Box
     * das Auswahlrechteck schneidet. Damit reicht es, wenn ein Teil teilweise
     * im Rechteck liegt; der Mittelpunkt muss nicht darin liegen.
     */
    _selectBricksInRect(x1, y1, x2, y2, additive = false) {
        const canvasRect = this._renderer.domElement.getBoundingClientRect();

        // Auswahlbereich auf den tatsächlichen Canvas begrenzen.
        const rectMinX = Math.max(canvasRect.left, Math.min(x1, x2));
        const rectMaxX = Math.min(canvasRect.right, Math.max(x1, x2));
        const rectMinY = Math.max(canvasRect.top, Math.min(y1, y2));
        const rectMaxY = Math.min(canvasRect.bottom, Math.max(y1, y2));

        if (rectMinX > rectMaxX || rectMinY > rectMaxY) return;

        const selected = [];
        const worldBounds = new THREE.Box3();
        const corner = new THREE.Vector3();

        for (const brick of this._library.getAll()) {
            brick.group.updateWorldMatrix(true, true);
            worldBounds.setFromObject(brick.group);
            if (worldBounds.isEmpty()) continue;

            let objectMinX = Infinity;
            let objectMinY = Infinity;
            let objectMaxX = -Infinity;
            let objectMaxY = -Infinity;
            let hasVisibleCorner = false;

            for (let i = 0; i < 8; i++) {
                corner.set(
                    (i & 1) ? worldBounds.max.x : worldBounds.min.x,
                    (i & 2) ? worldBounds.max.y : worldBounds.min.y,
                    (i & 4) ? worldBounds.max.z : worldBounds.min.z
                );

                corner.project(this._camera);

                // Punkte hinter der Kamera bzw. außerhalb der Tiefenebenen
                // werden nicht zur Bildschirm-Bounding-Box gezählt.
                if (corner.z < -1 || corner.z > 1) continue;

                const screenX = canvasRect.left + (corner.x + 1) * 0.5 * canvasRect.width;
                const screenY = canvasRect.top + (1 - corner.y) * 0.5 * canvasRect.height;

                objectMinX = Math.min(objectMinX, screenX);
                objectMaxX = Math.max(objectMaxX, screenX);
                objectMinY = Math.min(objectMinY, screenY);
                objectMaxY = Math.max(objectMaxY, screenY);
                hasVisibleCorner = true;
            }

            if (!hasVisibleCorner) continue;

            const overlaps =
                objectMaxX >= rectMinX &&
                objectMinX <= rectMaxX &&
                objectMaxY >= rectMinY &&
                objectMinY <= rectMaxY;

            if (overlaps) selected.push(brick);
        }

        if (additive) {
            const combined = new Map(
                this._multi.getSelectedBricks(this._library).map(brick => [brick.id, brick])
            );
            for (const brick of selected) combined.set(brick.id, brick);
            this._multi.setSelection([...combined.values()]);
        } else {
            this._multi.setSelection(selected);
        }
    }

    dispose() {
        const canvas = this._renderer.domElement;
        canvas.removeEventListener('pointerdown', this._onPointerDown);
        canvas.removeEventListener('pointermove', this._onPointerMove);
        canvas.removeEventListener('pointerup', this._onPointerUp);
        canvas.removeEventListener('pointercancel', this._onPointerCancel);

        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('blur', this._onBlur);

        this._cancelDrag();
        this._spaceDown = false;
        this._restoreOrbitControlsIfPossible();
        this._boxEl.remove();
    }
}
