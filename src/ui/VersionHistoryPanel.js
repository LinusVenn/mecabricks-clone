// =====================================================================
// VersionHistoryPanel – Phase J (Kollaboration)
//
// Panel zur Anzeige der Versionhistorie eines Projekts.
// Erlaubt Vorschau, Wiederherstellung und das Erstellen neuer Versionen.
// =====================================================================

export class VersionHistoryPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   versionManager:    import('../collaboration/VersionManager.js').VersionManager
     *   permissionManager: import('../collaboration/PermissionManager.js').PermissionManager
     *   projectManager:    object
     *   onRestored?:       () => void
     * }} options
     */
    constructor(container, {
        versionManager,
        permissionManager,
        projectManager,
        onRestored = () => {},
    }) {
        if (!container) throw new Error('VersionHistoryPanel: Container fehlt.');
        this.container   = container;
        this._versions   = versionManager;
        this._perms      = permissionManager;
        this._project    = projectManager;
        this._onRestored = onRestored;

        this._projectId    = null;
        this._versionList  = [];

        this._build();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    /**
     * Versionen für ein Projekt laden.
     * @param {string} projectId
     */
    async refresh(projectId) {
        this._projectId = projectId ?? this._projectId;
        if (!this._projectId) return;

        const canEdit    = this._perms.canEdit;
        const isOwner    = this._perms.role === 'owner';

        // Sichtbarkeit der "Neue Version"-Sektion
        this._createSection.style.display = canEdit ? '' : 'none';

        this._setLoading(true);
        try {
            this._versionList = await this._versions.getVersions(this._projectId);
            this._renderVersions(isOwner);
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
        this.container.className = 'version-history-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'version-history-panel__header';

        const title = document.createElement('h3');
        title.textContent = 'Versionhistorie';
        title.className   = 'version-history-panel__title';
        header.appendChild(title);

        const refreshBtn = document.createElement('button');
        refreshBtn.type        = 'button';
        refreshBtn.textContent = 'Aktualisieren';
        refreshBtn.className   = 'version-history-panel__refresh-btn';
        refreshBtn.addEventListener('click', () => this.refresh());
        header.appendChild(refreshBtn);

        this.container.appendChild(header);

        // Ladeindikator
        this._loadingEl = document.createElement('p');
        this._loadingEl.className    = 'version-history-panel__loading';
        this._loadingEl.textContent  = 'Wird geladen …';
        this._loadingEl.style.display = 'none';
        this.container.appendChild(this._loadingEl);

        // Meldungsbereich
        this._messageEl = document.createElement('p');
        this._messageEl.className = 'version-history-panel__message';
        this.container.appendChild(this._messageEl);

        // Neue Version erstellen (für Bearbeiter/Eigentümer)
        this._createSection = document.createElement('div');
        this._createSection.className = 'version-history-panel__create-section';

        const createTitle = document.createElement('h4');
        createTitle.textContent = 'Neue Version erstellen';
        this._createSection.appendChild(createTitle);

        const descRow = document.createElement('div');
        descRow.className = 'version-history-panel__create-row';

        this._descInput = document.createElement('input');
        this._descInput.type        = 'text';
        this._descInput.placeholder = 'Versionsbeschreibung (optional)';
        this._descInput.className   = 'version-history-panel__desc-input';
        this._descInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._handleCreateVersion();
        });
        descRow.appendChild(this._descInput);

        const createBtn = document.createElement('button');
        createBtn.type        = 'button';
        createBtn.textContent = 'Neue Version erstellen';
        createBtn.className   = 'version-history-panel__create-btn';
        createBtn.addEventListener('click', () => this._handleCreateVersion());
        descRow.appendChild(createBtn);

        this._createSection.appendChild(descRow);
        this.container.appendChild(this._createSection);

        // Versionsliste
        this._listEl = document.createElement('ul');
        this._listEl.className = 'version-history-panel__list';
        this.container.appendChild(this._listEl);
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderVersions(isOwner) {
        this._listEl.innerHTML = '';
        this._messageEl.textContent = '';

        if (this._versionList.length === 0) {
            this._renderEmpty('Keine Versionen vorhanden.');
            return;
        }

        // Neueste zuerst
        const sorted = [...this._versionList].sort(
            (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0)
        );

        for (const ver of sorted) {
            const li = document.createElement('li');
            li.className = 'version-history-panel__item';

            // Versionsnummer
            const numSpan = document.createElement('span');
            numSpan.className   = 'version-history-panel__version-number';
            numSpan.textContent = `v${ver.versionNumber}`;
            li.appendChild(numSpan);

            // Beschreibung
            const descSpan = document.createElement('span');
            descSpan.className   = 'version-history-panel__version-desc';
            descSpan.textContent = ver.description || '(Keine Beschreibung)';
            li.appendChild(descSpan);

            // Ersteller
            const creatorSpan = document.createElement('span');
            creatorSpan.className   = 'version-history-panel__version-creator';
            creatorSpan.textContent = ver.createdBy || '';
            li.appendChild(creatorSpan);

            // Datum
            const dateSpan = document.createElement('span');
            dateSpan.className   = 'version-history-panel__version-date';
            dateSpan.textContent = ver.createdAt
                ? new Date(ver.createdAt).toLocaleString('de-DE')
                : '';
            li.appendChild(dateSpan);

            // Aktionen
            const actions = document.createElement('div');
            actions.className = 'version-history-panel__actions';

            const previewBtn = document.createElement('button');
            previewBtn.type        = 'button';
            previewBtn.textContent = 'Version anzeigen';
            previewBtn.className   = 'version-history-panel__preview-btn';
            previewBtn.addEventListener('click', () => this._handlePreview(ver));
            actions.appendChild(previewBtn);

            if (isOwner) {
                const restoreBtn = document.createElement('button');
                restoreBtn.type        = 'button';
                restoreBtn.textContent = 'Wiederherstellen';
                restoreBtn.className   = 'version-history-panel__restore-btn';
                restoreBtn.addEventListener('click', () => this._handleRestore(ver));
                actions.appendChild(restoreBtn);
            }

            li.appendChild(actions);
            this._listEl.appendChild(li);
        }
    }

    _renderEmpty(msg) {
        this._listEl.innerHTML = '';
        const li = document.createElement('li');
        li.className   = 'version-history-panel__empty';
        li.textContent = msg;
        this._listEl.appendChild(li);
    }


    // ------------------------------------------------------------------
    // Aktionen
    // ------------------------------------------------------------------

    async _handleCreateVersion() {
        const description = this._descInput?.value?.trim() ?? '';
        if (!this._projectId) {
            this._showMessage('Kein Projekt ausgewählt.', 'error');
            return;
        }
        this._showMessage('', 'info');
        try {
            await this._versions.createVersion(this._projectId, { description });
            this._descInput.value = '';
            this._showMessage('Neue Version erstellt.', 'success');
            await this.refresh(this._projectId);
        } catch (err) {
            this._showMessage(`Version erstellen fehlgeschlagen: ${err.message}`, 'error');
        }
    }

    async _handlePreview(version) {
        this._showMessage('', 'info');
        try {
            const full = await this._versions.getVersion(version.id);
            if (full?.projectData) {
                this._project.loadProjectJSON(full.projectData);
                this._showMessage(`Vorschau: Version ${version.versionNumber} geladen.`, 'success');
            }
        } catch (err) {
            this._showMessage(`Vorschau fehlgeschlagen: ${err.message}`, 'error');
        }
    }

    async _handleRestore(version) {
        if (!window.confirm(
            `Version ${version.versionNumber} wirklich wiederherstellen? ` +
            `Die aktuelle Version wird als Sicherung gespeichert.`
        )) return;
        this._showMessage('', 'info');
        try {
            await this._versions.restoreVersion(this._projectId, version.id);
            this._showMessage(`Version ${version.versionNumber} wiederhergestellt.`, 'success');
            this._onRestored();
            await this.refresh(this._projectId);
        } catch (err) {
            this._showMessage(`Wiederherstellung fehlgeschlagen: ${err.message}`, 'error');
        }
    }


    // ------------------------------------------------------------------
    // Hilfsfunktionen
    // ------------------------------------------------------------------

    _setLoading(active) {
        if (this._loadingEl) {
            this._loadingEl.style.display = active ? '' : 'none';
        }
    }

    _showMessage(msg, type = 'info') {
        if (!this._messageEl) return;
        this._messageEl.textContent = msg;
        this._messageEl.className   = `version-history-panel__message version-history-panel__message--${type}`;
        if (type === 'error')        this._messageEl.style.color = '#c00';
        else if (type === 'success') this._messageEl.style.color = '#060';
        else                         this._messageEl.style.color = '';
    }
}
