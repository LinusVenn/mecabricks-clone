/**
 * Bindet die Gruppierungsleiste aus index.html an die Editor-Callbacks.
 * Die eigentliche Modelllogik bleibt in Editor.js.
 */
export class GroupToolbar {
    constructor() {
        this.root = document.getElementById('group-toolbar');
        this.info = document.getElementById('selection-info');

        this.buttons = {
            group: document.getElementById('btn-group'),
            ungroup: document.getElementById('btn-ungroup'),
            copy: document.getElementById('btn-copy-selection'),
            duplicate: document.getElementById('btn-duplicate-selection'),
            delete: document.getElementById('btn-delete-selection'),
        };

        this.onGroup = null;
        this.onUngroup = null;
        this.onCopy = null;
        this.onDuplicate = null;
        this.onDelete = null;
        this.onPaste = null;

        this._bindEvents();
        this.updateSelectionInfo(0, null);
    }

    _bindEvents() {
        this.buttons.group?.addEventListener('click', () => this.onGroup?.());
        this.buttons.ungroup?.addEventListener('click', () => this.onUngroup?.());
        this.buttons.copy?.addEventListener('click', () => this.onCopy?.());
        this.buttons.duplicate?.addEventListener('click', () => this.onDuplicate?.());
        this.buttons.delete?.addEventListener('click', () => this.onDelete?.());
    }

    /** Aktualisiert Anzeige und aktivierbare Aktionen. */
    updateSelectionInfo(count, groupName = null) {
        const selectedCount = Number.isFinite(count) ? count : 0;
        this.root?.classList.toggle('hidden', selectedCount === 0);

        if (this.info) {
            if (selectedCount === 0) {
                this.info.textContent = '';
            } else if (groupName) {
                this.info.textContent = `${selectedCount} Bauteil(e) · Gruppe: ${groupName}`;
            } else {
                this.info.textContent = `${selectedCount} Bauteil(e) ausgewählt`;
            }
        }

        if (this.buttons.group) this.buttons.group.disabled = selectedCount < 2 || !!groupName;
        if (this.buttons.ungroup) this.buttons.ungroup.disabled = !groupName;
        for (const key of ['copy', 'duplicate', 'delete']) {
            if (this.buttons[key]) this.buttons[key].disabled = selectedCount === 0;
        }
    }
}
