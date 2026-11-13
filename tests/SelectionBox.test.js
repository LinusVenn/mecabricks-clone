import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── DOM-Polyfills ───────────────────────────────────────────────────────────
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener:    mock.fn(),
        removeEventListener: mock.fn(),
    };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: () => ({
            id:       '',
            style:    { cssText: '' },
            addEventListener: () => {},
            remove:   () => {},
        }),
        body: {
            appendChild:  () => {},
            removeChild:  () => {},
        },
    };
}

import { SelectionBox } from '../src/editor/SelectionBox.js';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeCanvas() {
    const handlers = {};
    return {
        addEventListener:    mock.fn((ev, cb) => { handlers[ev] = cb; }),
        removeEventListener: mock.fn(),
        setPointerCapture:   mock.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
        style: { touchAction: '' },
        _handlers: handlers,
        fire(event, payload) { handlers[event]?.(payload); },
    };
}

function makeRenderer(canvas) {
    return { domElement: canvas };
}

function makeMultiManager() {
    return {
        getSelectedBricks: mock.fn(() => []),
        setSelection:      mock.fn(),
    };
}

function makeLibrary(bricks = []) {
    return { getAll: mock.fn(() => bricks) };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SelectionBox', () => {

    let canvas, renderer, multi, library, orbitControls, box;

    beforeEach(() => {
        canvas        = makeCanvas();
        renderer      = makeRenderer(canvas);
        multi         = makeMultiManager();
        library       = makeLibrary();
        orbitControls = { enabled: true };
        box = new SelectionBox(
            {},          // camera (nicht benötigt in diesen Tests)
            renderer,
            multi,
            library,
            orbitControls,
        );
    });

    // ── Initialisierung ──────────────────────────────────────────────────────

    it('ist initial enabled', () => {
        assert.strictEqual(box.enabled, true);
    });

    it('isSpacePressed() ist initial false', () => {
        assert.strictEqual(box.isSpacePressed(), false);
    });

    it('_active ist initial false', () => {
        assert.strictEqual(box._active, false);
    });

    it('_dragging ist initial false', () => {
        assert.strictEqual(box._dragging, false);
    });

    // ── Leertasten-Handling ──────────────────────────────────────────────────

    it('_handleKeyDown setzt _spaceDown auf true', () => {
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        assert.strictEqual(box._spaceDown, true);
    });

    it('_handleKeyDown ignoriert andere Tasten', () => {
        box._handleKeyDown({ code: 'KeyA', target: {}, preventDefault: () => {} });
        assert.strictEqual(box._spaceDown, false);
    });

    it('_handleKeyUp setzt _spaceDown auf false', () => {
        box._spaceDown = true;
        box._handleKeyUp({ code: 'Space' });
        assert.strictEqual(box._spaceDown, false);
    });

    it('_handleKeyUp ignoriert andere Tasten', () => {
        box._spaceDown = true;
        box._handleKeyUp({ code: 'Enter' });
        assert.strictEqual(box._spaceDown, true);
    });

    it('_handleKeyDown ignoriert Space in editierbaren Feldern', () => {
        box._handleKeyDown({
            code: 'Space',
            target: { tagName: 'INPUT' },
            preventDefault: () => {},
        });
        assert.strictEqual(box._spaceDown, false);
    });

    // ── OrbitControls-Interaktion ─────────────────────────────────────────────

    it('deaktiviert OrbitControls wenn Space gedrückt wird', () => {
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        assert.strictEqual(orbitControls.enabled, false);
    });

    it('stellt OrbitControls wieder her wenn Space losgelassen wird', () => {
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        box._handleKeyUp({ code: 'Space' });
        assert.strictEqual(orbitControls.enabled, true);
    });

    it('deaktiviert OrbitControls nur einmal (kein zweifaches Wrapping)', () => {
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        // _previousControlsEnabled darf nicht false sein, da wir den
        // ursprünglichen (true) Wert gesichert haben sollen
        assert.strictEqual(box._previousControlsEnabled, true);
    });

    // ── Window-Blur ──────────────────────────────────────────────────────────

    it('_handleWindowBlur setzt _spaceDown auf false', () => {
        box._spaceDown = true;
        box._handleWindowBlur();
        assert.strictEqual(box._spaceDown, false);
    });

    it('_handleWindowBlur stellt OrbitControls wieder her', () => {
        box._handleKeyDown({ code: 'Space', target: {}, preventDefault: () => {} });
        box._handleWindowBlur();
        assert.strictEqual(orbitControls.enabled, true);
    });

    // ── Pointer-Down: Guard-Klauseln ─────────────────────────────────────────

    it('startet Drag nicht wenn Space nicht gedrückt ist', () => {
        canvas.fire('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: () => {}, stopPropagation: () => {} });
        assert.strictEqual(box._active, false);
    });

    it('startet Drag nicht wenn nicht enabled', () => {
        box.enabled = false;
        box._spaceDown = true;
        canvas.fire('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: () => {}, stopPropagation: () => {} });
        assert.strictEqual(box._active, false);
    });

    it('startet Drag nicht bei rechter Maustaste', () => {
        box._spaceDown = true;
        canvas.fire('pointerdown', { button: 2, pointerId: 1, clientX: 100, clientY: 100, preventDefault: () => {}, stopPropagation: () => {} });
        assert.strictEqual(box._active, false);
    });

    it('setzt _active auf true wenn Space gedrückt und linke Taste', () => {
        box._spaceDown = true;
        canvas.fire('pointerdown', {
            button: 0, pointerId: 1, clientX: 100, clientY: 100,
            ctrlKey: false, metaKey: false,
            preventDefault: () => {}, stopPropagation: () => {},
        });
        assert.strictEqual(box._active, true);
    });

    // ── Pointer-Move: Drag-Schwellwert ────────────────────────────────────────

    it('setzt _dragging erst nach Überschreiten des Schwellwerts', () => {
        box._spaceDown = true;
        canvas.fire('pointerdown', {
            button: 0, pointerId: 1, clientX: 100, clientY: 100,
            ctrlKey: false, metaKey: false,
            preventDefault: () => {}, stopPropagation: () => {},
        });
        // Kleine Bewegung – unter Schwellwert (5px)
        canvas.fire('pointermove', {
            pointerId: 1, clientX: 102, clientY: 101,
            preventDefault: () => {},
        });
        assert.strictEqual(box._dragging, false);
    });

    it('setzt _dragging auf true nach ausreichendem Ziehen', () => {
        box._spaceDown = true;
        canvas.fire('pointerdown', {
            button: 0, pointerId: 1, clientX: 100, clientY: 100,
            ctrlKey: false, metaKey: false,
            preventDefault: () => {}, stopPropagation: () => {},
        });
        canvas.fire('pointermove', {
            pointerId: 1, clientX: 120, clientY: 130,
            preventDefault: () => {},
        });
        assert.strictEqual(box._dragging, true);
    });

    // ── Pointer-Up: Abbruch ───────────────────────────────────────────────────

    it('_cancelDrag setzt _active und _dragging auf false', () => {
        box._active   = true;
        box._dragging = true;
        box._cancelDrag();
        assert.strictEqual(box._active,   false);
        assert.strictEqual(box._dragging, false);
    });

    it('Pointer-Up ohne Drag ruft setSelection nicht auf', () => {
        box._spaceDown = true;
        canvas.fire('pointerdown', {
            button: 0, pointerId: 1, clientX: 100, clientY: 100,
            ctrlKey: false, metaKey: false,
            preventDefault: () => {}, stopPropagation: () => {},
        });
        canvas.fire('pointerup', {
            button: 0, pointerId: 1, clientX: 101, clientY: 101,
            preventDefault: () => {},
        });
        assert.strictEqual(multi.setSelection.mock.callCount(), 0);
    });

    // ── _isEditableTarget ─────────────────────────────────────────────────────

    it('_isEditableTarget gibt false für normale Elemente zurück', () => {
        assert.strictEqual(box._isEditableTarget({ tagName: 'DIV', isContentEditable: false }), false);
    });

    it('_isEditableTarget gibt true für INPUT zurück', () => {
        assert.strictEqual(box._isEditableTarget({ tagName: 'INPUT' }), true);
    });

    it('_isEditableTarget gibt true für contentEditable zurück', () => {
        assert.strictEqual(box._isEditableTarget({ tagName: 'SPAN', isContentEditable: true }), true);
    });

    // ── canStart ─────────────────────────────────────────────────────────────

    it('startet nicht wenn canStart() false zurückgibt', () => {
        box.canStart = () => false;
        box._spaceDown = true;
        canvas.fire('pointerdown', {
            button: 0, pointerId: 1, clientX: 100, clientY: 100,
            ctrlKey: false, metaKey: false,
            preventDefault: () => {}, stopPropagation: () => {},
        });
        assert.strictEqual(box._active, false);
    });

    // ── dispose ──────────────────────────────────────────────────────────────

    it('dispose wirft keine Ausnahme', () => {
        assert.doesNotThrow(() => box.dispose());
    });

});
