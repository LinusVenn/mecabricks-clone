
import * as THREE from 'three';
import { STUD_PITCH } from '../utils/Constants.js';

// =====================================================================
// MultiSelectionManager
//
// Verwaltet die Mehrfachauswahl von Bauteilen. Ergänzt den bestehenden
// SelectionManager (Einzelauswahl) um eine Sammlung selektierter Steine.
//
// Wichtig: Die Highlight-Meshes werden dem brick.group hinzugefügt.
// Da CollisionManager nur PART_DEFINITIONS nutzt (keine Three.js-Geometrie),
// beeinflussen die Highlights weder Kollision noch Verbindungen.
// =====================================================================

export class MultiSelectionManager {

    constructor() {
        /** @type {Set<string>} IDs der ausgewählten Steine */
        this._selectedIds = new Set();

        /** @type {Map<string, THREE.LineSegments>} brickId → Highlight-Mesh */
        this._highlights  = new Map();

        /**
         * Callback nach jeder Auswahländerung.
         * @type {((ids: string[]) => void) | null}
         */
        this.onSelectionChanged = null;
    }


    // ------------------------------------------------------------------
    // Auswahl-Verwaltung
    // ------------------------------------------------------------------

    /**
     * Stein zur Auswahl hinzufügen.
     * @param {import('../objects/Brick.js').Brick} brick
     */
    addSelection(brick) {
        if (!brick || this._selectedIds.has(brick.id)) return;
        this._selectedIds.add(brick.id);
        this._addHighlight(brick);
        this._notify();
    }

    /**
     * Stein aus der Auswahl entfernen.
     * @param {import('../objects/Brick.js').Brick} brick
     */
    removeSelection(brick) {
        if (!brick || !this._selectedIds.has(brick.id)) return;
        this._selectedIds.delete(brick.id);
        this._removeHighlight(brick.id);
        this._notify();
    }

    /**
     * Auswahl umschalten (add / remove).
     * @param {import('../objects/Brick.js').Brick} brick
     */
    toggleSelection(brick) {
        if (this._selectedIds.has(brick.id)) {
            this.removeSelection(brick);
        } else {
            this.addSelection(brick);
        }
    }

    /**
     * Gesamte Auswahl durch neue Liste ersetzen.
     * @param {import('../objects/Brick.js').Brick[]} bricks
     */
    setSelection(bricks) {
        for (const id of this._selectedIds) {
            this._removeHighlight(id);
        }
        this._selectedIds.clear();

        for (const b of bricks) {
            if (!b) continue;
            this._selectedIds.add(b.id);
            this._addHighlight(b);
        }
        this._notify();
    }

    /** Alle Auswahlen aufheben. */
    clearSelection() {
        for (const id of [...this._selectedIds]) {
            this._removeHighlight(id);
        }
        this._selectedIds.clear();
        this._notify();
    }

    /**
     * Gibt die ausgewählten BrickIds zurück.
     * @returns {string[]}
     */
    getSelectedIds() {
        return [...this._selectedIds];
    }

    /**
     * Gibt die ausgewählten Brick-Instanzen aus der Library zurück.
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     * @returns {import('../objects/Brick.js').Brick[]}
     */
    getSelectedBricks(library) {
        const result = [];
        for (const id of this._selectedIds) {
            const b = library.getById(id);
            if (b) result.push(b);
        }
        return result;
    }

    /**
     * @param {import('../objects/Brick.js').Brick} brick
     * @returns {boolean}
     */
    isSelected(brick) {
        return this._selectedIds.has(brick.id);
    }

    /** @returns {number} */
    getSelectionCount() {
        return this._selectedIds.size;
    }

    /** @returns {boolean} */
    hasSelection() {
        return this._selectedIds.size > 0;
    }


    // ------------------------------------------------------------------
    // Highlights  (blaue Wireframe-Umrandung)
    // ------------------------------------------------------------------

    /**
     * Fügt ein blaues Wireframe-Highlight zum brick.group hinzu.
     * @param {import('../objects/Brick.js').Brick} brick
     */
    _addHighlight(brick) {
        if (this._highlights.has(brick.id)) return;

        const W = brick.width  * STUD_PITCH * 1.04;
        const H = brick.height * 1.04;
        const D = brick.depth  * STUD_PITCH * 1.04;

        const boxGeo   = new THREE.BoxGeometry(W, H, D);
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        boxGeo.dispose();  // BoxGeometry wird nach EdgesGeometry nicht mehr benötigt

        const mat = new THREE.LineBasicMaterial({
            color:     0x00aaff,
            linewidth: 2,
            depthTest: false,
        });

        const lines = new THREE.LineSegments(edgesGeo, mat);
        lines.userData.isHighlight = true;
        lines.renderOrder = 999;
        lines.position.y  = brick.height / 2;  // Zentriert auf Steinmitte

        brick.group.add(lines);
        this._highlights.set(brick.id, lines);
    }

    /** @param {string} brickId */
    _removeHighlight(brickId) {
        const lines = this._highlights.get(brickId);
        if (!lines) return;
        lines.parent?.remove(lines);
        lines.geometry.dispose();
        lines.material.dispose();
        this._highlights.delete(brickId);
    }

    /**
     * Entfernt alle Highlights und leert die Auswahl.
     * Wird nach Undo/Redo und beim Laden aufgerufen.
     */
    disposeAllHighlights() {
        for (const id of [...this._highlights.keys()]) {
            this._removeHighlight(id);
        }
        this._selectedIds.clear();
    }


    // ------------------------------------------------------------------
    // Intern
    // ------------------------------------------------------------------

    _notify() {
        this.onSelectionChanged?.([...this._selectedIds]);
    }
}
