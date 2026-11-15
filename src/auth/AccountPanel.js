// =====================================================================
// AccountPanel – Phase I.5
//
// Zeigt die Kontoinformationen des angemeldeten Benutzers:
//   • E-Mail-Adresse
//   • E-Mail-Verifizierungsstatus
//   • Anzeigename (aus Supabase user_metadata)
//   • Passwort zurücksetzen (sendet E-Mail)
//   • Abmelden
//   • Konto löschen (optional – erfordert serverseitige Implementierung)
// =====================================================================

export class AccountPanel {

    /**
     * @param {HTMLElement} container
     * @param {import('./AuthManager.js').AuthManager} authManager
     * @param {{ onLogout?: () => void }} [options]
     */
    constructor(container, authManager, options = {}) {
        if (!container) throw new Error('AccountPanel: Container ist erforderlich.');
        this.container  = container;
        this._auth      = authManager;
        this._onLogout  = options.onLogout ?? (() => {});
        this._build();

        // Auf Auth-Zustandsänderungen reagieren
        this._auth.subscribe(() => this.update());
    }


    show() { this.container.style.display = ''; }
    hide() { this.container.style.display = 'none'; }

    /** UI-Zustand aktualisieren (nach Login/Logout). */
    update() {
        const user = this._auth.currentUser;
        if (this._emailEl) {
            this._emailEl.textContent = user?.email ?? '–';
        }
        if (this._displayNameEl) {
            const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || '';
            this._displayNameEl.textContent = name || '(kein Anzeigename gesetzt)';
        }
        if (this._verifiedEl) {
            const verified = !!(user?.email_confirmed_at || user?.confirmed_at);
            this._verifiedEl.textContent    = verified ? '✓ E-Mail verifiziert' : '⚠ E-Mail noch nicht verifiziert';
            this._verifiedEl.style.color    = verified ? '#060' : '#a60';
        }
        this._clearMessages();
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'account-panel';

        const title = document.createElement('h3');
        title.textContent = 'Mein Konto';
        this.container.appendChild(title);

        // Anzeigename
        const nameLabel = this._label('Anzeigename');
        this._displayNameEl = document.createElement('p');
        this._displayNameEl.className = 'account-panel__display-name';
        this.container.appendChild(nameLabel);
        this.container.appendChild(this._displayNameEl);

        // E-Mail
        const emailLabel = this._label('E-Mail-Adresse');
        this._emailEl = document.createElement('p');
        this._emailEl.className = 'account-panel__email';
        this.container.appendChild(emailLabel);
        this.container.appendChild(this._emailEl);

        // Verifizierungsstatus
        this._verifiedEl = document.createElement('p');
        this._verifiedEl.className = 'account-panel__verified';
        this._verifiedEl.style.fontSize = '0.9em';
        this.container.appendChild(this._verifiedEl);

        // Trennlinie
        this.container.appendChild(document.createElement('hr'));

        // Passwort zurücksetzen
        const resetBtn = document.createElement('button');
        resetBtn.type        = 'button';
        resetBtn.textContent = 'Passwort-Reset-E-Mail senden';
        resetBtn.style.marginBottom = '6px';
        resetBtn.addEventListener('click', () => this._handleResetPassword());
        this.container.appendChild(resetBtn);

        // Abmelden
        const logoutBtn = document.createElement('button');
        logoutBtn.type        = 'button';
        logoutBtn.textContent = 'Abmelden';
        logoutBtn.style.display     = 'block';
        logoutBtn.style.marginBottom = '6px';
        logoutBtn.addEventListener('click', () => this._handleLogout());
        this.container.appendChild(logoutBtn);

        // Konto löschen
        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.textContent = 'Konto löschen …';
        deleteBtn.style.color        = '#c00';
        deleteBtn.style.display      = 'block';
        deleteBtn.style.fontSize     = '0.9em';
        deleteBtn.style.marginTop    = '12px';
        deleteBtn.style.background   = 'transparent';
        deleteBtn.style.border       = '1px solid #c00';
        deleteBtn.addEventListener('click', () => this._handleDeleteAccount());
        this.container.appendChild(deleteBtn);

        // Nachrichten
        this._messageEl = document.createElement('p');
        this._messageEl.style.marginTop = '8px';
        this._messageEl.style.fontSize  = '0.9em';
        this.container.appendChild(this._messageEl);

        this._errorEl = document.createElement('p');
        this._errorEl.style.color   = '#c00';
        this._errorEl.style.fontSize = '0.9em';
        this.container.appendChild(this._errorEl);

        this.update();
    }

    _label(text) {
        const el = document.createElement('label');
        el.textContent = text;
        el.style.fontWeight = 'bold';
        el.style.display    = 'block';
        el.style.marginTop  = '8px';
        return el;
    }


    // ------------------------------------------------------------------
    // Aktionen
    // ------------------------------------------------------------------

    async _handleLogout() {
        this._clearMessages();
        try {
            await this._auth.logout();
            this._onLogout();
        } catch (err) {
            this._showError(err.message ?? 'Abmelden fehlgeschlagen.');
        }
    }

    async _handleResetPassword() {
        this._clearMessages();
        const email = this._auth.currentUser?.email;
        if (!email) {
            this._showError('Kein angemeldeter Benutzer gefunden.');
            return;
        }
        try {
            await this._auth.resetPassword(email);
            this._showMessage('Passwort-Reset-E-Mail wurde versendet.');
        } catch (err) {
            this._showError(err.message ?? 'Passwort-Reset fehlgeschlagen.');
        }
    }

    async _handleDeleteAccount() {
        this._clearMessages();
        const confirmed = window.confirm(
            'Möchtest du dein Konto wirklich dauerhaft löschen?\n\n' +
            'Diese Aktion ist unwiderruflich. Alle Cloud-Projekte werden ebenfalls gelöscht.'
        );
        if (!confirmed) return;

        try {
            await this._auth.deleteAccount();
            this._onLogout();
        } catch (err) {
            this._showError(
                err.message?.includes('Edge Function') || err.message?.includes('serverseitig')
                    ? 'Kontolöschung ist in dieser Konfiguration nicht verfügbar. Bitte kontaktiere den Support.'
                    : (err.message ?? 'Kontolöschung fehlgeschlagen.')
            );
        }
    }

    _clearMessages() {
        if (this._messageEl) this._messageEl.textContent = '';
        if (this._errorEl)   this._errorEl.textContent   = '';
    }

    _showMessage(msg) { if (this._messageEl) this._messageEl.textContent = msg; }
    _showError(msg)   { if (this._errorEl)   this._errorEl.textContent   = msg; }
}
