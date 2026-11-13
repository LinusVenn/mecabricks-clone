import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorShortcutManager } from '../src/ui/EditorShortcutManager.js';


// Minimales EventTarget-Mock
class MockEventTarget {
    constructor() {
        this._listeners = {};
    }
    addEventListener(type, fn) {
        (this._listeners[type] = this._listeners[type] ?? []).push(fn);
    }
    removeEventListener(type, fn) {
        this._listeners[type] = (this._listeners[type] ?? []).filter(f => f !== fn);
    }
    dispatch(event) {
        for (const fn of (this._listeners[event.type] ?? [])) fn(event);
    }
}

function makeEvent({
    key         = 'a',
    ctrlKey     = false,
    metaKey     = false,
    shiftKey    = false,
    altKey      = false,
    target      = { tagName: 'BODY' },
    defaultPrevented = false
} = {}) {
    let _prevented = false;
    return {
        key,
        ctrlKey,
        metaKey,
        shiftKey,
        altKey,
        type: 'keydown',
        target,
        get defaultPrevented() { return _prevented; },
        preventDefault() { _prevented = true; }
    };
}


describe('EditorShortcutManager', () => {

    let target, manager;

    beforeEach(() => {
        target  = new MockEventTarget();
        manager = new EditorShortcutManager(target);
    });


    // ------------------------------------------------------------------
    // Grundverhalten
    // ------------------------------------------------------------------

    it('registriert Keydown-Listener auf dem Target', () => {
        assert.strictEqual(target._listeners['keydown']?.length, 1);
    });

    it('dispose entfernt alle Listener', () => {
        manager.dispose();
        assert.strictEqual((target._listeners['keydown'] ?? []).length, 0);
    });

    it('dispose leert die Shortcut-Liste', () => {
        manager.register({ key: 'g' }, () => {});
        manager.dispose();
        // Zweiter Aufruf ohne Fehler
        assert.doesNotThrow(() => manager.dispose());
    });

    it('kann ohne Target instanziiert werden', () => {
        assert.doesNotThrow(() => new EditorShortcutManager(null));
    });


    // ------------------------------------------------------------------
    // Shortcut-Erkennung
    // ------------------------------------------------------------------

    it('löst Callback für passende Taste aus', () => {
        let fired = false;
        manager.register({ key: 'g' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g' }));
        assert.strictEqual(fired, true);
    });

    it('löst Callback nicht für andere Taste aus', () => {
        let fired = false;
        manager.register({ key: 'g' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'r' }));
        assert.strictEqual(fired, false);
    });

    it('Tastenerkennung ist case-insensitive', () => {
        let fired = false;
        manager.register({ key: 'G' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g' }));
        assert.strictEqual(fired, true);
    });

    it('Ctrl-Modifier wird korrekt abgeglichen', () => {
        let withCtrl = false;
        let withoutCtrl = false;
        manager.register({ key: 'a', ctrl: true  }, () => { withCtrl    = true; });
        manager.register({ key: 'a', ctrl: false }, () => { withoutCtrl = true; });
        target.dispatch(makeEvent({ key: 'a', ctrlKey: true }));
        assert.strictEqual(withCtrl,    true);
        assert.strictEqual(withoutCtrl, false);
    });

    it('Shift-Modifier wird korrekt abgeglichen', () => {
        let fired = false;
        manager.register({ key: 'g', ctrl: true, shift: true }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g', ctrlKey: true })); // kein shift → kein Treffer
        assert.strictEqual(fired, false);
        target.dispatch(makeEvent({ key: 'g', ctrlKey: true, shiftKey: true }));
        assert.strictEqual(fired, true);
    });

    it('Meta-Taste gilt als Ctrl-Ersatz', () => {
        let fired = false;
        manager.register({ key: 'a', ctrl: true }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'a', metaKey: true }));
        assert.strictEqual(fired, true);
    });

    it('nur erster passender Shortcut wird ausgeführt', () => {
        let count = 0;
        manager.register({ key: 'x' }, () => count++);
        manager.register({ key: 'x' }, () => count++);
        target.dispatch(makeEvent({ key: 'x' }));
        assert.strictEqual(count, 1);
    });


    // ------------------------------------------------------------------
    // Eingabefeld-Schutz
    // ------------------------------------------------------------------

    it('Shortcut wird nicht in INPUT-Feldern ausgelöst', () => {
        let fired = false;
        manager.register({ key: 'g' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g', target: { tagName: 'INPUT' } }));
        assert.strictEqual(fired, false);
    });

    it('Shortcut wird nicht in TEXTAREA ausgelöst', () => {
        let fired = false;
        manager.register({ key: 'g' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g', target: { tagName: 'TEXTAREA' } }));
        assert.strictEqual(fired, false);
    });

    it('allowInInput ermöglicht Shortcut in Eingabefeldern', () => {
        let fired = false;
        manager.register({ key: 'g', allowInInput: true }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g', target: { tagName: 'INPUT' } }));
        assert.strictEqual(fired, true);
    });

    it('contentEditable blockiert Shortcuts', () => {
        let fired = false;
        manager.register({ key: 'g' }, () => { fired = true; });
        target.dispatch(makeEvent({ key: 'g', target: { tagName: 'DIV', isContentEditable: true } }));
        assert.strictEqual(fired, false);
    });


    // ------------------------------------------------------------------
    // preventDefault
    // ------------------------------------------------------------------

    it('ruft event.preventDefault() auf (Standardverhalten)', () => {
        manager.register({ key: 'g' }, () => {});
        const event = makeEvent({ key: 'g' });
        target.dispatch(event);
        assert.strictEqual(event.defaultPrevented, true);
    });

    it('preventDefault kann deaktiviert werden', () => {
        manager.register({ key: 'g', preventDefault: false }, () => {});
        const event = makeEvent({ key: 'g' });
        target.dispatch(event);
        assert.strictEqual(event.defaultPrevented, false);
    });


    // ------------------------------------------------------------------
    // Deregistrierung
    // ------------------------------------------------------------------

    it('unregister über zurückgegebenes Handle', () => {
        let fired = false;
        const handle = manager.register({ key: 'g' }, () => { fired = true; });
        handle.unregister();
        target.dispatch(makeEvent({ key: 'g' }));
        assert.strictEqual(fired, false);
    });

    it('unregister eines nicht registrierten Handles wirft keinen Fehler', () => {
        const handle = manager.register({ key: 'h' }, () => {});
        handle.unregister();
        assert.doesNotThrow(() => handle.unregister());
    });


    // ------------------------------------------------------------------
    // Fehlerresilienz
    // ------------------------------------------------------------------

    it('Fehler im Callback blockiert nicht nachfolgende Shortcuts', () => {
        manager.register({ key: 'e' }, () => { throw new Error('oops'); });
        // Ein zweiter Handler für dieselbe Taste – aber durch "first-match-wins"
        // würde er nie erreicht. Teste daher zwei VERSCHIEDENE Tasten.
        let secondFired = false;
        manager.register({ key: 'f' }, () => { secondFired = true; });

        assert.doesNotThrow(() => {
            target.dispatch(makeEvent({ key: 'e' }));
        });
        target.dispatch(makeEvent({ key: 'f' }));
        assert.strictEqual(secondFired, true);
    });
});
