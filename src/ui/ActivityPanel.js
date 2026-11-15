// =====================================================================
// ActivityPanel – Phase J (Kollaboration)
//
// Zeigt das Aktivitätsprotokoll eines Projekts aus der
// Tabelle `project_activity` in Supabase.
// Aktualisiert sich automatisch alle 30 Sekunden wenn sichtbar.
// =====================================================================

const AUTO_REFRESH_INTERVAL_MS = 30_000;

/** Aktionsbezeichnungen auf Deutsch */
const ACTION_LABELS = {
    PROJECT_SAVED:       (e) => `Projekt gespeichert (Rev. ${e.metadata?.revision ?? '?'})`,
    MEMBER_INVITED:      (e) => `${e.metadata?.email ?? '?'} eingeladen als ${_roleLabel(e.metadata?.role)}`,
    MEMBER_JOINED:       (e) => `${e.actorName ?? e.actorId ?? '?'} ist beigetreten`,
    MEMBER_LEFT:         (e) => `${e.actorName ?? e.actorId ?? '?'} hat das Projekt verlassen`,
    MEMBER_REMOVED:      (e) => `${e.metadata?.memberName ?? '?'} wurde entfernt`,
    VERSION_CREATED:     (e) => `Version ${e.metadata?.versionNumber ?? '?'} erstellt: ${e.metadata?.description ?? ''}`,
    VERSION_RESTORED:    (e) => `Version ${e.metadata?.versionNumber ?? '?'} wiederhergestellt`,
    INVITATION_ACCEPTED: (e) => `Einladung von ${e.actorName ?? e.actorId ?? '?'} angenommen`,
    INVITATION_DECLINED: (e) => `Einladung von ${e.actorName ?? e.actorId ?? '?'} abgelehnt`,
    INVITATION_REVOKED:  (e) => `Einladung für ${e.metadata?.email ?? '?'} widerrufen`,
    PROJECT_RENAMED:     (e) => `Projekt umbenannt in „${e.metadata?.newName ?? '?'}"`,
};

function _roleLabel(role) {
    return { owner: 'Eigentümer', editor: 'Bearbeiter', viewer: 'Betrachter' }[role] ?? role ?? '';
}

