// =====================================================================
// CollaborationPanel – Phase J (Kollaboration)
//
// Master-Panel das alle Kollaborations-UI-Komponenten integriert.
// Tabs: Mitglieder | Einladungen | Versionen | Aktivität
// Enthält: ShareProjectPanel, VersionHistoryPanel, PresenceIndicator,
//          PermissionPanel, ActivityPanel
// =====================================================================

import { ShareProjectPanel }    from './ShareProjectPanel.js';
import { InvitationPanel }      from './InvitationPanel.js';
import { VersionHistoryPanel }  from './VersionHistoryPanel.js';
import { PermissionPanel }      from './PermissionPanel.js';
import { PresenceIndicator }    from './PresenceIndicator.js';
import { ActivityPanel }        from './ActivityPanel.js';

const TABS = ['Mitglieder', 'Einladungen', 'Versionen', 'Aktivität'];

export class CollaborationPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   collaborationManager: import('../collaboration/CollaborationManager.js').CollaborationManager
     *   sharingManager:       import('../collaboration/SharingManager.js').SharingManager
     *   versionManager:       import('../collaboration/VersionManager.js').VersionManager
     *   permissionManager:    import('../collaboration/PermissionManager.js').PermissionManager
     *   presenceManager:      import('../collaboration/PresenceManager.js').PresenceManager
     *   authManager:          import('../auth/AuthManager.js').AuthManager
     *   projectManager:       object
     *   supabaseClient?:      object
     *   onProjectLoaded?:     () => void
     * }} options
     */
    constructor(container, {
        collaborationManager,
        sharingManager,
        versionManager,
        permissionManager,
        presenceManager,
        authManager,
        projectManager,
        supabaseClient,
        onProjectLoaded = () => {},
    }) {
        if (!container) throw new Error('CollaborationPanel: Container fehlt.');
        this.container     = container;
        this._collab       = collaborationManager;
        this._sharing      = sharingManager;
        this._versions     = versionManager;
        this._perms        = permissionManager;
        this._presence     = presenceManager;
        this._auth         = authManager;
        this._project      = projectManager;
        this._supabase     = supabaseClient;
        this._onProjectLoaded = onProjectLoaded;

        this._projectId    = null;
        this._activeTab    = 'Mitglieder';
        this._connected    = false;

        this._subPanels    = {};

        this._build();

        // Abonnement auf Berechtigungsänderungen → Panel-Sichtbarkeit anpassen
        this._perms.subscribe?.(() => this._updateForRole());
        this._auth.subscribe?.(() => this._updateForRole());
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    /**
     * Alle Sub-Panels für ein Projekt aktualisieren.
     * @param {string} projectId
     */
    async refresh(projectId) {
        this._projectId = projectId ?? this._projectId;
        if (!this._projectId) return;
        await this._perms.loadRole?.(this._projectId);
        this._updateForRole();
        this._refreshActiveTab();
    }

    /**
     * Projekt setzen und Panels vorbereiten.
     * @param {string} projectId
     */
    setProject(projectId) {
        this._projectId = projectId;
        this.refresh(projectId);
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'collaboration-panel';

        // ---- Header ----
        const header = document.createElement('div');
        header.className = 'collaboration-panel__header';

        const title = document.createElement('h3');
        title.textContent = 'Zusammenarbeit';
        title.className   = 'collaboration-panel__title';
        header.appendChild(title);

        // Sync-Status-Badge
        this._syncBadge = document.createElement('span');
        this._syncBadge.className   = 'collaboration-panel__sync-badge';
        this._syncBadge.textContent = '● Nicht verbunden';
        header.appendChild(this._syncBadge);

        this.container.appendChild(header);

        // ---- Echtzeit-Modus Toggle ----
        const realtimeBar = document.createElement('div');
        realtimeBar.className = 'collaboration-panel__realtime-bar';

        this._realtimeBtn = document.createElement('button');
        this._realtimeBtn.type        = 'button';
        this._realtimeBtn.className   = 'collaboration-panel__realtime-btn';
        this._realtimeBtn.textContent = 'Echtzeit-Modus aktivieren';
        this._realtimeBtn.addEventListener('click', () => this._toggleRealtime());
        realtimeBar.appendChild(this._realtimeBtn);

        this.container.appendChild(realtimeBar);

        // ---- Aktuelle Rolle ----
        const permContainer = document.createElement('div');
        permContainer.className = 'collaboration-panel__perm-container';
        this._subPanels.permission = new PermissionPanel(permContainer, {
            permissionManager: this._perms,
        });
        this.container.appendChild(permContainer);

        // ---- Präsenz-Anzeige ----
        this._presenceContainer = document.createElement('div');
        this._presenceContainer.className = 'collaboration-panel__presence-container';
        if (this._presence) {
            this._subPanels.presence = new PresenceIndicator(this._presenceContainer, {
                presenceManager: this._presence,
                authManager:     this._auth,
            });
        }
        this.container.appendChild(this._presenceContainer);

        // ---- Tabs ----
        this._tabBar = document.createElement('div');
        this._tabBar.className = 'collaboration-panel__tab-bar';
        this._tabButtons = {};

        for (const tab of TABS) {
            const btn = document.createElement('button');
            btn.type        = 'button';
            btn.textContent = tab;
            btn.className   = 'collaboration-panel__tab-btn';
            btn.dataset.tab = tab;
            btn.addEventListener('click', () => this._switchTab(tab));
            this._tabBar.appendChild(btn);
            this._tabButtons[tab] = btn;
        }
        this.container.appendChild(this._tabBar);

        // ---- Tab-Inhaltsbereiche ----
        this._tabContents = {};

        // Mitglieder (ShareProjectPanel)
        const membersContainer = this._createTabContent('Mitglieder');
        this._subPanels.share = new ShareProjectPanel(membersContainer, {
            sharingManager:    this._sharing,
            permissionManager: this._perms,
            authManager:       this._auth,
        });

        // Einladungen (InvitationPanel)
        const invitationsContainer = this._createTabContent('Einladungen');
        this._subPanels.invitations = new InvitationPanel(invitationsContainer, {
            sharingManager: this._sharing,
            authManager:    this._auth,
            onAccepted:     (projectId) => {
                this._onProjectLoaded();
                this.refresh(projectId);
            },
        });

        // Versionen (VersionHistoryPanel)
        const versionsContainer = this._createTabContent('Versionen');
        this._subPanels.versions = new VersionHistoryPanel(versionsContainer, {
            versionManager:    this._versions,
            permissionManager: this._perms,
            projectManager:    this._project,
            onRestored:        () => this._onProjectLoaded(),
        });

        // Aktivität (ActivityPanel)
        const activityContainer = this._createTabContent('Aktivität');
        if (this._supabase) {
            this._subPanels.activity = new ActivityPanel(activityContainer, {
                supabaseClient: this._supabase,
                authManager:    this._auth,
            });
        } else {
            activityContainer.textContent = 'Aktivität nicht verfügbar (kein Supabase-Client).';
        }

        this._switchTab('Mitglieder');
    }

    _createTabContent(tabName) {
        const div = document.createElement('div');
        div.className              = 'collaboration-panel__tab-content';
        div.dataset.tab            = tabName;
        div.style.display          = 'none';
        this._tabContents[tabName] = div;
        this.container.appendChild(div);
        return div;
    }


    // ------------------------------------------------------------------
    // Tab-Steuerung
    // ------------------------------------------------------------------

    _switchTab(tabName) {
        this._activeTab = tabName;

        for (const [name, content] of Object.entries(this._tabContents)) {
            content.style.display = name === tabName ? '' : 'none';
        }
        for (const [name, btn] of Object.entries(this._tabButtons)) {
            btn.classList.toggle('collaboration-panel__tab-btn--active', name === tabName);
        }

        this._refreshActiveTab();
    }

    _refreshActiveTab() {
        if (!this._projectId) return;

        switch (this._activeTab) {
            case 'Mitglieder':
                this._subPanels.share?.refresh(this._projectId);
                break;
            case 'Versionen':
                this._subPanels.versions?.refresh(this._projectId);
                break;
            case 'Einladungen':
                this._subPanels.invitations?.refresh();
                break;
            case 'Aktivität':
                this._subPanels.activity?.refresh(this._projectId);
                break;
        }
    }


    // ------------------------------------------------------------------
    // Echtzeit-Modus
    // ------------------------------------------------------------------

    async _toggleRealtime() {
        if (this._connected) {
            await this._disconnectRealtime();
        } else {
            await this._connectRealtime();
        }
    }

    async _connectRealtime() {
        if (!this._projectId) return;
        try {
            await this._collab?.connect?.(this._projectId);
            this._connected = true;
            this._realtimeBtn.textContent = 'Echtzeit-Modus deaktivieren';
            this._syncBadge.textContent   = '● Verbunden';
            this._syncBadge.style.color   = '#3c3';
        } catch (err) {
            this._syncBadge.textContent = `● Verbindungsfehler: ${err.message}`;
            this._syncBadge.style.color = '#c00';
        }
    }

    async _disconnectRealtime() {
        try {
            await this._collab?.disconnect?.();
            this._connected = false;
            this._realtimeBtn.textContent = 'Echtzeit-Modus aktivieren';
            this._syncBadge.textContent   = '● Nicht verbunden';
            this._syncBadge.style.color   = '';
        } catch (err) {
            this._syncBadge.textContent = `● Fehler beim Trennen: ${err.message}`;
            this._syncBadge.style.color = '#c00';
        }
    }


    // ------------------------------------------------------------------
    // Rollenabhängige Sichtbarkeit
    // ------------------------------------------------------------------

    _updateForRole() {
        const role    = this._perms.role;
        const isOwner = role === 'owner';

        // "Mitglieder"-Tab nur für Eigentümer sichtbar/sinnvoll
        if (this._tabButtons['Mitglieder']) {
            this._tabButtons['Mitglieder'].style.display = isOwner ? '' : 'none';
        }

        // Wenn aktueller Tab nicht mehr zugänglich → zu Versionen wechseln
        if (!isOwner && this._activeTab === 'Mitglieder') {
            this._switchTab('Versionen');
        }

        // PermissionPanel aktualisieren
        this._subPanels.permission?.update();
    }
}
