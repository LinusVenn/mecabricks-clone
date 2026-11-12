
export class TransformPanel {

    constructor(container, inputManager, gizmo) {
        if (!container) {
            throw new Error('TransformPanel benötigt einen Container.');
        }

        this.container = container;
        this.inputManager = inputManager;
        this.gizmo = gizmo;

        this._createUI();
        this.update();
    }

    _createUI() {
        this.container.innerHTML = '';

        const panel = document.createElement('div');
        panel.className = 'transform-panel';

        panel.innerHTML = `
            <h3>Transformation</h3>

            <div class="transform-section">
                <label for="transform-mode">Modus</label>
                <select id="transform-mode">
                    <option value="translate">Verschieben</option>
                    <option value="rotate">Drehen</option>
                </select>
            </div>

            <div class="transform-section">
                <label for="transform-space">Koordinatensystem</label>
                <select id="transform-space">
                    <option value="world">Global</option>
                    <option value="local">Lokal</option>
                </select>
            </div>

            <div class="transform-section">
                <h4>Position</h4>

                <div class="transform-input-row">
                    <label for="transform-x">X</label>
                    <input id="transform-x" type="number" step="0.5">
                </div>

                <div class="transform-input-row">
                    <label for="transform-y">Y</label>
                    <input id="transform-y" type="number" step="0.5">
                </div>

                <div class="transform-input-row">
                    <label for="transform-z">Z</label>
                    <input id="transform-z" type="number" step="0.5">
                </div>
            </div>

            <div class="transform-section">
                <h4>Rotation</h4>

                <div class="transform-input-row">
                    <label for="transform-rotation-y">Y (Grad)</label>
                    <input
                        id="transform-rotation-y"
                        type="number"
                        step="90"
                    >
                </div>
            </div>

            <p class="transform-status" aria-live="polite"></p>
        `;

        this.container.appendChild(panel);

        this.elements = {
            mode: panel.querySelector('#transform-mode'),
            space: panel.querySelector('#transform-space'),
            x: panel.querySelector('#transform-x'),
            y: panel.querySelector('#transform-y'),
            z: panel.querySelector('#transform-z'),
            rotationY: panel.querySelector('#transform-rotation-y'),
            status: panel.querySelector('.transform-status')
        };

        this._addStyles();
        this._bindEvents();
    }

    _addStyles() {
        if (document.getElementById('transform-panel-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'transform-panel-styles';

        style.textContent = `
            .transform-panel {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 14px;
                color: var(--panel-text, #eee);
                background: var(--panel-bg, #242424);
                font-family: sans-serif;
                font-size: 13px;
            }

            .transform-panel h3 {
                margin: 0;
                font-size: 16px;
            }

            .transform-section {
                display: flex;
                flex-direction: column;
                gap: 7px;
            }

            .transform-section h4 {
                margin: 0;
                font-size: 13px;
            }

            .transform-input-row {
                display: grid;
                grid-template-columns: 65px 1fr;
                align-items: center;
                gap: 8px;
            }

            .transform-panel input,
            .transform-panel select {
                min-width: 0;
                box-sizing: border-box;
                width: 100%;
                padding: 6px;
                color: inherit;
                background: #353535;
                border: 1px solid #555;
                border-radius: 4px;
            }

            .transform-panel input:disabled {
                opacity: 0.5;
            }

            .transform-status {
                min-height: 16px;
                margin: 0;
                color: #aaa;
            }
        `;

        document.head.appendChild(style);
    }

    _bindEvents() {
        this.elements.mode.addEventListener('change', () => {
            try {
                this.gizmo.setMode(this.elements.mode.value);
                this._setStatus('');
            } catch (error) {
                this.elements.mode.value = this.gizmo.getMode();
                this._setStatus(error.message);
            }
        });

        this.elements.space.addEventListener('change', () => {
            this.gizmo.setSpace(this.elements.space.value);
        });

        for (const axis of ['x', 'y', 'z']) {
            this.elements[axis].addEventListener('change', () => {
                const success = this.inputManager.setPosition(
                    axis,
                    this.elements[axis].value
                );

                this._handleResult(success);
                this.update();
            });
        }

        this.elements.rotationY.addEventListener('change', () => {
            const success = this.inputManager.setRotationY(
                this.elements.rotationY.value
            );

            this._handleResult(success);
            this.update();
        });
    }

    _handleResult(success) {
        if (success) {
            this._setStatus('Transformation übernommen.');
        } else {
            this._setStatus(
                'Transformation nicht möglich: Kollision oder keine Auswahl.'
            );
        }
    }

    _setStatus(message) {
        this.elements.status.textContent = message;
    }

    update() {
        const bricks = this.inputManager.getSelectedBricks();
        const hasSelection = bricks.length > 0;

        for (const element of [
            this.elements.x,
            this.elements.y,
            this.elements.z,
            this.elements.rotationY
        ]) {
            element.disabled = !hasSelection;
        }

        if (!hasSelection) {
            this.elements.x.value = '';
            this.elements.y.value = '';
            this.elements.z.value = '';
            this.elements.rotationY.value = '';
            return;
        }

        const center = this.inputManager.getCenter(bricks);

        this.elements.x.value = center.x.toFixed(2);
        this.elements.y.value = center.y.toFixed(2);
        this.elements.z.value = center.z.toFixed(2);

        this.elements.rotationY.value = (
            bricks[0].group.rotation.y * 180 / Math.PI
        ).toFixed(1);

        this.elements.mode.value = this.gizmo.getMode();
        this.elements.space.value = this.gizmo.getSpace();
    }

    dispose() {
        this.container.innerHTML = '';
    }
}
