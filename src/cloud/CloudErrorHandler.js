// =====================================================================
// CloudErrorHandler – Phase 9.8
//
// Klassifiziert Cloud- und Authentifizierungsfehler, erstellt
// benutzerverstehbare Meldungen und protokolliert alle Fehler.
//
// Prinzip:
//   • Ein Fehler in einem optionalen Cloud-Feature darf den Editor
//     nicht unbenutzbar machen.
//   • Fehlermeldungen geben keine sensiblen Server-Details preis.
//   • Alle Fehler werden mit Zeitstempel und Kontext protokolliert.
// =====================================================================

import { CloudError, CloudErrorCodes } from './CloudService.js';
import { AuthError, AuthErrorCodes }   from '../auth/AuthService.js';


export class CloudErrorHandler {

    /**
     * @param {{
     *   onError?: (entry: ErrorEntry) => void
     *   maxErrors?: number
     * }} [options]
     */
    constructor({ onError = null, maxErrors = 100 } = {}) {
        this._onError   = onError;
        this._log       = [];
        this._maxErrors = Math.max(1, maxErrors);
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * Fehler verarbeiten: klassifizieren, protokollieren und ggf.
     * den onError-Callback aufrufen.
     * @param {Error} error
     * @param {string} [context]  – z. B. 'CloudSyncManager.saveToCloud'
     * @returns {ErrorEntry}
     */
    handle(error, context = '') {
        const entry = this._classify(error, context);

        this._log.push(entry);
        if (this._log.length > this._maxErrors) this._log.shift();

        console.error(`[CloudErrorHandler] ${context}:`, error);
        try { this._onError?.(entry); } catch { /* guard */ }

        return entry;
    }

    /**
     * fn sicher ausführen. Fehler werden abgefangen und über handle()
     * verarbeitet.
     * @template T
     * @param {() => T | Promise<T>} fn
     * @param {string} [context]
     * @param {T|null} [fallback]
     * @returns {Promise<T|null>}
     */
    async safeCall(fn, context = '', fallback = null) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return fallback;
        }
    }


    // Fehler-Klassifizierung (statische Hilfsmethoden)

    /** @param {Error} error */
    isNetworkError(error) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
        const msg = error?.message?.toLowerCase() ?? '';
        return msg.includes('fetch') || msg.includes('network') || msg.includes('netzwerk');
    }

    isConflictError(error) {
        return error?.code === CloudErrorCodes.CONFLICT ||
               (error instanceof CloudError && error.code === CloudErrorCodes.CONFLICT);
    }

    isAuthError(error) {
        return error instanceof AuthError ||
               error?.status === 401 ||
               error?.code === AuthErrorCodes.SESSION_EXPIRED ||
               error?.code === CloudErrorCodes.AUTH;
    }

    isNotFoundError(error) {
        return error?.status === 404 || error?.code === CloudErrorCodes.NOT_FOUND;
    }


    // Protokoll

    getLog()        { return [...this._log]; }
    getLastError()  { return this._log[this._log.length - 1] ?? null; }
    clearLog()      { this._log = []; }
    get errorCount(){ return this._log.length; }


    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _classify(error, context) {
        const base = {
            time:          Date.now(),
            context,
            message:       error?.message ?? String(error),
            originalError: error,
        };

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { ...base, code: CloudErrorCodes.OFFLINE,
                     userMessage: 'Keine Internetverbindung. Bitte prüfe deine Verbindung.' };
        }

        if (this.isConflictError(error)) {
            return { ...base, code: CloudErrorCodes.CONFLICT,
                     userMessage: 'Ein neuerer Projektstand ist in der Cloud vorhanden. Bitte wähle, welche Version behalten werden soll.' };
        }

        if (this.isAuthError(error)) {
            return { ...base, code: CloudErrorCodes.AUTH,
                     userMessage: 'Du bist nicht mehr angemeldet. Bitte melde dich erneut an.' };
        }

        if (error?.status === 403) {
            return { ...base, code: CloudErrorCodes.FORBIDDEN,
                     userMessage: 'Du hast keinen Zugriff auf dieses Projekt.' };
        }

        if (this.isNotFoundError(error)) {
            return { ...base, code: CloudErrorCodes.NOT_FOUND,
                     userMessage: 'Das Projekt wurde nicht gefunden.' };
        }

        if (this.isNetworkError(error)) {
            return { ...base, code: CloudErrorCodes.NETWORK,
                     userMessage: 'Verbindungsfehler. Bitte prüfe deine Internetverbindung.' };
        }

        if (error?.status >= 500) {
            return { ...base, code: CloudErrorCodes.SERVER_ERROR,
                     userMessage: 'Serverfehler. Bitte versuche es später erneut.' };
        }

        return { ...base, code: CloudErrorCodes.UNKNOWN,
                 userMessage: 'Ein unbekannter Fehler ist aufgetreten.' };
    }
}
