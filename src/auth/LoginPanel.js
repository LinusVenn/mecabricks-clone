// =====================================================================
// LoginPanel – Phase 9.2
// =====================================================================

export class LoginPanel {

    /**
     * @param {HTMLElement} container
     * @param {import('./AuthManager.js').AuthManager} authManager
     * @param {{ onSuccess?: () => void, onSwitchToRegister?: () => void }} [options]
     */
    constructor(container, authManager, options = {}) {
        if (!container) throw new Error('LoginPanel: Container ist erforderlich.');
        this.container  = container;
        this._auth      = authManager;
        this._onSuccess = options.onSuccess        ?? (() => {});
        this._onSwitch  = options.onSwitchToRegister ?? (() => {});
        this._build();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show() { this.container.style.display = ''; }
    hide() { this.container.style.display = 'none'; }

    /** Formular zurücksetzen und Fehlermeldung löschen. */
    reset() {
        if (this._emailInput)    this._emailInput.value    = '';
        if (this._passwordInput) this._passwordInput.value = '';
        this._showError('');
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'login-panel';

        const title = document.createElement('h3');
        title.textContent = 'Anmelden';
        this.container.appendChild(title);

        this._emailInput    = this._createInput('email',    'E-Mail-Adresse',  'email');
        this._passwordInput = this._createInput('password', 'Passwort',        'password');

        this._errorEl = document.createElement('p');
        this._errorEl.className = 'login-panel__error';
        this._errorEl.style.color = '#c00';
        this.container.appendChild(this._errorEl);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Anmelden';
        btn.addEventListener('click', () => this._handleSubmit());
        this.container.appendChild(btn);

        const switchLink = document.createElement('a');
        switchLink.href    = '#';
        switchLink.textContent = 'Noch kein Konto? Jetzt registrieren';
        switchLink.style.display = 'block';
        switchLink.style.marginTop = '8px';
        switchLink.addEventListener('click', e => { e.preventDefault(); this._onSwitch(); });
        this.container.appendChild(switchLink);

        const forgotLink = document.createElement('a');
        forgotLink.href           = '#';
        forgotLink.textContent    = 'Passwort vergessen?';
        forgotLink.style.display  = 'block';
        forgotLink.style.marginTop = '4px';
        forgotLink.style.fontSize  = '0.9em';
        forgotLink.addEventListener('click', e => { e.preventDefault(); this._handleForgotPassword(); });
        this.container.appendChild(forgotLink);

        this._forgotSuccessEl = document.createElement('p');
        this._forgotSuccessEl.style.color    = '#060';
        this._forgotSuccessEl.style.fontSize = '0.9em';
        this.container.appendChild(this._forgotSuccessEl);
    }

    _createInput(type, placeholder, autocomplete) {
        const input = document.createElement('input');
        input.type         = type;
        input.placeholder  = placeholder;
        input.autocomplete = autocomplete;
        input.style.display = 'block';
        input.style.width   = '100%';
        input.style.marginBottom = '8px';
        // Senden bei Enter
        input.addEventListener('keydown', e => { if (e.key === 'Enter') this._handleSubmit(); });
        this.container.appendChild(input);
        return input;
    }


    async _handleSubmit() {
        const email    = this._emailInput?.value?.trim()    ?? '';
        const password = this._passwordInput?.value ?? '';

        if (!email || !password) {
            this._showError('Bitte E-Mail und Passwort eingeben.');
            return;
        }

        this._showError('');

        try {
            await this._auth.login(email, password);
            this.reset();
            this._onSuccess();
        } catch (err) {
            this._showError(err.message ?? 'Anmeldung fehlgeschlagen.');
        }
    }

    async _handleForgotPassword() {
        const email = this._emailInput?.value?.trim() ?? '';
        this._forgotSuccessEl.textContent = '';
        this._showError('');

        if (!email) {
            this._showError('Bitte zuerst E-Mail-Adresse eingeben.');
            return;
        }

        try {
            await this._auth.resetPassword(email);
            this._forgotSuccessEl.textContent =
                'E-Mail zum Zurücksetzen des Passworts wurde versendet.';
        } catch (err) {
            // Keine Fehlermeldung ausgeben, die verrät ob die Adresse registriert ist.
            this._forgotSuccessEl.textContent =
                'Falls ein Konto mit dieser Adresse existiert, wurde eine E-Mail versendet.';
        }
    }

    _showError(msg) {
        if (this._errorEl) this._errorEl.textContent = msg;
    }
}
