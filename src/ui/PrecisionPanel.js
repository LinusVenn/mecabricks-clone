
export class PrecisionPanel {
    constructor(container, precisionManager) {
        if (!container || !precisionManager) {
            throw new Error('PrecisionPanel benötigt Container und PrecisionManager.');
        }

        this.container = container;
        this.manager = precisionManager;

        this._build();
    }

    _element(tag, text = '') {
        const element = document.createElement(tag);

        if (text) element.textContent = text;

        return element;
    }

    _button(parent, text, callback) {
        const button = this._element('button', text);
        button.type = 'button';
        button.addEventListener('click', () => {
            try {
                callback();
                this.update();
            } catch (error) {
                console.error(error);
                window.alert(error.message);
            }
        });

        parent.appendChild(button);
        return button;
    }

    _section(title) {
        const section = this._element('section');
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '6px';
        section.style.marginBottom = '14px';

        const heading = this._element('h4', title);
        section.appendChild(heading);

        this.content.appendChild(section);
        return section;
    }

    _buttonRow(parent, buttons) {
        const row = this._element('div');
        row.style.display = 'flex';
        row.style.flexWrap = 'wrap';
        row.style.gap = '5px';

        parent.appendChild(row);

        for (const [label, callback] of buttons) {
            this._button(row, label, callback);
        }

        return row;
    }

    _numberInput(parent, labelText, value = 0, step = 0.5) {
        const label = this._element('label', labelText);
        label.style.display = 'flex';
        label.style.flexDirection = 'column';
        label.style.gap = '3px';

        const input = this._element('input');
        input.type = 'number';
        input.step = String(step);
        input.value = String(value);

        label.appendChild(input);
        parent.appendChild(label);

        return input;
    }

    _build() {
        this.container.replaceChildren();

        const heading = this._element('h3', 'Präzisionswerkzeuge');
        this.container.appendChild(heading);

        this.content = this._element('div');
        this.content.style.display = 'flex';
        this.content.style.flexDirection = 'column';
        this.content.style.gap = '8px';

        this.container.appendChild(this.content);

        this._buildAlignment();
        this._buildDistribution();
        this._buildMirror();
        this._buildMeasurement();
        this._buildSnap();
        this._buildStatus();

        this.update();
    }

    _buildAlignment() {
        const section = this._section('Ausrichten');

        this._buttonRow(section, [
            ['Links', () => this.manager.alignment.alignLeft()],
            ['Rechts', () => this.manager.alignment.alignRight()],
            ['Mitte X', () => this.manager.alignment.alignCenterX()]
        ]);

        this._buttonRow(section, [
            ['Oben', () => this.manager.alignment.alignTop()],
            ['Unten', () => this.manager.alignment.alignBottom()],
            ['Mitte Y', () => this.manager.alignment.alignCenterY()]
        ]);

        this._buttonRow(section, [
            ['Vorne', () => this.manager.alignment.alignFront()],
            ['Hinten', () => this.manager.alignment.alignBack()],
            ['Mitte Z', () => this.manager.alignment.alignCenterZ()]
        ]);

        const note = this._element(
            'small',
            'Ohne Referenzobjekt wird an den äußeren Auswahlgrenzen ausgerichtet.'
        );

        section.appendChild(note);
    }

    _buildDistribution() {
        const section = this._section('Gleichmäßig verteilen');

        this._buttonRow(section, [
            ['X verteilen', () => this.manager.distribution.distributeX()],
            ['Y verteilen', () => this.manager.distribution.distributeY()],
            ['Z verteilen', () => this.manager.distribution.distributeZ()]
        ]);

        section.appendChild(
            this._element(
                'small',
                'Mindestens drei Bauteile auswählen. Die äußeren Bauteile bleiben stehen.'
            )
        );
    }

