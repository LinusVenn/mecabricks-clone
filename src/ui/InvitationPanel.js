// =====================================================================
// InvitationPanel – Phase J (Kollaboration)
//
// Panel zur Anzeige ausstehender Einladungen für den aktuellen Benutzer.
// Ermöglicht Annehmen und Ablehnen von Einladungen.
// =====================================================================

export class InvitationPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   sharingManager: import('../collaboration/SharingManager.js').SharingManager
     *   authManager:    import('../auth/AuthManager.js').AuthManager
     *   onAccepted?:    (projectId: string) => void
     * }} options
     */
    constructor(container, {
        sharingManager,
        authManager,
        onAccepted = () => {},
    }) {
        if (!container) throw new Error('InvitationPanel: Container fehlt.');
        this.container   = container;
        this._sharing    = sharingManager;
        this._auth       = authManager;
        this._onAccepted = onAccepted;

        this._invitations = [];

        this._build();

        // Automatisch aktualisieren wenn Benutzer sich anmeldet
        this._auth.subscribe?.(() => this.refresh());
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    /** Einladungen neu laden. */
    async refresh() {
        if (!this._auth.isLoggedIn) {
            this._renderEmpty('Bitte anmelden, um Einladungen zu sehen.');
            return;
        }

        this._setLoading(true);
        this._showMessage('', 'info');
        try {
            this._invitations = await this._sharing.getUserInvitations();
            this._renderList();
        } catch (err) {
            this._renderEmpty(`Fehler beim Laden: ${err.message}`);
        } finally {
            this._setLoading(false);
        }
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'invitation-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'invitation-panel__header';

        const title = document.createElement('h3');
        title.textContent = 'Einladungen';
        title.className   = 'invitation-panel__title';
        header.appendChild(title);

        const refreshBtn = document.createElement('button');
        refreshBtn.type        = 'button';
        refreshBtn.textContent = 'Aktualisieren';
        refreshBtn.className   = 'invitation-panel__refresh-btn';
        refreshBtn.addEventListener('click', () => this.refresh());
        header.appendChild(refreshBtn);

        this.container.appendChild(header);

        // Ladeindikator
        this._loadingEl = document.createElement('p');
        this._loadingEl.className    = 'invitation-panel__loading';
        this._loadingEl.textContent  = 'Wird geladen …';
        this._loadingEl.style.display = 'none';
        this.container.appendChild(this._loadingEl);

        // Meldungsbereich
        this._messageEl = document.createElement('p');
        this._messageEl.className = 'invitation-panel__message';
        this.container.appendChild(this._messageEl);

        // Einladungsliste
        this._listEl = document.createElement('ul');
        this._listEl.className = 'invitation-panel__list';
        this.container.appendChild(this._listEl);

        this.refresh();
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderList() {
        this._listEl.innerHTML = '';
        this._messageEl.textContent = '';

        if (this._invitations.length === 0) {
            this._renderEmpty('Keine ausstehenden Einladungen.');
            return;
        }

        for (const inv of this._invitations) {
            const li = document.createElement('li');
            li.className = 'invitation-panel__item';

            // Projektname
            const projectSpan = document.createElement('span');
            projectSpan.className   = 'invitation-panel__project-name';
            projectSpan.textContent = inv.projectName || inv.projectId || '(Unbekanntes Projekt)';
            li.appendChild(projectSpan);

            // Einladender
            const ownerSpan = document.createElement('span');
            ownerSpan.className   = 'invitation-panel__owner';
            ownerSpan.textContent = inv.ownerName
                ? `von ${inv.ownerName}`
                : '';
            li.appendChild(ownerSpan);

            // Angebotene Rolle
            const roleSpan = document.createElement('span');
            roleSpan.className   = 'invitation-panel__role';
            roleSpan.textContent = `Als ${this._roleLabel(inv.role)}`;
            li.appendChild(roleSpan);

            // Aktionsbereich
            const actions = document.createElement('div');
            actions.className = 'invitation-panel__actions';

            const acceptBtn = document.createElement('button');
            acceptBtn.type        = 'button';
            acceptBtn.textContent = 'Annehmen';
            acceptBtn.className   = 'invitation-panel__accept-btn';
            acceptBtn.addEventListener('click', () => this._handleAccept(inv));
            actions.appendChild(acceptBtn);

            const declineBtn = document.createElement('button');
            declineBtn.type        = 'button';
            declineBtn.textContent = 'Ablehnen';
            declineBtn.className   = 'invitation-panel__decline-btn';
            declineBtn.style.color = '#c00';
            declineBtn.addEventListener('click', () => this._handleDecline(inv));
            actions.appendChild(declineBtn);

            li.appendChild(actions);
            this._listEl.appendChild(li);
        }
    }

    _renderEmpty(msg) {
        this._listEl.innerHTML = '';
        const li = document.createElement('li');
        li.className   = 'invitation-panel__empty';
        li.textContent = msg;
        this._listEl.appendChild(li);
    }


    // ------------------------------------------------------------------
    // Aktionen
    // ------------------------------------------------------------------

    async _handleAccept(invitation) {
        this._showMessage('', 'info');
        try {
            await this._sharing.acceptInvitation(invitation.id);
            this._showMessage(
                `Einladung zum Projekt „${invitation.projectName || invitation.projectId}" angenommen.`,
                'success'
            );
            this._onAccepted(invitation.projectId);
            await this.refresh();
        } catch (err) {
            this._showMessage(`Annehmen fehlgeschlagen: ${err.message}`, 'error');
        }
    }

    async _handleDecline(invitation) {
        if (!window.confirm(
            `Einladung zum Projekt „${invitation.projectName || invitation.projectId}" wirklich ablehnen?`
        )) return;
        this._showMessage('', 'info');
        try {
            await this._sharing.declineInvitation(invitation.id);
            this._showMessage('Einladung abgelehnt.', 'success');
            await this.refresh();
        } catch (err) {
            this._showMessage(`Ablehnen fehlgeschlagen: ${err.message}`, 'error');
        }
    }


    // ------------------------------------------------------------------
    // Hilfsfunktionen
    // ------------------------------------------------------------------

    _roleLabel(role) {
        return { owner: 'Eigentümer', editor: 'Bearbeiter', viewer: 'Betrachter' }[role] ?? role ?? '';
    }

    _setLoading(active) {
        if (this._loadingEl) {
            this._loadingEl.style.display = active ? '' : 'none';
        }
    }

    _showMessage(msg, type = 'info') {
        if (!this._messageEl) return;
        this._messageEl.textContent = msg;
        this._messageEl.className   = `invitation-panel__message invitation-panel__message--${type}`;
        if (type === 'error')        this._messageEl.style.color = '#c00';
        else if (type === 'success') this._messageEl.style.color = '#060';
        else                         this._messageEl.style.color = '';
    }
}
