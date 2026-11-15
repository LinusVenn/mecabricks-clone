// =====================================================================
// PermissionPanel – Phase J (Kollaboration)
//
// Einfaches Anzeige-Panel, das die aktuelle Rolle des Benutzers
// sowie eine Zusammenfassung der Berechtigungen zeigt.
// Keine interaktiven Elemente – rein informativ.
// =====================================================================

export class PermissionPanel {

    /**
     * @param {HTMLElement} container
     * @param {{
     *   permissionManager: import('../collaboration/PermissionManager.js').PermissionManager
     * }} options
     */
    constructor(container, { permissionManager }) {
        if (!container) throw new Error('PermissionPanel: Container fehlt.');
        this.container = container;
        this._perms    = permissionManager;

        this._build();

        // Aktualisieren wenn sich die Rolle ändert
        this._perms.subscribe?.(() => this.update());
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    show()  { this.container.style.display = ''; }
    hide()  { this.container.style.display = 'none'; }

    /** Rollenanzeige und Berechtigungsübersicht neu zeichnen. */
    update() {
        this._renderRole();
        this._renderPermissions();
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        this.container.innerHTML = '';
        this.container.className = 'permission-panel';

        const title = document.createElement('h3');
        title.textContent = 'Meine Berechtigungen';
        title.className   = 'permission-panel__title';
        this.container.appendChild(title);

        // Rollenbadge
        this._roleEl = document.createElement('div');
        this._roleEl.className = 'permission-panel__role';
        this.container.appendChild(this._roleEl);

        // Berechtigungs-Übersicht
        this._permListEl = document.createElement('ul');
        this._permListEl.className = 'permission-panel__perm-list';
        this.container.appendChild(this._permListEl);

        this.update();
    }


    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderRole() {
        const labels = {
            owner:   'Eigentümer',
            editor:  'Bearbeiter',
            viewer:  'Betrachter',
        };
        const role  = this._perms.role;
        const label = labels[role] ?? 'Lokal';

        this._roleEl.textContent = label;
        this._roleEl.dataset.role = role ?? 'local';

        // Farbkodierung
        const colors = { owner: '#2a7', editor: '#27a', viewer: '#666' };
        this._roleEl.style.color      = colors[role] ?? '#444';
        this._roleEl.style.fontWeight = 'bold';
        this._roleEl.style.fontSize   = '1.1em';
    }

    _renderPermissions() {
        this._permListEl.innerHTML = '';

        const perms = [
            {
                label: 'Ansehen',
                granted: true,    // Alle Rollen können sehen
            },
            {
                label: 'Bearbeiten',
                granted: this._perms.canEdit ?? false,
            },
            {
                label: 'Verwalten (Einladen / Entfernen)',
                granted: this._perms.canManage ?? false,
            },
            {
                label: 'Versionen wiederherstellen',
                granted: this._perms.canRestoreVersion ?? false,
            },
        ];

        for (const perm of perms) {
            const li = document.createElement('li');
            li.className = 'permission-panel__perm-item';

            const icon = document.createElement('span');
            icon.className   = 'permission-panel__perm-icon';
            icon.textContent = perm.granted ? '✓' : '✗';
            icon.style.color = perm.granted ? '#060' : '#c00';
            li.appendChild(icon);

            const labelSpan = document.createElement('span');
            labelSpan.className   = 'permission-panel__perm-label';
            labelSpan.textContent = perm.label;
            li.appendChild(labelSpan);

            this._permListEl.appendChild(li);
        }
    }
}
