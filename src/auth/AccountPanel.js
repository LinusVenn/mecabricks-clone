// =====================================================================
// AccountPanel – Phase 9.2
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
            this._emailEl.textContent = user?.email ?? 'Nicht angemeldet';
        }
    }


    _build() {
        this.container.innerHTML = '';
        this.container.className = 'account-panel';

        const title = document.createElement('h3');
        title.textContent = 'Konto';
        this.container.appendChild(title);

        this._emailEl = document.createElement('p');
        this._emailEl.className = 'account-panel__email';
        this.container.appendChild(this._emailEl);

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.textContent = 'Abmelden';
        logoutBtn.addEventListener('click', () => this._handleLogout());
        this.container.appendChild(logoutBtn);

        this._errorEl = document.createElement('p');
        this._errorEl.style.color = '#c00';
        this.container.appendChild(this._errorEl);

        this.update();
    }

    async _handleLogout() {
        this._errorEl.textContent = '';
        try {
            await this._auth.logout();
            this._onLogout();
        } catch (err) {
            this._errorEl.textContent = err.message ?? 'Abmelden fehlgeschlagen.';
        }
    }
}
