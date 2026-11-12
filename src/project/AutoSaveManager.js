
// Verzögerung in Millisekunden für das Debouncing
const DEBOUNCE_MS = 500;


// ========================================
// AutoSaveManager
// ========================================

/**
 * Verwaltet das automatische Speichern und Laden des aktuellen
 * Projekts über eine ProjectStorage-Instanz.
 *
 * Ablauf:
 *   1. Nach jeder Modelländerung wird scheduleSave() aufgerufen.
 *   2. scheduleSave() debounced den Aufruf – bei schnellen
 *      aufeinanderfolgenden Änderungen wird nur einmal gespeichert.
 *   3. save() ruft getProjectJSON() vom ProjectManager ab und
 *      schreibt die Daten (inkl. savedAt-Zeitstempel) über ProjectStorage.
 *
 * Endlosschleifen-Schutz:
 *   Während eines Ladevorgangs (Startup, Undo, Redo, Import) muss
 *   der aufrufende Code setRestoring(true) setzen. scheduleSave()
 *   und save() ignorieren Aufrufe in diesem Zustand.
 */
export class AutoSaveManager {

    /**
     * @param {object} projectManager  - Instanz des ProjectManager.
     *   Muss getProjectJSON() bereitstellen.
     * @param {object} storage         - Instanz von ProjectStorage.
     *   Kapselt den Zugriff auf localStorage (oder eine andere
     *   Speichertechnologie).
     */
    constructor(projectManager, storage) {

        this.projectManager = projectManager;

        // Storage-Abstraktionsschicht (ProjectStorage oder kompatibler Ersatz)
        this.storage = storage;

        // Wird aufgerufen, wenn sich der Speicherstatus ändert.
        // Signatur: onStatusChange(status, time, errorMessage)
        //   status: 'saving' | 'saved' | 'error' | 'idle'
        //   time:   Date-Objekt der letzten erfolgreichen Speicherung (oder null)
        //   errorMessage: Beschreibung des Fehlers (nur bei 'error')
        this.onStatusChange = null;

        // Interner Debounce-Timer
        this._debounceTimer = null;

        // Schutzvariable gegen Endlosschleifen beim Laden/Wiederherstellen
        this._isRestoring = false;
    }


    // ========================================
    // 1. Wiederherstellungs-Sperre
    // ========================================

    /**
     * Setzt die Schutzvariable für Ladevorgänge.
     * Muss auf true gesetzt werden, bevor ein Projekt geladen
     * oder ein History-Zustand wiederhergestellt wird, und
     * danach wieder auf false.
     *
     * @param {boolean} value
     */
    setRestoring(value) {
        this._isRestoring = !!value;
    }


    // ========================================
    // 2. Verzögertes Speichern (Debouncing)
    // ========================================

    /**
     * Plant einen Speichervorgang mit Debouncing.
     * Mehrfache schnelle Aufrufe (z. B. während einer Bewegung)
     * werden zu einem einzelnen Speichervorgang zusammengefasst.
     *
     * Wird vom HistoryManager über dessen onChange-Callback ausgelöst.
     */
    scheduleSave() {

        if (this._isRestoring) return;

        // Vorherigen Timer abbrechen
        clearTimeout(this._debounceTimer);

        // Status auf "Speichern läuft" setzen
        this._setStatus('saving');

        // Speichern nach kurzer Verzögerung
        this._debounceTimer = setTimeout(() => {
            this.save();
        }, DEBOUNCE_MS);
    }


    // ========================================
    // 3. Sofortiges Speichern
    // ========================================

    /**
     * Speichert das aktuelle Projekt sofort in localStorage.
     * Führt den Debounce-Timer nicht ab – nützlich z. B. beim
     * Schließen der Seite (beforeunload).
     *
     * @returns {boolean} true bei Erfolg, false bei Fehler
     */
    save() {

        if (this._isRestoring) return false;

        // Laufenden Debounce-Timer stoppen
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;

        try {

            // Aktuelles Projekt als JSON-String vom ProjectManager holen
            const jsonString = this.projectManager.getProjectJSON();

            // In Objekt umwandeln, um savedAt hinzuzufügen
            const projectData = JSON.parse(jsonString);

            // Zusätzlichen Zeitstempel für die lokale Speicherung setzen
            projectData.savedAt = new Date().toISOString();

            // Über ProjectStorage schreiben
            // (wirft QuotaExceededError wenn der Speicher voll ist)
            this.storage.save(projectData);

            const savedTime = new Date(projectData.savedAt);

            this._setStatus('saved', savedTime);

            console.log(
                'Automatisch gespeichert:',
                savedTime.toLocaleTimeString()
            );

            return true;

        } catch (error) {

            // Speicherlimit des Browsers überschritten
            if (error.name === 'QuotaExceededError') {

                console.error(
                    'Autosave fehlgeschlagen – Speicher voll:',
                    error
                );

                this._setStatus(
                    'error',
                    null,
                    'Browserspeicher voll – Projekt konnte nicht gespeichert werden.'
                );

            } else {

                console.error(
                    'Autosave fehlgeschlagen:',
                    error
                );

                this._setStatus(
                    'error',
                    null,
                    `Speichern fehlgeschlagen: ${error.message}`
                );

            }

            return false;
        }
    }


    // ========================================
    // 4. Gespeichertes Projekt laden
    // ========================================

    /**
     * Liest das gespeicherte Projekt aus localStorage und gibt
     * die geparsten Projektdaten zurück.
     *
     * @returns {object|null} Projektdaten-Objekt oder null,
     *   wenn kein Speicherstand vorhanden oder der JSON ungültig ist.
     */
    load() {

        try {

            // ProjectStorage.load() gibt bereits das geparste Objekt
            // zurück (oder null) und fängt JSON-Fehler intern ab.
            return this.storage.load();

        } catch (error) {

            console.error(
                'Fehler beim Lesen des Speichers:',
                error
            );

            return null;
        }
    }


    // ========================================
    // 5. Prüfen, ob ein Speicherstand vorhanden ist
    // ========================================

    /**
     * Gibt true zurück, wenn ein Speicherstand im localStorage
     * vorhanden ist.
     *
     * @returns {boolean}
     */
    hasSavedProject() {
        return this.storage.has();
    }


    // ========================================
    // 6. Gespeichertes Projekt löschen
    // ========================================

    /**
     * Löscht den lokalen Speicherstand.
     * Das aktuell im Editor geöffnete Modell bleibt davon unberührt.
     */
    deleteSavedProject() {
        this.storage.clear();
        console.log('Lokaler Speicherstand gelöscht.');
    }


    // ========================================
    // 7. Zeitpunkt der letzten Speicherung
    // ========================================

    /**
     * Gibt den Zeitpunkt der letzten Speicherung zurück.
     *
     * @returns {Date|null} Date-Objekt oder null,
     *   wenn noch nie gespeichert wurde.
     */
    getLastSavedTime() {

        const data = this.load();

        if (!data || !data.savedAt) return null;

        return new Date(data.savedAt);
    }


    // ========================================
    // 8. Ausstehenden Speichervorgang abschließen
    // ========================================

    /**
     * Schließt einen noch ausstehenden Debounce-Speichervorgang
     * sofort ab. Sinnvoll vor dem Schließen der Seite (beforeunload).
     */
    flush() {

        if (this._debounceTimer !== null) {
            this.save();
        }
    }


    // ========================================
    // Interner Hilfsmethode: Status-Callback
    // ========================================

    _setStatus(status, time = null, errorMessage = null) {

        if (typeof this.onStatusChange === 'function') {
            this.onStatusChange(status, time, errorMessage);
        }
    }
}
