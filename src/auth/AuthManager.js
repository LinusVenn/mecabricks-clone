// =====================================================================
// AuthManager – Phase 9.2
//
// Verwaltet den Benutzerstatus und bietet dem restlichen Editor eine
// einheitliche Schnittstelle für alle Authentifizierungsoperationen.
//
// Prinzip:
//   • AuthManager hält den aktuellen Benutzer im Speicher.
//   • Passwörter werden NIEMALS gespeichert.
//   • Sitzungstokens bleiben ausschließlich beim AuthService.
//   • Ohne Anmeldung ist der Editor weiterhin vollständig lokal nutzbar.
// =====================================================================

import { AuthError, AuthErrorCodes } from './AuthService.js';


export class AuthManager {

    /**
     * @param {import('./AuthService.js').AuthService} authService
     */
    constructor(authService) {
        if (!authService) throw new Error('AuthManager: authService ist erforderlich.');

        this._service  = authService;
        this._user     = null;          // { id, email } oder null
        this._listeners = new Set();

        // Sitzungsänderungen des Providers abonnieren
        this._unsubscribe = this._service.onAuthStateChange((event, session) => {
            this._user = session?.user ?? null;
            this._notify(event, this._user);
        });
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /** Aktuell angemeldeter Benutzer oder null. */
    get currentUser()  { return this._user ? { ...this._user } : null; }

    /** true, wenn ein Benutzer angemeldet ist. */
    get isLoggedIn()   { return this._user !== null; }


    /**
     * Neuen Benutzer registrieren.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ id: string, email: string }>}
     */
    async register(email, password) {
        this._validateCredentials(email, password);
        return await this._service.register(email, password);
    }


    /**
     * Benutzer anmelden.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ id: string, email: string }>}
     */
    async login(email, password) {
        this._validateCredentials(email, password);
        return await this._service.login(email, password);
    }


    /**
     * Benutzer abmelden.
     * @returns {Promise<void>}
     */
    async logout() {
        await this._service.logout();
        this._user = null;
        this._notify('SIGNED_OUT', null);
    }


    /**
     * Passwort-Reset-E-Mail senden.
     * @param {string} email
     */
    async resetPassword(email) {
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            throw new AuthError('Ungültige E-Mail-Adresse.', AuthErrorCodes.UNKNOWN);
        }
        return await this._service.resetPassword(email);
    }


    /**
     * Gespeicherte Sitzung beim Seitenstart wiederherstellen.
     * Gibt den Benutzer zurück oder null (ohne Fehler zu werfen).
     * @returns {Promise<{ id: string, email: string } | null>}
     */
    async restoreSession() {
        try {
            const session = await this._service.getSession();
            if (session?.user) {
                this._user = session.user;
                this._notify('SESSION_RESTORED', this._user);
                return { ...this._user };
            }
        } catch {
            // Sitzungswiederherstellung scheitert still – lokaler Betrieb
        }
        return null;
    }


    /**
     * Auf Authentifizierungsänderungen reagieren.
     * @param {(event: string, user: object|null) => void} callback
     * @returns {() => void} Unsubscribe-Funktion
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    /** Alle Ressourcen freigeben. */
    dispose() {
        this._unsubscribe?.();
        this._listeners.clear();
    }


    // ------------------------------------------------------------------
    // Hilfsmethoden
    // ------------------------------------------------------------------

    _validateCredentials(email, password) {
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            throw new AuthError('Ungültige E-Mail-Adresse.', AuthErrorCodes.UNKNOWN);
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            throw new AuthError(
                'Das Passwort muss mindestens 6 Zeichen lang sein.',
                AuthErrorCodes.WEAK_PASSWORD
            );
        }
    }

    _notify(event, user) {
        for (const fn of this._listeners) {
            try { fn(event, user); } catch { /* ignorieren */ }
        }
    }
}
