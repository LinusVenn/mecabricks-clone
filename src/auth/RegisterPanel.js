// =====================================================================
// RegisterPanel – Phase 9.2
// =====================================================================

export class RegisterPanel {

    /**
     * @param {HTMLElement} container
     * @param {import('./AuthManager.js').AuthManager} authManager
     * @param {{ onSuccess?: () => void, onSwitchToLogin?: () => void }} [options]
     */
    constructor(container, authManager, options = {}) {
        if (!container) throw new Error('RegisterPanel: Container ist erforderlich.');
        this.container  = container;
        this._auth      = authManager;
        this._onSuccess = options.onSuccess       ?? (() => {});
        this._onSwitch  = options.onSwitchToLogin  ?? (() => {});
        this._build();
    }


    show() { this.container.style.display = ''; }
    hide() { this.container.style.display = 'none'; }

    reset() {
        [this._emailInput, this._passwordInput, this._confirmInput]
            .forEach(i => { if (i) i.value = ''; });
        this._showError('');
        this._showSuccess('');
    }


    _build() {
        this.container.innerHTML = '';
        this.container.className = 'register-panel';

        const title = document.createElement('h3');
        title.textContent = 'Konto erstellen';
        this.container.appendChild(title);

        this._emailInput   = this._createInput('email',    'E-Mail-Adresse',  'email');
        this._passwordInput= this._createInput('password', 'Passwort',        'new-password');
        this._confirmInput = this._createInput('password', 'Passwort bestätigen', 'new-password');

        this._errorEl = document.createElement('p');
        this._errorEl.className = 'register-panel__error';
        this._errorEl.style.color = '#c00';
        this.container.appendChild(this._errorEl);

        this._successEl = document.createElement('p');
        this._successEl.className = 'register-panel__success';
        this._successEl.style.color = '#060';
        this.container.appendChild(this._successEl);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Konto erstellen';
        btn.addEventListener('click', () => this._handleSubmit());
        this.container.appendChild(btn);

        const switchLink = document.createElement('a');
        switchLink.href = '#';
        switchLink.textContent = 'Bereits registriert? Anmelden';
        switchLink.style.display = 'block';
        switchLink.style.marginTop = '8px';
        switchLink.addEventListener('click', e => { e.preventDefault(); this._onSwitch(); });
        this.container.appendChild(switchLink);
    }

    _createInput(type, placeholder, autocomplete) {
        const input = document.createElement('input');
        input.type = type; input.placeholder = placeholder; input.autocomplete = autocomplete;
        input.style.display = 'block'; input.style.width = '100%'; input.style.marginBottom = '8px';
        input.addEventListener('keydown', e => { if (e.key === 'Enter') this._handleSubmit(); });
        this.container.appendChild(input);
        return input;
    }

    async _handleSubmit() {
        const email    = this._emailInput?.value?.trim() ?? '';
        const password = this._passwordInput?.value ?? '';
        const confirm  = this._confirmInput?.value  ?? '';

        if (!email || !password) { this._showError('Bitte alle Felder ausfüllen.'); return; }
        if (password !== confirm) { this._showError('Die Passwörter stimmen nicht überein.'); return; }
        if (password.length < 6)  { this._showError('Das Passwort muss mindestens 6 Zeichen lang sein.'); return; }

        this._showError(''); this._showSuccess('');

        try {
            await this._auth.register(email, password);
            this._showSuccess('Konto erstellt. Bitte bestätige deine E-Mail-Adresse.');
            this.reset();
            this._onSuccess();
        } catch (err) {
            this._showError(err.message ?? 'Registrierung fehlgeschlagen.');
        }
    }

    _showError(msg)   { if (this._errorEl)   this._errorEl.textContent = msg; }
    _showSuccess(msg) { if (this._successEl) this._successEl.textContent = msg; }
}