export class ActivityPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   supabaseClient: object   – Supabase-Client mit .from()
     *   authManager:   import('../auth/AuthManager.js').AuthManager
     * }} options
     */
    constructor(container, { supabaseClient, authManager }) {
        if (!container) throw new Error('ActivityPanel: Container fehlt.');
        this.container  = container;
        this._supabase  = supabaseClient;
        this._auth      = authManager;

        this._projectId  = null;
        this._activities = [];
        this._timer      = null;

        this._build();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show() {
        this.container.style.display = '';
        this._startAutoRefresh();
    }

    hide() {
        this.container.style.display = 'none';
        this._stopAutoRefresh();
    }

    /**
     * Aktivitätsliste für ein Projekt laden.
     * @param {string} projectId
     */
    async refresh(projectId) {
        this._projectId = projectId ?? this._projectId;
        if (!this._projectId) return;

        this._setLoading(true);
        try {
            this._activities = await this.loadActivity(this._projectId);
            this._renderList();
        } catch (err) {
            this._renderEmpty(`Fehler beim Laden: ${err.message}`);
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Aktivitäten direkt aus Supabase laden.
     * @param {string} projectId
     * @returns {Promise<object[]>}
     */
    async loadActivity(projectId) {
        const { data, error } = await this._supabase
            .from('project_activity')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw new Error(error.message);
        return data ?? [];
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'activity-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'activity-panel__header';

        const title = document.createElement('h3');
        title.textContent = 'Aktivität';
        title.className   = 'activity-panel__title';
        header.appendChild(title);

        const refreshBtn = document.createElement('button');
        refreshBtn.type        = 'button';
        refreshBtn.textContent = 'Aktualisieren';
        refreshBtn.className   = 'activity-panel__refresh-btn';
        refreshBtn.addEventListener('click', () => this.refresh());
        header.appendChild(refreshBtn);

        this.container.appendChild(header);

        // Ladeindikator
        this._loadingEl = document.createElement('p');
        this._loadingEl.className    = 'activity-panel__loading';
        this._loadingEl.textContent  = 'Wird geladen …';
        this._loadingEl.style.display = 'none';
        this.container.appendChild(this._loadingEl);

        // Scrollbare Aktivitätsliste
        this._listEl = document.createElement('ul');
        this._listEl.className      = 'activity-panel__list';
        this._listEl.style.overflowY = 'auto';
        this._listEl.style.maxHeight = '400px';
        this.container.appendChild(this._listEl);
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderList() {
        this._listEl.innerHTML = '';

        if (this._activities.length === 0) {
            this._renderEmpty('Keine Aktivitäten vorhanden.');
            return;
        }

        for (const entry of this._activities) {
            const li = this._buildEntry(entry);
            this._listEl.appendChild(li);
        }
    }

    _buildEntry(entry) {
        const li = document.createElement('li');
        li.className = 'activity-panel__entry';

        // Icon
        const icon = document.createElement('span');
        icon.className   = 'activity-panel__icon';
        icon.textContent = this._iconForAction(entry.action);
        li.appendChild(icon);

        // Beschreibung
        const desc = document.createElement('span');
        desc.className   = 'activity-panel__desc';
        desc.textContent = this._describeAction(entry);
        li.appendChild(desc);

        // Benutzername
        if (entry.actorName || entry.actor_id) {
            const actor = document.createElement('span');
            actor.className   = 'activity-panel__actor';
            actor.textContent = entry.actorName || entry.actor_id;
            actor.style.color = '#888';
            li.appendChild(actor);
        }

        // Relativer Zeitstempel
        const time = document.createElement('span');
        time.className   = 'activity-panel__time';
        time.textContent = this._relativeTime(entry.created_at || entry.createdAt);
        time.title       = entry.created_at
            ? new Date(entry.created_at).toLocaleString('de-DE')
            : '';
        time.style.fontSize = '0.85em';
        time.style.color    = '#aaa';
        li.appendChild(time);

        return li;
    }

    _renderEmpty(msg) {
        this._listEl.innerHTML = '';
        const li = document.createElement('li');
        li.className   = 'activity-panel__empty';
        li.textContent = msg;
        this._listEl.appendChild(li);
    }


    // ------------------------------------------------------------------
    // Auto-Refresh
    // ------------------------------------------------------------------

    _startAutoRefresh() {
        if (this._timer) return;
        this._timer = setInterval(() => this.refresh(), AUTO_REFRESH_INTERVAL_MS);
    }

    _stopAutoRefresh() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
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

    _describeAction(entry) {
        const normalizedEntry = {
            ...entry,
            actorName: entry.actorName || entry.actor_name,
            actorId:   entry.actorId   || entry.actor_id,
            metadata:  entry.metadata  || entry.meta,
        };
        const fn = ACTION_LABELS[entry.action];
        return fn ? fn(normalizedEntry) : `${entry.action}`;
    }

    _iconForAction(action) {
        const icons = {
            PROJECT_SAVED:       '💾',
            MEMBER_INVITED:      '📨',
            MEMBER_JOINED:       '👋',
            MEMBER_LEFT:         '🚶',
            MEMBER_REMOVED:      '❌',
            VERSION_CREATED:     '📌',
            VERSION_RESTORED:    '⏪',
            INVITATION_ACCEPTED: '✅',
            INVITATION_DECLINED: '🚫',
            INVITATION_REVOKED:  '↩️',
            PROJECT_RENAMED:     '✏️',
        };
        return icons[action] ?? '•';
    }

    /**
     * Gibt einen relativen Zeitstempel zurück.
     * @param {string|undefined} isoString
     */
    _relativeTime(isoString) {
        if (!isoString) return '';
        const diff = Date.now() - new Date(isoString).getTime();
        const min  = Math.floor(diff / 60_000);
        const hrs  = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / 86_400_000);

        if (min < 1)   return 'gerade eben';
        if (min === 1) return 'vor 1 Min.';
        if (min < 60)  return `vor ${min} Min.`;
        if (hrs === 1) return 'vor 1 Std.';
        if (hrs < 24)  return `vor ${hrs} Std.`;
        if (days === 1) return 'gestern';
        return `vor ${days} Tagen`;
    }
}
