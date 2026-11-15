// =====================================================================
// PresenceIndicator – Phase J (Kollaboration)
//
// Zeigt an, welche Benutzer gerade in der Kollaborationssitzung online
// sind. Maximal 5 werden angezeigt, der Rest als "+N weitere".
// Aktualisiert sich automatisch wenn sich Präsenz ändert.
// =====================================================================

const MAX_VISIBLE = 5;

export class PresenceIndicator {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   presenceManager: import('../collaboration/PresenceManager.js').PresenceManager
     *   authManager:     import('../auth/AuthManager.js').AuthManager
     * }} options
     */
    constructor(container, { presenceManager, authManager }) {
        if (!container) throw new Error('PresenceIndicator: Container fehlt.');
        this.container  = container;
        this._presence  = presenceManager;
        this._auth      = authManager;

        this._unsubscribe = null;

        this._build();
        this._subscribeToPresence();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show() {
        this.container.style.display = '';
        this._subscribeToPresence();
    }

    hide() {
        this.container.style.display = 'none';
        this._unsubscribeFromPresence();
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'presence-indicator';

        const title = document.createElement('span');
        title.textContent = 'Online: ';
        title.className   = 'presence-indicator__label';
        this.container.appendChild(title);

        this._listEl = document.createElement('ul');
        this._listEl.className = 'presence-indicator__list';
        this.container.appendChild(this._listEl);

        // Tooltip für vollständige Liste
        this._tooltip = document.createElement('div');
        this._tooltip.className       = 'presence-indicator__tooltip';
        this._tooltip.style.display   = 'none';
        this._tooltip.style.position  = 'absolute';
        this._tooltip.style.zIndex    = '1000';
        this._tooltip.style.background = '#222';
        this._tooltip.style.color      = '#eee';
        this._tooltip.style.padding    = '8px 12px';
        this._tooltip.style.borderRadius = '4px';
        this._tooltip.style.fontSize   = '0.9em';
        this._tooltip.style.pointerEvents = 'none';
        this.container.style.position  = 'relative';
        this.container.appendChild(this._tooltip);

        this._render([]);
    }


    // ------------------------------------------------------------------
    // Präsenz-Abonnement
    // ------------------------------------------------------------------

    _subscribeToPresence() {
        if (this._unsubscribe) return;  // Bereits abonniert
        if (!this._presence?.subscribe) return;

        this._unsubscribe = this._presence.subscribe((members) => {
            this._render(members ?? []);
        });

        // Sofort rendern mit aktuellem Zustand
        const current = this._presence.getMembers?.() ?? [];
        this._render(current);
    }

    _unsubscribeFromPresence() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _render(members) {
        this._listEl.innerHTML = '';
        this._tooltip.style.display = 'none';

        if (!members || members.length === 0) {
            const li = document.createElement('li');
            li.className   = 'presence-indicator__empty';
            li.textContent = 'Niemand online';
            this._listEl.appendChild(li);
            return;
        }

        const visible = members.slice(0, MAX_VISIBLE);
        const hidden  = members.slice(MAX_VISIBLE);

        const currentUserId = this._auth?.currentUser?.id;

        for (const member of visible) {
            const li = this._buildMemberItem(member, member.userId === currentUserId);
            this._listEl.appendChild(li);
        }

        if (hidden.length > 0) {
            const moreItem = document.createElement('li');
            moreItem.className   = 'presence-indicator__more';
            moreItem.textContent = `+${hidden.length} weitere`;
            moreItem.style.cursor = 'pointer';

            // Tooltip bei Hover
            moreItem.addEventListener('mouseenter', (e) => {
                this._tooltip.innerHTML = hidden
                    .map(m => `<div>${this._escapeHtml(m.displayName || m.userId)}</div>`)
                    .join('');
                this._tooltip.style.display = '';
            });
            moreItem.addEventListener('mouseleave', () => {
                this._tooltip.style.display = 'none';
            });

            this._listEl.appendChild(moreItem);
        }
    }

    _buildMemberItem(member, isCurrentUser) {
        const li = document.createElement('li');
        li.className = 'presence-indicator__member';

        // Status-Dot
        const dot = document.createElement('span');
        dot.className = 'presence-indicator__dot';
        const online = member.status === 'online' || member.status === 'editing' || member.status === 'viewing';
        dot.style.display      = 'inline-block';
        dot.style.width        = '8px';
        dot.style.height       = '8px';
        dot.style.borderRadius = '50%';
        dot.style.marginRight  = '4px';
        dot.style.backgroundColor = online ? '#3c3' : '#888';
        dot.title = online ? 'Online' : 'Offline';
        li.appendChild(dot);

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.className   = 'presence-indicator__name';
        nameSpan.textContent = member.displayName || member.userId || 'Unbekannt';
        if (isCurrentUser) nameSpan.style.fontWeight = 'bold';
        li.appendChild(nameSpan);

        // Statustext
        const statusSpan = document.createElement('span');
        statusSpan.className   = 'presence-indicator__status-text';
        statusSpan.textContent = ` – ${this._statusText(member)}`;
        statusSpan.style.color    = '#999';
        statusSpan.style.fontSize = '0.85em';
        li.appendChild(statusSpan);

        return li;
    }


    // ------------------------------------------------------------------
    // Hilfsfunktionen
    // ------------------------------------------------------------------

    _statusText(member) {
        switch (member.status) {
            case 'editing':  return 'Bearbeitet gerade';
            case 'viewing':  return 'Sieht sich an';
            case 'online':   return 'Online';
            case 'offline': {
                if (member.lastSeenAt) {
                    const diffMin = Math.round((Date.now() - new Date(member.lastSeenAt).getTime()) / 60_000);
                    if (diffMin < 1)   return 'Gerade eben gesehen';
                    if (diffMin === 1) return 'Zuletzt aktiv vor 1 Min.';
                    return `Zuletzt aktiv vor ${diffMin} Min.`;
                }
                return 'Offline';
            }
            default:
                return member.status ?? 'Unbekannt';
        }
    }

    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
