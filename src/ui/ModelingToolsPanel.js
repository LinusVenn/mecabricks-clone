/** Kompaktes UI für die in Phase K eingeführten Modellierungsmanager. */
export class ModelingToolsPanel {
    constructor({ container, phaseK, getSelection, onModelChanged = null }) {
        if (!container || !phaseK || typeof getSelection !== 'function') {
            throw new Error('ModelingToolsPanel benötigt container, phaseK und getSelection.');
        }
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('ModelingToolsPanel: Container nicht gefunden.');
        this.phaseK = phaseK;
        this.getSelection = getSelection;
        this.onModelChanged = onModelChanged;
        this._render();
    }

    _render() {
        this.container.innerHTML = `
          <section class="modeling-tools-panel">
            <h3>Modellierungswerkzeuge</h3>
            <div class="mk-row"><label>Verschieben X</label><input data-field="dx" type="number" step="1" value="0"><label>Y</label><input data-field="dy" type="number" step="1" value="0"><label>Z</label><input data-field="dz" type="number" step="1" value="0"></div>
            <button data-action="translate">Verschieben</button>
            <div class="mk-row"><label>Drehung Y (°)</label><input data-field="rotateY" type="number" step="15" value="90"><label>Skalierung</label><input data-field="scale" type="number" step="0.1" min="0.01" value="1"></div>
            <button data-action="rotate">Y-Rotation anwenden</button><button data-action="scale">Einheitlich skalieren</button>
            <hr>
            <div class="mk-row"><label>Muster</label><select data-field="patternType"><option value="linear">Linear</option><option value="circular">Kreisförmig</option><option value="grid">Raster</option></select><label>Achse</label><select data-field="axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></div>
            <div class="mk-row"><label>Anzahl</label><input data-field="count" type="number" min="1" max="100" value="3"><label>Abstand X</label><input data-field="spacing" type="number" min="0.01" step="1" value="20"></div>
            <div class="mk-row"><label>Anzahl Y</label><input data-field="countY" type="number" min="1" max="100" value="3"><label>Abstand Y</label><input data-field="spacingY" type="number" min="0.01" step="1" value="20"></div>
            <div class="mk-row"><label>Winkel (°)</label><input data-field="angle" type="number" min="1" max="360" value="360"><label>Rasterebene</label><select data-field="plane"><option value="xy">XY</option><option value="xz">XZ</option><option value="yz">YZ</option></select></div>
            <button data-action="duplicate">Auswahl duplizieren</button><button data-action="pattern">Muster erstellen</button>
            <div class="mk-row"><label>Gruppe</label><input data-field="groupName" type="text" value="Neue Gruppe"></div>
            <button data-action="group">Auswahl gruppieren</button>
            <div class="mk-row"><label>Gruppe auflösen</label><select data-field="groupId"></select></div>
            <button data-action="ungroup">Gruppe auflösen</button>
            <div class="mk-row"><label>Baugruppe</label><select data-field="assemblyId"></select></div>
            <button data-action="enterAssembly">Baugruppe bearbeiten</button><button data-action="exitAssembly">Bearbeitung verlassen</button>
            <button data-action="lockAssembly">Baugruppe sperren</button><button data-action="unlockAssembly">Baugruppe entsperren</button>
            <div class="mk-row"><label>Ausrichtung</label><select data-field="align"><option value="left">Links</option><option value="centerX">Mitte X</option><option value="right">Rechts</option><option value="top">Oben</option><option value="centerY">Mitte Y</option><option value="bottom">Unten</option><option value="front">Vorne</option><option value="centerZ">Mitte Z</option><option value="back">Hinten</option></select></div>
            <button data-action="align">Ausrichten</button>
            <button data-action="measure">Abstand der ersten zwei Bauteile messen</button>
            <button data-action="validate">Modell prüfen</button>
            <div class="mk-row"><button data-action="undo">K-Undo</button><button data-action="redo">K-Redo</button></div>
            <p class="mk-status" aria-live="polite">Bauteile auswählen, um Werkzeuge zu verwenden.</p>
          </section>`;
        if (!document.getElementById('modeling-tools-panel-style')) {
            const style = document.createElement('style');
            style.id = 'modeling-tools-panel-style';
            style.textContent = `.modeling-tools-panel{display:flex;flex-direction:column;gap:8px;padding:12px;color:var(--panel-text,#eee);font:13px sans-serif}.modeling-tools-panel h3{margin:0}.modeling-tools-panel .mk-row{display:grid;grid-template-columns:auto minmax(45px,1fr) auto minmax(45px,1fr);align-items:center;gap:5px}.modeling-tools-panel input,.modeling-tools-panel select{min-width:0;width:100%;box-sizing:border-box;padding:5px;background:#353535;color:inherit;border:1px solid #555;border-radius:4px}.modeling-tools-panel button{padding:7px;background:#353535;color:inherit;border:1px solid #555;border-radius:4px;cursor:pointer}.modeling-tools-panel button:disabled{opacity:.45;cursor:not-allowed}.modeling-tools-panel hr{width:100%;border:0;border-top:1px solid #555}.modeling-tools-panel .mk-status{min-height:18px;margin:0;color:#aaa}`;
            document.head.appendChild(style);
        }
        this.container.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', () => this._run(button.dataset.action));
        });
        this.update();
    }

    _value(name) { return this.container.querySelector(`[data-field="${name}"]`)?.value; }
    _status(message, error = false) {
        const node = this.container.querySelector('.mk-status');
        node.textContent = message;
        node.style.color = error ? '#ff8585' : '#aaa';
    }

    async _run(action) {
        const selected = this.getSelection();
        try {
            if (!['validate', 'enterAssembly', 'exitAssembly', 'lockAssembly', 'unlockAssembly', 'ungroup', 'undo', 'redo'].includes(action) && selected.length === 0) throw new Error('Bitte zuerst mindestens ein Bauteil auswählen.');
            if (action === 'translate') {
                const delta = { x: Number(this._value('dx')), y: Number(this._value('dy')), z: Number(this._value('dz')) };
                await this.phaseK.transformManager.applyToSelection(selected, (brick, state) => ({ position: { x: state.position.x + delta.x, y: state.position.y + delta.y, z: state.position.z + delta.z } }));
            } else if (action === 'rotate') {
                const angle = Number(this._value('rotateY')) * Math.PI / 180;
                await this.phaseK.transformManager.applyToSelection(selected, (brick, state) => ({ rotation: { ...state.rotation, y: state.rotation.y + angle } }));
            } else if (action === 'scale') {
                const factor = Number(this._value('scale'));
                if (!Number.isFinite(factor) || factor <= 0) throw new Error('Skalierung muss größer als 0 sein.');
                await this.phaseK.transformManager.applyToSelection(selected, (brick, state) => ({ scale: { x: state.scale.x * factor, y: state.scale.y * factor, z: state.scale.z * factor } }));
            } else if (action === 'duplicate') {
                await this.phaseK.duplicationManager.duplicateSelection(selected);
            } else if (action === 'pattern') {
                const type = this._value('patternType');
                const count = Number(this._value('count'));
                if (type === 'linear') {
                    await this.phaseK.patternManager.createLinearPattern({ objects: selected, axis: this._value('axis'), count, spacing: Number(this._value('spacing')) });
                } else if (type === 'circular') {
                    await this.phaseK.patternManager.createCircularPattern({ objects: selected, axis: this._value('axis'), count, angle: Number(this._value('angle')) * Math.PI / 180 });
                } else {
                    await this.phaseK.patternManager.createGridPattern({ objects: selected, countX: count, countY: Number(this._value('countY')), spacingX: Number(this._value('spacing')), spacingY: Number(this._value('spacingY')), plane: this._value('plane') });
                }
            } else if (action === 'group') {
                await this.phaseK.groupExtension.createGroup(selected, this._value('groupName') || 'Gruppe');
            } else if (action === 'align') {
                const method = ({ left: 'alignLeft', centerX: 'alignCenterX', right: 'alignRight', top: 'alignTop', centerY: 'alignCenterY', bottom: 'alignBottom', front: 'alignFront', centerZ: 'alignCenterZ', back: 'alignBack' })[this._value('align')];
                await this.phaseK.alignmentManager[method](selected);
            } else if (action === 'ungroup') {
                const groupId = this._value('groupId');
                if (!groupId) throw new Error('Bitte eine Gruppe auswählen.');
                await this.phaseK.groupExtension.ungroup(groupId);
            } else if (action === 'enterAssembly') {
                const assembly = this.phaseK.assemblyManager?.getAssembly?.(this._value('assemblyId'));
                if (!assembly || !this.phaseK.assemblyEditingManager.enterAssembly(assembly)) throw new Error('Baugruppe konnte nicht geöffnet werden.');
            } else if (action === 'exitAssembly') {
                this.phaseK.assemblyEditingManager.exitAssembly();
            } else if (action === 'lockAssembly' || action === 'unlockAssembly') {
                const assembly = this.phaseK.assemblyManager?.getAssembly?.(this._value('assemblyId'));
                if (!assembly) throw new Error('Bitte eine Baugruppe auswählen.');
                if (action === 'lockAssembly') await this.phaseK.assemblyEditingManager.lockAssembly(assembly);
                else await this.phaseK.assemblyEditingManager.unlockAssembly(assembly);
            } else if (action === 'measure') {
                if (selected.length < 2) throw new Error('Für eine Abstandsmessung zwei Bauteile auswählen.');
                const result = this.phaseK.measurementManager.measureObjectDistance(selected[0], selected[1], { draw: true });
                this._status(`Abstand: ${result.value.toFixed(3)} ${result.unit}`);
                this.onModelChanged?.({ type: 'measure', result });
                return;
            } else if (action === 'undo') {
                if (!await this.phaseK.commandHistory.undo()) throw new Error('Kein Phase-K-Schritt zum Rückgängigmachen vorhanden.');
            } else if (action === 'redo') {
                if (!await this.phaseK.commandHistory.redo()) throw new Error('Kein Phase-K-Schritt zum Wiederherstellen vorhanden.');
            } else if (action === 'validate') {
                const report = this.phaseK.modelValidationManager.validateModel();
                this._status(`Prüfung abgeschlossen: ${report.errorCount} Fehler, ${report.warningCount} Warnungen.`);
                this.onModelChanged?.({ type: 'validation', report });
                return;
            }
            this._status('Operation erfolgreich ausgeführt.');
            this.onModelChanged?.({ type: action });
        } catch (error) {
            this._status(error.message || 'Operation fehlgeschlagen.', true);
        }
    }

    _refreshSelect(select, items) {
        if (!select) return;
        const previous = select.value;
        select.innerHTML = '';
        for (const item of items) {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            select.appendChild(option);
        }
        if (items.some(item => item.value === previous)) select.value = previous;
    }

    update() {
        const hasSelection = this.getSelection().length > 0;
        const groupSelect = this.container.querySelector('[data-field="groupId"]');
        const assemblySelect = this.container.querySelector('[data-field="assemblyId"]');
        this._refreshSelect(groupSelect, this.phaseK.groupExtension.getAllGroups().map(group => ({ value: group.id, label: group.name })));
        this._refreshSelect(assemblySelect, (this.phaseK.assemblyManager?.getAllAssemblies?.() ?? []).map(assembly => ({ value: assembly.id, label: assembly.name })));
        this.container.querySelectorAll('[data-action]').forEach(button => {
            const action = button.dataset.action;
            if (action === 'validate' || action === 'exitAssembly') button.disabled = false;
            else if (action === 'undo') button.disabled = !this.phaseK.commandHistory.canUndo;
            else if (action === 'redo') button.disabled = !this.phaseK.commandHistory.canRedo;
            else if (['lockAssembly', 'unlockAssembly', 'enterAssembly'].includes(action)) button.disabled = !assemblySelect?.value;
            else if (action === 'ungroup') button.disabled = !groupSelect?.value;
            else button.disabled = !hasSelection;
        });
    }
}
