
// ========================================
// Konstante für den localStorage-Schlüssel
// ========================================

const DEFAULT_KEY = 'lego-editor-project';


// ========================================
// ProjectStorage
// ========================================

/**
 * Schlanke Abstraktionsschicht über localStorage.
 *
 * Kapselt alle direkten Zugriffe auf localStorage, sodass
 * später auf eine andere Speichertechnologie (z. B. IndexedDB)
 * umgestellt werden kann, ohne andere Klassen anfassen zu müssen.
 *
 * Speichert und liest geparste Objekte – kein JSON-Handling
 * außerhalb dieser Klasse nötig.
 *
 * Fehlerverhalten:
 *   save()  – wirft Fehler weiter (z. B. QuotaExceededError),
 *             damit der Aufrufer auf Speicher-Vollläufe reagieren kann.
 *   load()  – gibt null zurück, wenn kein Eintrag vorhanden oder
 *             der gespeicherte JSON-Text ungültig ist.
 *   clear() – scheitert still, wenn der Eintrag nicht vorhanden ist.
 *   has()   – gibt false zurück, wenn localStorage nicht verfügbar ist.
 */
export class ProjectStorage {

    /**
     * @param {string} key – Schlüssel in localStorage.
     *   Standardwert: 'lego-editor-project'.
     *   Kann für Tests oder mehrere Projekte überschrieben werden.
     */
    constructor(key = DEFAULT_KEY) {
        this.key = key;
    }


    // ========================================
    // 1. Projekt speichern
    // ========================================

    /**
     * Speichert ein Objekt in localStorage.
     *
     * Wirft einen Fehler, wenn der Speicher voll ist
     * (QuotaExceededError) oder localStorage nicht verfügbar ist.
     *
     * @param {object} data – Zu speicherndes Objekt (wird in JSON umgewandelt).
     * @throws {DOMException} Bei QuotaExceededError oder ähnlichen Fehlern.
     */
    save(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    }


    // ========================================
    // 2. Projekt laden
    // ========================================

    /**
     * Lädt das gespeicherte Objekt aus localStorage.
     *
     * Gibt null zurück, wenn kein Eintrag unter dem Schlüssel
     * vorhanden ist oder der gespeicherte JSON-Text ungültig ist
     * (z. B. nach manuellem Editieren des Speichers).
     *
     * @returns {object|null} Geparste Projektdaten oder null.
     */
    load() {

        let raw;

        try {
            raw = localStorage.getItem(this.key);
        } catch {
            // localStorage nicht verfügbar (z. B. im privaten Modus
            // mit deaktivierten Cookies)
            return null;
        }

        if (raw === null) return null;

        try {
            return JSON.parse(raw);
        } catch {
            // Gespeicherter Text ist kein gültiges JSON
            console.warn(
                `ProjectStorage: Ungültiger JSON-Eintrag unter "${this.key}".`
            );
            return null;
        }
    }


    // ========================================
    // 3. Speicherstand löschen
    // ========================================

    /**
     * Entfernt den Eintrag aus localStorage.
     * Scheitert still, wenn kein Eintrag vorhanden ist.
     */
    clear() {
        try {
            localStorage.removeItem(this.key);
        } catch {
            // localStorage nicht verfügbar – ignorieren
        }
    }


    // ========================================
    // 4. Prüfen ob ein Speicherstand vorhanden ist
    // ========================================

    /**
     * Gibt true zurück, wenn ein Eintrag unter dem Schlüssel
     * vorhanden ist.
     *
     * @returns {boolean}
     */
    has() {
        try {
            return localStorage.getItem(this.key) !== null;
        } catch {
            return false;
        }
    }
}
