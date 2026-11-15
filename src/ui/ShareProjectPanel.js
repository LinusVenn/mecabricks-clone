// =====================================================================
// ShareProjectPanel – Phase J (Kollaboration)
//
// Panel zur Freigabe eines Projekts mit anderen Benutzern.
// Wird nur angezeigt wenn der aktuelle Benutzer Eigentümer ist.
// =====================================================================

export class ShareProjectPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   sharingManager:    import('../collaboration/SharingManager.js').SharingManager
     *   permissionManager: import('../collaboration/PermissionManager.js').PermissionManager
     *   authManager:       import('../auth/AuthManager.js').AuthManager
     *   onError?:          (err: Error) => void
     * }} options
     */
    constructor(container, {
        sharingManager,
        permissionManager,
        authManager,
        onError = () => {},
    }) {
        if (!container) throw new Error('ShareProjectPanel: Container fehlt.');
        this.container     = container;
        this._sharing      = sharingManager;
        this._perms        = permissionManager;
        this._auth         = authManager;
        this._onError      = onError;

        this._projectId    = null;
        this._members      = [];
        this._invitations  = [];

        this._build();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    /** Formular und Meldungen zurücksetzen. */
    reset() {
        if (this._emailInput) this._emailInput.value = '';
        if (this._roleSelect) this._roleSelect.value = 'viewer';
        this._showMessage('', 'info');
        this._members     = [];
        this._invitations = [];
        this._renderMembers();
        this._renderInvitations();
    }

    /**
     * Projekt setzen und Mitglieder sowie Einladungen neu laden.
     * @param {string} projectId
     */
    async refresh(projectId) {
        this._projectId = projectId ?? this._projectId;
        if (!this._projectId) return;

        const isOwner = this._perms.role === 'owner';
        this._inviteSection.style.display   = isOwner ? '' : 'none';
        this._revokeButtons.forEach(b => { b.style.display = isOwner ? '' : 'none'; });

        this._setLoading(true);
        try {
            this._members     = await this._sharing.getMembers(this._projectId);
            this._invitations = await this._sharing.getPendingInvitations(this._projectId);
            this._renderMembers();
            this._renderInvitations();
        } catch (err) {
            this._showMessage(`Fehler beim Laden: ${err.message}`, 'error');
            this._onError(err);
        } finally {
            this._setLoading(false);
        }
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'share-project-panel';

        // Titel
        const header = document.createElement('div');
        header.className = 'share-project-panel__header';
        const title = document.createElement('h3');
        title.textContent = 'Projekt teilen';
        title.className   = 'share-project-panel__title';
        header.appendChild(title);
        this.container.appendChild(header);

        // Ladeindikator
        this._loadingEl = document.createElement('p');
        this._loadingEl.className    = 'share-project-panel__loading';
        this._loadingEl.textContent  = 'Wird geladen …';
        this._loadingEl.style.display = 'none';
        this.container.appendChild(this._loadingEl);

        // Einladungsbereich (nur für Eigentümer)
        this._inviteSection = document.createElement('div');
        this._inviteSection.className = 'share-project-panel__invite-section';

        const inviteTitle = document.createElement('h4');
        inviteTitle.textContent = 'Benutzer einladen';
        this._inviteSection.appendChild(inviteTitle);

        const inviteRow = document.createElement('div');
        inviteRow.className = 'share-project-panel__invite-row';

        this._emailInput = document.createElement('input');
        this._emailInput.type        = 'email';
        this._emailInput.placeholder = 'E-Mail-Adresse';
        this._emailInput.className   = 'share-project-panel__email-input';
        this._emailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._handleInvite();
        });
        inviteRow.appendChild(this._emailInput);

        this._roleSelect = document.createElement('select');
        this._roleSelect.className = 'share-project-panel__role-select';
        for (const [value, label] of [['viewer', 'Betrachter'], ['editor', 'Bearbeiter']]) {
            const opt = document.createElement('option');
            opt.value       = value;
            opt.textContent = label;
            this._roleSelect.appendChild(opt);
        }
        inviteRow.appendChild(this._roleSelect);

        const inviteBtn = document.createElement('button');
        inviteBtn.type        = 'button';
        inviteBtn.textContent = 'Einladen';
        inviteBtn.className   = 'share-project-panel__invite-btn';
        inviteBtn.addEventListener('click', () => this._handleInvite());
        inviteRow.appendChild(inviteBtn);

        this._inviteSection.appendChild(inviteRow);
        this.container.appendChild(this._inviteSection);

        // Meldungsbereich
        this._messageEl = document.createElement('p');
        this._messageEl.className = 'share-project-panel__message';
        this.container.appendChild(this._messageEl);

        // Mitglieder-Liste
        const membersHeader = document.createElement('div');
        membersHeader.className = 'share-project-panel__section-header';

        const membersTitle = document.createElement('h4');
        membersTitle.textContent = 'Mitglieder';
        membersHeader.appendChild(membersTitle);

        const refreshBtn = document.createElement('button');
        refreshBtn.type        = 'button';
        refreshBtn.textContent = 'Mitglieder aktualisieren';
        refreshBtn.className   = 'share-project-panel__refresh-btn';
        refreshBtn.addEventListener('click', () => this.refresh());
        membersHeader.appendChild(refreshBtn);

        this.container.appendChild(membersHeader);

        this._membersListEl = document.createElement('ul');
        this._membersListEl.className = 'share-project-panel__members-list';
        this.container.appendChild(this._membersListEl);

        // Ausstehende Einladungen
        const invitationsTitle = document.createElement('h4');
        invitationsTitle.textContent = 'Ausstehende Einladungen';
        invitationsTitle.className   = 'share-project-panel__section-title';
        this.container.appendChild(invitationsTitle);

        this._invitationsListEl = document.createElement('ul');
        this._invitationsListEl.className = 'share-project-panel__invitations-list';
        this.container.appendChild(this._invitationsListEl);

        // Merkliste für Widerruf-Buttons (für Sichtbarkeitssteuerung)
        this._revokeButtons = [];
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderMembers() {
        this._membersListEl.innerHTML = '';

        if (this._members.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Keine weiteren Mitglieder.';
            li.className   = 'share-project-panel__empty';
            this._membersListEl.appendChild(li);
            return;
        }

        const isOwner = this._perms.role === 'owner';

        for (const member of this._members) {
            const li = document.createElement('li');
            li.className = 'share-project-panel__member-item';

            const nameSpan = document.createElement('span');
            nameSpan.className   = 'share-project-panel__member-name';
            nameSpan.textContent = member.displayName || member.email || member.userId;
            li.appendChild(nameSpan);

            const emailSpan = document.createElement('span');
            emailSpan.className   = 'share-project-panel__member-email';
            emailSpan.textContent = member.email ? `(${member.email})` : '';
            li.appendChild(emailSpan);

            const roleSpan = document.createElement('span');
            roleSpan.className   = 'share-project-panel__member-role';
            roleSpan.textContent = this._roleLabel(member.role);
            li.appendChild(roleSpan);

            if (isOwner && member.role !== 'owner') {
                const removeBtn = document.createElement('button');
                removeBtn.type        = 'button';
                removeBtn.textContent = 'Entfernen';
                removeBtn.className   = 'share-project-panel__remove-btn';
                removeBtn.style.color = '#c00';
                removeBtn.addEventListener('click', () =>
                    this._handleRemoveMember(member.userId, member.displayName || member.email)
                );
                li.appendChild(removeBtn);
                this._revokeButtons.push(removeBtn);
            }

            this._membersListEl.appendChild(li);
        }
    }

    _renderInvitations() {
        this._invitationsListEl.innerHTML = '';

        if (!this._invitations || this._invitations.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Keine ausstehenden Einladungen.';
            li.className   = 'share-project-panel__empty';
            this._invitationsListEl.appendChild(li);
            return;
        }

        const isOwner = this._perms.role === 'owner';

        for (const inv of this._invitations) {
            const li = document.createElement('li');
            li.className = 'share-project-panel__invitation-item';

            const emailSpan = document.createElement('span');
            emailSpan.className   = 'share-project-panel__inv-email';
            emailSpan.textContent = inv.email;
            li.appendChild(emailSpan);

            const roleSpan = document.createElement('span');
            roleSpan.className   = 'share-project-panel__inv-role';
            roleSpan.textContent = this._roleLabel(inv.role);
            li.appendChild(roleSpan);

            const statusSpan = document.createElement('span');
            statusSpan.className   = 'share-project-panel__inv-status';
            statusSpan.textContent = this._statusLabel(inv.status);
            li.appendChild(statusSpan);

            if (isOwner) {
                const revokeBtn = document.createElement('button');
                revokeBtn.type        = 'button';
                revokeBtn.textContent = 'Widerrufen';
                revokeBtn.className   = 'share-project-panel__revoke-btn';
                revokeBtn.style.color = '#c00';
                revokeBtn.addEventListener('click', () =>
                    this._handleRevokeInvitation(inv.id, inv.email)
                );
                li.appendChild(revokeBtn);
                this._revokeButtons.push(revokeBtn);
            }

            this._invitationsListEl.appendChild(li);
        }
    }


    // ------------------------------------------------------------------
    // Aktionen
    // ------------------------------------------------------------------

    async _handleInvite() {
        const email = this._emailInput?.value?.trim() ?? '';
        const role  = this._roleSelect?.value ?? 'viewer';

        if (!email) {
            this._showMessage('Bitte E-Mail-Adresse eingeben.', 'error');
            return;
        }
        if (!this._projectId) {
            this._showMessage('Kein Projekt ausgewählt.', 'error');
            return;
        }

        this._showMessage('', 'info');
        try {
            await this._sharing.inviteUser(this._projectId, email, role);
            this._emailInput.value = '';
            this._showMessage(`Einladung an ${email} versendet.`, 'success');
            await this.refresh(this._projectId);
        } catch (err) {
            this._showMessage(`Einladung fehlgeschlagen: ${err.message}`, 'error');
            this._onError(err);
        }
    }

    async _handleRemoveMember(userId, displayName) {
        if (!window.confirm(`Mitglied „${displayName}" wirklich entfernen?`)) return;
        try {
            await this._sharing.removeMember(this._projectId, userId);
            this._showMessage('Mitglied entfernt.', 'success');
            await this.refresh(this._projectId);
        } catch (err) {
            this._showMessage(`Entfernen fehlgeschlagen: ${err.message}`, 'error');
            this._onError(err);
        }
    }

    async _handleRevokeInvitation(invitationId, email) {
        if (!window.confirm(`Einladung für „${email}" widerrufen?`)) return;
        try {
            await this._sharing.revokeInvitation(invitationId);
            this._showMessage('Einladung widerrufen.', 'success');
            await this.refresh(this._projectId);
        } catch (err) {
            this._showMessage(`Widerrufen fehlgeschlagen: ${err.message}`, 'error');
            this._onError(err);
        }
    }


    // ------------------------------------------------------------------
    // Hilfsfunktionen
    // ------------------------------------------------------------------

    _roleLabel(role) {
        return { owner: 'Eigentümer', editor: 'Bearbeiter', viewer: 'Betrachter' }[role] ?? role ?? '';
    }

    _statusLabel(status) {
        return { pending: 'Ausstehend', accepted: 'Akzeptiert', declined: 'Abgelehnt' }[status] ?? status ?? '';
    }

    _setLoading(active) {
        if (this._loadingEl) {
            this._loadingEl.style.display = active ? '' : 'none';
        }
    }

    _showMessage(msg, type = 'info') {
        if (!this._messageEl) return;
        this._messageEl.textContent = msg;
        this._messageEl.className   = `share-project-panel__message share-project-panel__message--${type}`;
        if (type === 'error') {
            this._messageEl.style.color = '#c00';
        } else if (type === 'success') {
            this._messageEl.style.color = '#060';
        } else {
            this._messageEl.style.color = '';
        }
    }
}
