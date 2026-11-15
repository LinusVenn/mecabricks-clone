// =====================================================================
// CloudProjectPanel – Phase 9.4
//
// Panel zur Verwaltung der Cloud-Projekte des angemeldeten Benutzers.
// Zeigt Projektliste, erlaubt Öffnen, Umbenennen, Löschen und Anlegen.
// =====================================================================

export class CloudProjectPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   authManager:         import('../auth/AuthManager.js').AuthManager
     *   cloudProjectManager: import('../cloud/CloudProjectManager.js').CloudProjectManager
     *   syncManager:         import('../cloud/CloudSyncManager.js').CloudSyncManager
     *   syncStatusManager:   import('../cloud/SyncStatusManager.js').SyncStatusManager
     *   onProjectLoaded?:    () => void
     * }} options
     */
    constructor(container, {
        authManager,
        cloudProjectManager,
        syncManager,
        syncStatusManager,
        onProjectLoaded = () => {},
    }) {
        if (!container) throw new Error('CloudProjectPanel: Container fehlt.');
        this.container        = container;
        this._auth            = authManager;
        this._cpm             = cloudProjectManager;
        this._sync            = syncManager;
        this._status          = syncStatusManager;
        this._onProjectLoaded = onProjectLoaded;

        this._projects = [];
        this._build();

        // Aktualisieren wenn Benutzer sich an-/abmeldet
        this._auth.subscribe(() => this.refresh());

        // Synchronisierungsstatus anzeigen und bei Konflikt Dialog öffnen
        this._status.subscribe((status) => {
            this._updateSyncBadge(status);
            if (status === 'conflict') this._showConflictDialog();
        });
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    async refresh() {
        if (!this._auth.isLoggedIn) {
            this._renderEmpty('Bitte anmelden, um Cloud-Projekte zu verwalten.');
            return;
        }
        try {
            this._projects = await this._cpm.getAllProjects();
            this._renderList();
        } catch (err) {
            this._renderEmpty(`Fehler: ${err.message}`);
        }
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'cloud-project-panel';

        const header = document.createElement('div');
        header.className = 'cloud-project-panel__header';
        header.innerHTML = '<h3>Cloud-Projekte</h3>';
        this.container.appendChild(header);

        // Sync-Status-Badge
        this._syncBadge = document.createElement('span');
        this._syncBadge.className = 'cloud-project-panel__sync-badge';
        header.appendChild(this._syncBadge);

        // Aktionsleiste
        const toolbar = document.createElement('div');
        toolbar.className = 'cloud-project-panel__toolbar';

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button'; refreshBtn.textContent = 'Aktualisieren';
        refreshBtn.addEventListener('click', () => this.refresh());
        toolbar.appendChild(refreshBtn);

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button'; saveBtn.textContent = 'In Cloud speichern';
        saveBtn.addEventListener('click', () => this._handleSaveToCloud());
        toolbar.appendChild(saveBtn);

        this.container.appendChild(toolbar);

        // Projektliste
        this._listEl = document.createElement('ul');
        this._listEl.className = 'cloud-project-panel__list';
        this.container.appendChild(this._listEl);

        this._messageEl = document.createElement('p');
        this._messageEl.className = 'cloud-project-panel__message';
        this.container.appendChild(this._messageEl);

        this.refresh();
    }

    _renderList() {
        this._listEl.innerHTML = '';
        this._messageEl.textContent = '';

        if (this._projects.length === 0) {
            this._renderEmpty('Keine Cloud-Projekte vorhanden.');
            return;
        }

        for (const project of this._projects) {
            const li = document.createElement('li');
            li.className = 'cloud-project-panel__item';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = project.name;
            nameSpan.className = 'cloud-project-panel__name';

            const dateSpan = document.createElement('span');
            dateSpan.className = 'cloud-project-panel__date';
            dateSpan.textContent = project.updatedAt
                ? new Date(project.updatedAt).toLocaleString('de-DE')
                : '';

            const openBtn = document.createElement('button');
            openBtn.type = 'button'; openBtn.textContent = 'Öffnen';
            openBtn.addEventListener('click', () => this._handleOpen(project.id));

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button'; renameBtn.textContent = 'Umbenennen';
            renameBtn.addEventListener('click', () => this._handleRename(project.id, project.name));

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button'; deleteBtn.textContent = 'Löschen';
            deleteBtn.style.color = '#c00';
            deleteBtn.addEventListener('click', () => this._handleDelete(project.id, project.name));

            li.appendChild(nameSpan);
            li.appendChild(dateSpan);
            li.appendChild(openBtn);
            li.appendChild(renameBtn);
            li.appendChild(deleteBtn);
            this._listEl.appendChild(li);
        }
    }

    _renderEmpty(msg) {
        this._listEl.innerHTML = '';
        this._messageEl.textContent = msg;
    }

    _updateSyncBadge(status) {
        if (!this._syncBadge) return;
        const labels = {
            'synced':      '● Synchronisiert',
            'modified':    '● Ungespeicherte Änderungen',
            'syncing':     '● Wird synchronisiert …',
            'error':       '● Synchronisierungsfehler',
            'conflict':    '● Versionskonflikt',
            'offline':     '● Offline',
            'local-only':  '● Nur lokal',
        };
        this._syncBadge.textContent = labels[status] ?? '';
    }


    // ------------------------------------------------------------------
    // Aktionen
    // ------------------------------------------------------------------

    async _handleOpen(id) {
        try {
            await this._sync.loadFromCloud(id);
            this._onProjectLoaded();
        } catch (err) {
            alert(`Projekt konnte nicht geöffnet werden:\n${err.message}`);
        }
    }

    async _handleRename(id, currentName) {
        const newName = window.prompt('Neuer Projektname:', currentName);
        if (!newName?.trim()) return;
        try {
            await this._cpm.renameProject(id, newName.trim());
            await this.refresh();
        } catch (err) {
            alert(`Umbenennen fehlgeschlagen:\n${err.message}`);
        }
    }

    async _handleDelete(id, name) {
        if (!window.confirm(`Projekt „${name}" wirklich löschen?`)) return;
        try {
            await this._cpm.deleteProject(id);
            await this.refresh();
        } catch (err) {
            alert(`Löschen fehlgeschlagen:\n${err.message}`);
        }
    }

    async _handleSaveToCloud() {
        try {
            await this._sync.saveToCloud();
            await this.refresh();
        } catch (err) {
            alert(`Speichern fehlgeschlagen:\n${err.message}`);
        }
    }


    // ------------------------------------------------------------------
    // Konfliktbehandlung (I.7)
    // ------------------------------------------------------------------

    /**
     * Zeigt einen Dialog an, wenn ein Versionskonflikt erkannt wurde.
     *
     * Der Benutzer kann wählen:
     *   1. Eigene Version überschreiben (Cloud-Version laden)
     *   2. Eigene Version als neues Projekt speichern
     *   3. Abbrechen (lokale Version behalten, nicht speichern)
     */
    _showConflictDialog() {
        // Verhindert mehrfache Dialoge
        if (this._conflictDialogOpen) return;
        this._conflictDialogOpen = true;

        const dialog = document.createElement('div');
        dialog.className = 'cloud-conflict-dialog';
        Object.assign(dialog.style, {
            position:     'fixed',
            top:          '50%',
            left:         '50%',
            transform:    'translate(-50%, -50%)',
            background:   '#2a2a2a',
            color:        '#eee',
            border:       '1px solid #c00',
            borderRadius: '6px',
            padding:      '24px',
            zIndex:       '9999',
            maxWidth:     '420px',
            width:        '90vw',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.5)',
        });

        dialog.innerHTML = `
            <h3 style="margin:0 0 12px;color:#f66">⚠ Versionskonflikt</h3>
            <p style="margin:0 0 16px;line-height:1.5">
                Das Projekt wurde auf einem anderen Gerät oder in einem anderen
                Browser-Tab geändert. Deine lokalen Änderungen können nicht
                automatisch zusammengeführt werden.
            </p>
            <p style="margin:0 0 20px;font-size:0.9em;color:#aaa">
                Was möchtest du tun?
            </p>
            <div style="display:flex;flex-direction:column;gap:8px">
                <button id="conflict-load-server" style="padding:8px;cursor:pointer;background:#444;color:#eee;border:1px solid #666;border-radius:4px">
                    Cloud-Version laden (lokale Änderungen verwerfen)
                </button>
                <button id="conflict-save-new" style="padding:8px;cursor:pointer;background:#444;color:#eee;border:1px solid #666;border-radius:4px">
                    Eigene Version als neues Cloud-Projekt speichern
                </button>
                <button id="conflict-cancel" style="padding:8px;cursor:pointer;background:#333;color:#999;border:1px solid #555;border-radius:4px">
                    Abbrechen (Änderungen bleiben lokal ungespeichert)
                </button>
            </div>
        `;

        document.body.appendChild(dialog);

        const close = () => {
            dialog.remove();
            this._conflictDialogOpen = false;
        };

        dialog.querySelector('#conflict-load-server').addEventListener('click', async () => {
            close();
            const id = this._sync.currentCloudProjectId;
            if (!id) return;
            try {
                await this._sync.loadFromCloud(id);
                this._onProjectLoaded();
            } catch (err) {
                alert(`Cloud-Version konnte nicht geladen werden:\n${err.message}`);
            }
        });

        dialog.querySelector('#conflict-save-new').addEventListener('click', async () => {
            close();
            // Cloud-Verknüpfung trennen, dann als neues Projekt speichern
            this._sync.setCloudProject(null, null);
            try {
                await this._sync.saveToCloud();
                await this.refresh();
            } catch (err) {
                alert(`Speichern als neues Projekt fehlgeschlagen:\n${err.message}`);
            }
        });

        dialog.querySelector('#conflict-cancel').addEventListener('click', () => {
            close();
            // Kein Speichern – Benutzer behält lokale Version bewusst ungespeichert
        });
    }
}