    _buildMirror() {
        const section = this._section('Spiegeln');

        this.mirrorPlane = this._numberInput(
            section,
            'Spiegelebene (Koordinatenwert)',
            0,
            0.5
        );

        this._buttonRow(section, [
            ['X spiegeln', () => this.manager.mirror.mirrorX(Number(this.mirrorPlane.value))],
            ['Y spiegeln', () => this.manager.mirror.mirrorY(Number(this.mirrorPlane.value))],
            ['Z spiegeln', () => this.manager.mirror.mirrorZ(Number(this.mirrorPlane.value))]
        ]);

        this._buttonRow(section, [
            ['Mitte X', () => this.manager.mirror.mirrorAroundSelectionCenter('x')],
            ['Mitte Y', () => this.manager.mirror.mirrorAroundSelectionCenter('y')],
            ['Mitte Z', () => this.manager.mirror.mirrorAroundSelectionCenter('z')]
        ]);

        section.appendChild(
            this._element(
                'small',
                'Spiegelt Position und unterstützte Drehungen. Asymmetrische Bauteilgeometrie wird nicht umgekehrt.'
            )
        );
    }

    _buildMeasurement() {
        const section = this._section('Messen');

        this._button(
            section,
            'Abmessungen der Auswahl anzeigen',
            () => this._showDimensions()
        );

        this._button(
            section,
            'Messlinien entfernen',
            () => {
                this.manager.clearMeasurements();
                this.measurementOutput.textContent = 'Messlinien entfernt.';
            }
        );

        this.measurementOutput = this._element('pre');
        this.measurementOutput.style.whiteSpace = 'pre-wrap';
        this.measurementOutput.style.fontSize = '12px';
        section.appendChild(this.measurementOutput);
    }

    _showDimensions() {
        const dimensions = this.manager.measurement.getSelectionDimensions();

        if (!dimensions) {
            this.measurementOutput.textContent = 'Keine Bauteile ausgewählt.';
            return;
        }

        this.measurementOutput.textContent = [
            `Breite (X): ${dimensions.width.toFixed(3)}`,
            `Höhe (Y): ${dimensions.height.toFixed(3)}`,
            `Tiefe (Z): ${dimensions.depth.toFixed(3)}`,
            '',
            `Mittelpunkt X: ${dimensions.center.x.toFixed(3)}`,
            `Mittelpunkt Y: ${dimensions.center.y.toFixed(3)}`,
            `Mittelpunkt Z: ${dimensions.center.z.toFixed(3)}`
        ].join('\n');
    }

    _buildSnap() {
        const section = this._section('Erweitertes Einrasten');

        const enabledLabel = this._element('label');
        this.snapEnabled = this._element('input');
        this.snapEnabled.type = 'checkbox';
        this.snapEnabled.checked = true;

        this.snapEnabled.addEventListener('change', () => {
            this.manager.snap.setEnabled(this.snapEnabled.checked);
        });

        enabledLabel.appendChild(this.snapEnabled);
        enabledLabel.appendChild(
            document.createTextNode(' Snap aktivieren')
        );

        section.appendChild(enabledLabel);

        const modeLabel = this._element('label', 'Snap-Modus');
        this.snapMode = this._element('select');

        for (const [value, text] of [
            ['grid', 'Raster'],
            ['vertex', 'Vertex'],
            ['edge', 'Kante'],
            ['face', 'Fläche'],
            ['center', 'Mittelpunkt']
        ]) {
            const option = this._element('option', text);
            option.value = value;
            this.snapMode.appendChild(option);
        }

        this.snapMode.addEventListener('change', () => {
            this.manager.snap.setMode(this.snapMode.value);
        });

        modeLabel.appendChild(this.snapMode);
        section.appendChild(modeLabel);

        this.snapThreshold = this._numberInput(
            section,
            'Snap-Abstand',
            0.35,
            0.05
        );

        this.snapThreshold.addEventListener('change', () => {
            const value = Number(this.snapThreshold.value);

            if (Number.isFinite(value) && value > 0) {
                this.manager.snap.setThreshold(value);
            }
        });

        this.gridSize = this._numberInput(
            section,
            'Rastergröße',
            this.manager.snap.gridSize,
            0.5
        );

        this.gridSize.addEventListener('change', () => {
            const value = Number(this.gridSize.value);

            if (Number.isFinite(value) && value > 0) {
                this.manager.snap.setGridSize(value);
            }
        });
    }

    _buildStatus() {
        const section = this._section('Status');

        this.status = this._element('small');
        section.appendChild(this.status);
    }

    update() {
        const count = this.manager.getSelectionCount();

        this.status.textContent =
            `${count} Bauteil(e) ausgewählt.`;
    }

    dispose() {
        this.manager.clearMeasurements();
        this.container.replaceChildren();
    }
}
