import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Minimales DOM-Mock ──────────────────────────────────────────────────────
// GroupToolbar greift nur auf document.getElementById zu – wir liefern
// vollständig steuerbare Fake-Elemente.

function makeElement(overrides = {}) {
    const handlers = {};
    const el = {
        disabled:    false,
        textContent: '',
        classList:   { toggle: mock.fn(), add: mock.fn(), remove: mock.fn() },
        addEventListener: mock.fn((event, cb) => { handlers[event] = cb; }),
        _handlers:   handlers,
        click() { handlers['click']?.(); },
        ...overrides,
    };
    return el;
}

let element; // wird im mock genutzt

function setupDOM() {
    const root     = makeElement();
    const info     = makeElement();
    const btnGroup     = makeElement();
    const btnUngroup   = makeElement();
    const btnCopy      = makeElement();
    const btnDuplicate = makeElement();
    const btnDelete    = makeElement();

    const elements = {
        'group-toolbar':           root,
        'selection-info':          info,
        'btn-group':               btnGroup,
        'btn-ungroup':             btnUngroup,
        'btn-copy-selection':      btnCopy,
        'btn-duplicate-selection': btnDuplicate,
        'btn-delete-selection':    btnDelete,
    };

    globalThis.document = {
        getElementById: mock.fn(id => elements[id] ?? null),
        createElement:  () => makeElement(),
        body:           { appendChild: () => {}, removeChild: () => {} },
    };

    return elements;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

import { GroupToolbar } from '../src/ui/GroupToolbar.js';

describe('GroupToolbar', () => {

    let toolbar, els;

    beforeEach(() => {
        els     = setupDOM();
        toolbar = new GroupToolbar();
    });

    // ── Konstruktor ──────────────────────────────────────────────────────────

    it('initialisiert root und info aus dem DOM', () => {
        assert.strictEqual(toolbar.root, els['group-toolbar']);
        assert.strictEqual(toolbar.info, els['selection-info']);
    });

    it('alle Callback-Properties sind initial null', () => {
        assert.strictEqual(toolbar.onGroup,     null);
        assert.strictEqual(toolbar.onUngroup,   null);
        assert.strictEqual(toolbar.onCopy,      null);
        assert.strictEqual(toolbar.onDuplicate, null);
        assert.strictEqual(toolbar.onDelete,    null);
        assert.strictEqual(toolbar.onPaste,     null);
    });

    // ── _bindEvents ──────────────────────────────────────────────────────────

    it('klick auf btn-group ruft onGroup auf', () => {
        const onGroup = mock.fn();
        toolbar.onGroup = onGroup;
        els['btn-group'].click();
        assert.strictEqual(onGroup.mock.callCount(), 1);
    });

    it('klick auf btn-ungroup ruft onUngroup auf', () => {
        const cb = mock.fn();
        toolbar.onUngroup = cb;
        els['btn-ungroup'].click();
        assert.strictEqual(cb.mock.callCount(), 1);
    });

    it('klick auf btn-copy-selection ruft onCopy auf', () => {
        const cb = mock.fn();
        toolbar.onCopy = cb;
        els['btn-copy-selection'].click();
        assert.strictEqual(cb.mock.callCount(), 1);
    });

    it('klick tut nichts wenn kein Callback registriert', () => {
        assert.doesNotThrow(() => els['btn-group'].click());
    });

    // ── updateSelectionInfo ───────────────────────────────────────────────────

    it('versteckt root wenn count=0', () => {
        toolbar.updateSelectionInfo(0);
        // toggle('hidden', true) muss aufgerufen worden sein
        const calls = els['group-toolbar'].classList.toggle.mock.calls;
        const lastCall = calls[calls.length - 1];
        assert.strictEqual(lastCall.arguments[0], 'hidden');
        assert.strictEqual(lastCall.arguments[1], true);
    });

    it('zeigt root wenn count>0', () => {
        toolbar.updateSelectionInfo(3);
        const calls = els['group-toolbar'].classList.toggle.mock.calls;
        const lastCall = calls[calls.length - 1];
        assert.strictEqual(lastCall.arguments[1], false);
    });

    it('setzt Infotext ohne Gruppenname', () => {
        toolbar.updateSelectionInfo(2);
        assert.strictEqual(els['selection-info'].textContent, '2 Bauteil(e) ausgewählt');
    });

    it('setzt Infotext mit Gruppenname', () => {
        toolbar.updateSelectionInfo(3, 'Gruppe-A');
        assert.ok(els['selection-info'].textContent.includes('Gruppe-A'));
        assert.ok(els['selection-info'].textContent.includes('3'));
    });

    it('leert Infotext wenn count=0', () => {
        toolbar.updateSelectionInfo(0);
        assert.strictEqual(els['selection-info'].textContent, '');
    });

    it('deaktiviert btn-group wenn count<2', () => {
        toolbar.updateSelectionInfo(1);
        assert.strictEqual(els['btn-group'].disabled, true);
    });

    it('deaktiviert btn-group wenn Gruppenname gesetzt', () => {
        toolbar.updateSelectionInfo(3, 'Gruppe-X');
        assert.strictEqual(els['btn-group'].disabled, true);
    });

    it('aktiviert btn-group wenn count>=2 und kein Gruppenname', () => {
        toolbar.updateSelectionInfo(2);
        assert.strictEqual(els['btn-group'].disabled, false);
    });

    it('deaktiviert btn-ungroup wenn kein Gruppenname', () => {
        toolbar.updateSelectionInfo(2);
        assert.strictEqual(els['btn-ungroup'].disabled, true);
    });

    it('aktiviert btn-ungroup wenn Gruppenname vorhanden', () => {
        toolbar.updateSelectionInfo(2, 'G');
        assert.strictEqual(els['btn-ungroup'].disabled, false);
    });

    it('deaktiviert copy/duplicate/delete wenn count=0', () => {
        toolbar.updateSelectionInfo(0);
        assert.strictEqual(els['btn-copy-selection'].disabled,      true);
        assert.strictEqual(els['btn-duplicate-selection'].disabled, true);
        assert.strictEqual(els['btn-delete-selection'].disabled,    true);
    });

    it('aktiviert copy/duplicate/delete wenn count>0', () => {
        toolbar.updateSelectionInfo(1);
        assert.strictEqual(els['btn-copy-selection'].disabled,      false);
        assert.strictEqual(els['btn-duplicate-selection'].disabled, false);
        assert.strictEqual(els['btn-delete-selection'].disabled,    false);
    });

    it('behandelt nicht-endliche count-Werte wie 0', () => {
        toolbar.updateSelectionInfo(NaN);
        const calls = els['group-toolbar'].classList.toggle.mock.calls;
        const lastCall = calls[calls.length - 1];
        assert.strictEqual(lastCall.arguments[1], true); // hidden=true
    });

});
