// =====================================================================
// SyncStatusManager – Phase 9.5
//
// Verwaltet und sendet Benachrichtigungen über den Synchronisierungs-
// status zwischen lokalem Editor und Cloud.
//
// Zustandsmaschine:
//
//   LOCAL_ONLY ──► MODIFIED ──► SYNCING ──► SYNCED
//                     ▲            │          │
//                     └────────────┘          │
//                               ERROR ◄───────┘
//                               CONFLICT ◄────┘
//                               OFFLINE ◄─────┘
// =====================================================================


/**
 * Alle möglichen Synchronisierungszustände.
 */
export const SyncStatus = Object.freeze({
    /** Noch nie in der Cloud gespeichert. */
    LOCAL_ONLY: 'local-only',
    /** Lokale und Cloud-Stände stimmen überein. */
    SYNCED:     'synced',
    /** Lokale Änderungen, die noch nicht in der Cloud gespeichert wurden. */
    MODIFIED:   'modified',
    /** Aktuell wird synchronisiert. */
    SYNCING:    'syncing',
    /** Letzter Sync-Versuch ist fehlgeschlagen. */
    ERROR:      'error',
    /** Versionskonflikt erkannt. */
    CONFLICT:   'conflict',
    /** Keine Internetverbindung. */
    OFFLINE:    'offline',
});

const VALID_STATUSES = new Set(Object.values(SyncStatus));


export class SyncStatusManager {

    constructor() {
        this._status    = SyncStatus.LOCAL_ONLY;
        this._details   = {};
        this._listeners = new Set();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /** Aktueller Sync-Status. */
    get status()  { return this._status; }

    /** Zusätzliche Details zum aktuellen Status. */
    get details() { return { ...this._details }; }


    /**
     * Neuen Status setzen und alle Subscriber benachrichtigen.
     * @param {string} status – einer der SyncStatus-Werte
     * @param {object} [details]
     */
    setStatus(status, details = {}) {
        if (!VALID_STATUSES.has(status)) {
            throw new Error(`Unbekannter Sync-Status: "${status}"`);
        }
        this._status  = status;
        this._details = { ...details };
        this._notify();
    }


    /**
     * Auf Statusänderungen reagieren.
     * @param {(status: string, details: object) => void} fn
     * @returns {() => void} Unsubscribe-Funktion
     */
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }


    // Zustandsabfragen

    isSynced()      { return this._status === SyncStatus.SYNCED;     }
    isModified()    { return this._status === SyncStatus.MODIFIED;   }
    isSyncing()     { return this._status === SyncStatus.SYNCING;    }
    hasError()      { return this._status === SyncStatus.ERROR;      }
    isConflict()    { return this._status === SyncStatus.CONFLICT;   }
    isOffline()     { return this._status === SyncStatus.OFFLINE;    }
    isLocalOnly()   { return this._status === SyncStatus.LOCAL_ONLY; }

    /** Menschenlesbare Statusbeschreibung. */
    getStatusLabel() {
        return {
            [SyncStatus.LOCAL_ONLY]: 'Lokal',
            [SyncStatus.SYNCED]:     'Synchronisiert',
            [SyncStatus.MODIFIED]:   'Ungespeicherte Änderungen',
            [SyncStatus.SYNCING]:    'Wird synchronisiert …',
            [SyncStatus.ERROR]:      'Synchronisierungsfehler',
            [SyncStatus.CONFLICT]:   'Versionskonflikt',
            [SyncStatus.OFFLINE]:    'Offline',
        }[this._status] ?? this._status;
    }


    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _notify() {
        for (const fn of this._listeners) {
            try { fn(this._status, { ...this._details }); } catch { /* ignorieren */ }
        }
    }
}
