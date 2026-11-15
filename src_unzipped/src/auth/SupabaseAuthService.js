// =====================================================================
// SupabaseAuthService – Phase 9.2
//
// Konkrete AuthService-Implementierung für Supabase.
//
// Voraussetzungen:
//   • @supabase/supabase-js muss installiert sein (npm install @supabase/supabase-js)
//   • VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen in .env gesetzt sein
//
// Sicherheitshinweis:
//   Der ANON_KEY ist ein öffentlicher Schlüssel für den Browser-Client.
//   Geheimschlüssel (service_role) dürfen NIEMALS im Frontend verwendet werden.
//   Zugriffsrechte werden durch Row Level Security (RLS) auf Datenbankebene
//   erzwungen, nicht durch clientseitige Prüfungen.
// =====================================================================

import { AuthService, AuthError, AuthErrorCodes } from './AuthService.js';


export class SupabaseAuthService extends AuthService {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     */
    constructor(supabaseClient) {
        super();
        if (!supabaseClient) throw new Error('SupabaseAuthService: supabaseClient ist erforderlich.');
        this._client    = supabaseClient;
        this._listeners = new Set();

        // Intern auf Supabase-Auth-Ereignisse lauschen
        this._client.auth.onAuthStateChange((event, session) => {
            for (const fn of this._listeners) {
                try { fn(event, session); } catch { /* ignorieren */ }
            }
        });
    }


    async register(email, password) {
        const { data, error } = await this._client.auth.signUp({ email, password });
        if (error) throw this._mapError(error);
        return data.user ? { id: data.user.id, email: data.user.email } : null;
    }


    async login(email, password) {
        const { data, error } = await this._client.auth.signInWithPassword({ email, password });
        if (error) throw this._mapError(error);
        return { id: data.user.id, email: data.user.email };
    }


    async logout() {
        const { error } = await this._client.auth.signOut();
        if (error) throw this._mapError(error);
    }


    async getSession() {
        const { data } = await this._client.auth.getSession();
        return data?.session ?? null;
    }


    async resetPassword(email) {
        const { error } = await this._client.auth.resetPasswordForEmail(email);
        if (error) throw this._mapError(error);
    }


    onAuthStateChange(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _mapError(supabaseError) {
        const msg    = supabaseError.message ?? 'Authentifizierungsfehler.';
        const status = supabaseError.status  ?? null;

        if (msg.includes('Invalid login') || msg.includes('invalid_grant')) {
            return new AuthError('E-Mail oder Passwort ist falsch.', AuthErrorCodes.INVALID_CREDENTIALS, status);
        }
        if (msg.includes('already registered') || msg.includes('already in use')) {
            return new AuthError('Diese E-Mail-Adresse ist bereits registriert.', AuthErrorCodes.EMAIL_TAKEN, status);
        }
        if (msg.includes('Email not confirmed')) {
            return new AuthError('Bitte bestätige deine E-Mail-Adresse.', AuthErrorCodes.EMAIL_NOT_CONFIRMED, status);
        }
        if (status === 401) {
            return new AuthError('Sitzung abgelaufen. Bitte melde dich erneut an.', AuthErrorCodes.SESSION_EXPIRED, 401);
        }

        return new AuthError(msg, AuthErrorCodes.UNKNOWN, status);
    }
}
