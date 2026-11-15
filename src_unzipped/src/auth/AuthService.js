// =====================================================================
// AuthService – Phase 9.1 (abstrakte Basisklasse)
//
// Definiert die einheitliche Schnittstelle für alle Authentifizierungs-
// anbieter. Konkrete Implementierungen (z. B. SupabaseAuthService)
// erben von dieser Klasse.
//
// Prinzip: Der Editor kennt nur AuthService, nicht den konkreten Anbieter.
// =====================================================================


/**
 * Fehlerklasse für Authentifizierungsfehler.
 */
export class AuthError extends Error {
    /**
     * @param {string} message
     * @param {string} [code]  – z. B. 'INVALID_CREDENTIALS', 'EMAIL_NOT_CONFIRMED'
     * @param {number} [status] – HTTP-Statuscode, falls vorhanden
     */
    constructor(message, code = 'UNKNOWN', status = null) {
        super(message);
        this.name  = 'AuthError';
        this.code  = code;
        this.status = status;
    }
}


/**
 * Bekannte Fehlercodes für Authentifizierungsfehler.
 */
export const AuthErrorCodes = {
    INVALID_CREDENTIALS:  'INVALID_CREDENTIALS',
    EMAIL_TAKEN:          'EMAIL_TAKEN',
    EMAIL_NOT_CONFIRMED:  'EMAIL_NOT_CONFIRMED',
    WEAK_PASSWORD:        'WEAK_PASSWORD',
    SESSION_EXPIRED:      'SESSION_EXPIRED',
    NOT_AUTHENTICATED:    'NOT_AUTHENTICATED',
    NETWORK:              'NETWORK',
    UNKNOWN:              'UNKNOWN',
};


/**
 * Abstrakte Basisklasse für Authentifizierungsdienste.
 *
 * Alle Methoden werfen standardmäßig einen Fehler und müssen von
 * konkreten Unterklassen überschrieben werden.
 */
export class AuthService {

    /**
     * Neuen Benutzer registrieren.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ id: string, email: string }>} – Benutzerobjekt
     */
    async register(email, password) {
        throw new Error('AuthService.register ist nicht implementiert.');
    }

    /**
     * Bestehenden Benutzer anmelden.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ id: string, email: string }>}
     */
    async login(email, password) {
        throw new Error('AuthService.login ist nicht implementiert.');
    }

    /**
     * Benutzer abmelden.
     * @returns {Promise<void>}
     */
    async logout() {
        throw new Error('AuthService.logout ist nicht implementiert.');
    }

    /**
     * Aktive Sitzung abfragen (für Session-Restore beim Neuladen).
     * @returns {Promise<{ user: { id: string, email: string } } | null>}
     */
    async getSession() {
        throw new Error('AuthService.getSession ist nicht implementiert.');
    }

    /**
     * Passwort-Reset per E-Mail anstoßen.
     * @param {string} email
     * @returns {Promise<void>}
     */
    async resetPassword(email) {
        throw new Error('AuthService.resetPassword ist nicht implementiert.');
    }

    /**
     * Callback bei Authentifizierungsänderungen registrieren.
     * @param {(event: string, session: object|null) => void} callback
     * @returns {() => void} – Unsubscribe-Funktion
     */
    onAuthStateChange(callback) {
        throw new Error('AuthService.onAuthStateChange ist nicht implementiert.');
    }
}


// ─────────────────────────────────────────────────────────────────────
// NullAuthService – Stub für den Fall, dass kein Anbieter konfiguriert
// ─────────────────────────────────────────────────────────────────────

/**
 * Stub-Implementierung: Alle Operationen scheitern sofort mit einer
 * verständlichen Fehlermeldung. Wird genutzt, wenn keine Supabase-
 * Konfiguration vorhanden ist.
 */
export class NullAuthService extends AuthService {
    static MSG = 'Cloud-Funktionen sind nicht konfiguriert.';

    async register()          { throw new AuthError(NullAuthService.MSG, AuthErrorCodes.UNKNOWN); }
    async login()             { throw new AuthError(NullAuthService.MSG, AuthErrorCodes.UNKNOWN); }
    async logout()            { /* Kein Fehler – Abmelden bei nicht-konfiguriertem Dienst ist OK */ }
    async getSession()        { return null; }
    async resetPassword()     { throw new AuthError(NullAuthService.MSG, AuthErrorCodes.UNKNOWN); }
    onAuthStateChange()       { return () => {}; }
}
