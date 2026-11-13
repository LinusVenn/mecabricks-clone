// =====================================================================
// AccountMenu – Phase 9.4
//
// Kleines Menü in der Kopfzeile des Editors, das den Anmeldestatus
// anzeigt und Login/Logout-Funktionen bereitstellt.
// =====================================================================

export class AccountMenu {

    /**
     * @param {HTMLElement} container
     * @param {import('../auth/AuthManager.js').AuthManager} authManager
     * @param {{
     *   onShowLogin?:    () => void
     *   onShowAccount?:  () => void
     * }} [options]
     */
    constructor(container, authManager, options = {}) {
        if (!container) throw new Error('AccountMenu: Container ist erforderlich.');
        this.container     = container;
        this._auth         = authManager;
        this._onShowLogin  = options.onShowLogin   ?? (() => {});
        this._onShowAccount= options.onShowAccount ?? (() => {});
        this._build();
        this._auth.subscribe(() => this.update());
    }


    /** UI nach Auth-Zustandsänderung aktualisieren. */
    update() {
        const user = this._auth.currentUser;
        if (this._statusEl) {
            this._statusEl.textContent = user
                ? `Angemeldet: ${user.email}`
                : 'Nicht angemeldet';
        }
        if (this._loginBtn)   this._loginBtn.style.display   = user ? 'none' : '';
        if (this._accountBtn) this._accountBtn.style.display = user ? '' : 'none';
    }


    _build() {
        this.container.innerHTML = '';
        this.container.className = 'account-menu';

        this._statusEl = document.createElement('span');
        this._statusEl.className = 'account-menu__status';
        this.container.appendChild(this._statusEl);

        this._loginBtn = document.createElement('button');
        this._loginBtn.type = 'button';
        this._loginBtn.textContent = 'Anmelden';
        this._loginBtn.addEventListener('click', () => this._onShowLogin());
        this.container.appendChild(this._loginBtn);

        this._accountBtn = document.createElement('button');
        this._accountBtn.type = 'button';
        this._accountBtn.textContent = 'Konto';
        this._accountBtn.addEventListener('click', () => this._onShowAccount());
        this.container.appendChild(this._accountBtn);

        this.update();
    }
}
