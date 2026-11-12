
// =====================================================================
// CopyPasteManager
//
// Kopieren, Einfügen und Duplizieren von Bauteilen, Mehrfachauswahlen
// und Gruppen.
//
// Regeln:
//   - Jede Kopie erhält neue eindeutige IDs.
//   - Interne Verbindungen (zwischen kopierten Steinen) werden
//     übernommen und auf die neuen IDs umgemappt.
//   - Externe Verbindungen (zu nicht-kopierten Steinen) werden verworfen.
//   - Kopien werden um PASTE_OFFSET_X Einheiten auf der X-Achse versetzt.
//   - Wenn die Quellsteine eine Gruppe bilden, wird die Kopie ebenfalls
//     als neue Gruppe angelegt.
// =====================================================================

/** Versatz der eingefügten Kopie in STUD_PITCH-Einheiten */
const PASTE_OFFSET_X = 2;

export class CopyPasteManager {

    constructor() {
        /**
         * Zwischenablage
         * @type {{
         *   bricks:      object[],
         *   connections: object[],
         *   groupName:   string | null
         * } | null}
         */
        this._clipboard = null;
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * Steine in die Zwischenablage kopieren.
     *
     * @param {import('../objects/Brick.js').Brick[]}                        bricks
     * @param {import('./ConnectionManager.js').ConnectionManager}           connectionManager
     * @param {import('./GroupManager.js').GroupManager}                     groupManager
     */
    copy(bricks, connectionManager, groupManager) {
        if (!bricks || bricks.length === 0) return;

        const brickIds = new Set(bricks.map(b => b.id));

        // Brick-Daten serialisieren
        const brickData = bricks.map(b => b.toData());

        // Nur interne Verbindungen (beide Enden innerhalb der Auswahl)
        const allConns = connectionManager.getConnections();
        const connData = allConns
            .filter(c => brickIds.has(c.sourceBrickId) && brickIds.has(c.targetBrickId))
            .map(c => ({ ...c }));

        // Gruppenname falls vorhanden
        const groupData = bricks.length > 0
            ? groupManager.getGroupByBrickId(bricks[0].id)
            : null;

        this._clipboard = {
            bricks:    brickData,
            connections: connData,
            groupName: groupData?.name ?? null,
        };
    }

    /** @returns {boolean} */
    hasClipboard() {
        return this._clipboard !== null && this._clipboard.bricks.length > 0;
    }

    /**
     * Zwischenablage in die Szene einfügen.
     * Alle neuen Steine erhalten neue IDs; interne Verbindungen werden
     * mit neuen Connection-IDs umgemappt.
     *
     * @param {import('../objects/PartLibrary.js').PartLibrary}              library
     * @param {import('./ConnectionManager.js').ConnectionManager}           connectionManager
     * @param {import('./GroupManager.js').GroupManager}                     groupManager
     * @param {import('../history/HistoryManager.js').HistoryManager | null} historyManager
     * @returns {import('../objects/Brick.js').Brick[]} — neu eingefügte Steine
     */
    paste(library, connectionManager, groupManager, historyManager) {
        if (!this.hasClipboard()) return [];

        const { bricks: brickDataArr, connections: connDataArr, groupName } =
            this._clipboard;

        // ID-Mapping: alte BrickId → neue BrickId
        const idMap = new Map();
        for (const bd of brickDataArr) {
            idMap.set(bd.id, this._generateBrickId());
        }

        // Steine mit neuem ID + Offset einfügen
        const newBricks = [];
        for (const bd of brickDataArr) {
            const newId  = idMap.get(bd.id);
            const brick  = library.addBrickFromData({
                id:       newId,
                type:     bd.type,
                color:    bd.color,
                position: {
                    x: bd.position.x + PASTE_OFFSET_X,
                    y: bd.position.y,
                    z: bd.position.z,
                },
                rotation: { ...bd.rotation },
            });
            if (brick) newBricks.push(brick);
        }

        // Interne Verbindungen mit neuen IDs rekonstruieren
        for (const cd of connDataArr) {
            const newSource = idMap.get(cd.sourceBrickId);
            const newTarget = idMap.get(cd.targetBrickId);
            if (newSource && newTarget) {
                connectionManager.createConnection(
                    newSource,
                    newTarget,
                    cd.position ? { ...cd.position } : null,
                    cd.type,
                );
            }
        }

        // Neue Gruppe anlegen wenn Quelle eine Gruppe war
        if (groupName && newBricks.length > 0) {
            groupManager.createGroup(newBricks, `${groupName} (Kopie)`);
        }

        historyManager?.saveState();
        return newBricks;
    }

    /**
     * Shortcut: copy + paste in einem Schritt (kein extra Ctrl+C nötig).
     *
     * @param {import('../objects/Brick.js').Brick[]}                        bricks
     * @param {import('./ConnectionManager.js').ConnectionManager}           connectionManager
     * @param {import('../objects/PartLibrary.js').PartLibrary}              library
     * @param {import('./GroupManager.js').GroupManager}                     groupManager
     * @param {import('../history/HistoryManager.js').HistoryManager | null} historyManager
     * @returns {import('../objects/Brick.js').Brick[]}
     */
    duplicate(bricks, connectionManager, library, groupManager, historyManager) {
        this.copy(bricks, connectionManager, groupManager);
        return this.paste(library, connectionManager, groupManager, historyManager);
    }

    /** Zwischenablage leeren. */
    clearClipboard() {
        this._clipboard = null;
    }


    // ------------------------------------------------------------------
    // Intern
    // ------------------------------------------------------------------

    _generateBrickId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `brick-${crypto.randomUUID()}`;
        }
        return `brick-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
}
