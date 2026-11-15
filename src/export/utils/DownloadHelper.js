/**
 * DownloadHelper – Erstellt Downloads im Browser (Phase H)
 *
 * Stellt geräteübergreifend kompatible Download-Methoden bereit.
 *
 * Alle Methoden sind statisch und erzeugen keinen Zustand.
 * Unterstützt Text-, Binär-, JSON- und rohe Blob-Downloads.
 *
 * @module DownloadHelper
 */

export class DownloadHelper {

    // -------------------------------------------------------------------------
    // Kern-Methode
    // -------------------------------------------------------------------------

    /**
     * Löst einen Browser-Download für ein Blob-Objekt aus.
     *
     * Dies ist die zentrale Methode, auf die alle anderen aufbauen.
     * Erzeugt eine temporäre Objekt-URL, simuliert einen Anker-Klick
     * und gibt die URL danach sofort wieder frei.
     *
     * @param {Blob}   blob     - Der Inhalt des Downloads.
     * @param {string} filename - Der vorgeschlagene Dateiname.
     * @returns {void}
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href     = url;
        anchor.download = DownloadHelper.sanitizeFilename(filename);

        // Muss im DOM sein, damit Firefox den Klick akzeptiert
        anchor.style.display = 'none';
        document.body.appendChild(anchor);

        try {
            anchor.click();
        } finally {
            document.body.removeChild(anchor);
            // Kurz warten, damit der Browser den Download starten kann,
            // bevor die URL widerrufen wird.
            setTimeout(() => URL.revokeObjectURL(url), 150);
        }
    }

    // -------------------------------------------------------------------------
    // Text-Download
    // -------------------------------------------------------------------------

    /**
     * Lädt einen Textinhalt als Datei herunter.
     *
     * @param {string} content   - Der Textinhalt (z.B. LDraw, CSV, HTML).
     * @param {string} filename  - Vorgeschlagener Dateiname.
     * @param {string} [mimeType='text/plain'] - MIME-Typ des Downloads.
     * @returns {void}
     */
    static downloadText(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        DownloadHelper.downloadBlob(blob, filename);
    }

    // -------------------------------------------------------------------------
    // Binär-Download
    // -------------------------------------------------------------------------

    /**
     * Lädt einen binären Puffer als Datei herunter.
     *
     * Akzeptiert sowohl `ArrayBuffer` als auch `Uint8Array` als Eingabe.
     *
     * @param {ArrayBuffer|Uint8Array} buffer   - Binäre Rohdaten.
     * @param {string}                 filename - Vorgeschlagener Dateiname.
     * @param {string} [mimeType='application/octet-stream'] - MIME-Typ.
     * @returns {void}
     */
    static downloadBinary(buffer, filename, mimeType = 'application/octet-stream') {
        // Uint8Array direkt verwenden, ArrayBuffer über Uint8Array wrappen
        const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const blob = new Blob([data], { type: mimeType });
        DownloadHelper.downloadBlob(blob, filename);
    }

    // -------------------------------------------------------------------------
    // JSON-Download
    // -------------------------------------------------------------------------

    /**
     * Serialisiert ein JavaScript-Objekt und lädt es als `.json`-Datei herunter.
     *
     * @param {object} data          - Das zu serialisierende Objekt.
     * @param {string} filename      - Vorgeschlagener Dateiname.
     * @param {number} [indent=2]    - Einrückungstiefe für `JSON.stringify`.
     * @returns {void}
     */
    static downloadJSON(data, filename, indent = 2) {
        const json = JSON.stringify(data, null, indent);
        DownloadHelper.downloadText(json, filename, 'application/json');
    }

    // -------------------------------------------------------------------------
    // Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Bereinigt einen Dateinamen für den sicheren Einsatz im Browser-Download.
     *
     * Entfernt oder ersetzt Zeichen, die in Dateinamen problematisch sind:
     * Schrägstriche, Backslashes, Null-Bytes, Steuerzeichen und führende/
     * nachgestellte Leerzeichen. Fällt auf `'export'` zurück, wenn das
     * Ergebnis leer ist.
     *
     * @param {string} name - Der rohe Dateiname.
     * @returns {string}    - Der bereinigte, sichere Dateiname.
     */
    static sanitizeFilename(name) {
        if (typeof name !== 'string') return 'export';

        let safe = name
            // Verzeichnis-Trennzeichen entfernen
            .replace(/[/\\]/g, '_')
            // Null-Bytes und ASCII-Steuerzeichen entfernen
            // eslint-disable-next-line no-control-regex
            .replace(/[\x00-\x1F\x7F]/g, '')
            // Unter Windows verbotene Zeichen ersetzen
            .replace(/[:<>"|?*]/g, '_')
            // Führende/nachgestellte Leerzeichen und Punkte entfernen
            .trim()
            .replace(/^\.+/, '')
            .replace(/\.+$/, '');

        return safe.length > 0 ? safe : 'export';
    }
}
