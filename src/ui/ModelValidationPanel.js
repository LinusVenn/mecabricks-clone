/**
 * Benutzeroberfläche für die Ergebnisse der Phase-8.7-Modellprüfung.
 */
export class ValidationPanel {

    constructor(
        container,
        modelValidator,
        { onSelectResult = null } = {}
    ) {

        if (!container) {
            throw new Error('ValidationPanel: Container fehlt.');
        }

        if (!modelValidator) {
            throw new Error('ValidationPanel: ModelValidator fehlt.');
        }


        this.container =
            typeof container === 'string'
                ? document.querySelector(container)
                : container;


        if (!this.container) {
            throw new Error(
                'ValidationPanel: Container wurde nicht gefunden.'
            );
        }


        this.modelValidator = modelValidator;
        this.onSelectResult = onSelectResult;

        this.report = null;
        this.filter = 'all';
        this.isRunning = false;


        this._injectStyles();
        this._createLayout();
        this._bindEvents();

        this.render();
    }


    // --------------------------------------------------
    // CSS
    // --------------------------------------------------

    _injectStyles() {

        if (
            document.getElementById(
                'validation-panel-styles'
            )
        ) {
            return;
        }


        const style = document.createElement('style');

        style.id = 'validation-panel-styles';

        style.textContent = `

            .validation-panel {
                display: flex;
                flex-direction: column;
                gap: 10px;
                color: var(--text-color, #ddd);
                font-size: 13px;
            }

            .validation-panel h3 {
                margin: 0;
                font-size: 15px;
            }

            .validation-actions,
            .validation-filters {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }

            .validation-panel button {
                padding: 7px 9px;
                border: 1px solid #555;
                border-radius: 4px;
                background: #353535;
                color: #eee;
                cursor: pointer;
            }

            .validation-panel button:disabled {
                opacity: .5;
                cursor: wait;
            }

            .validation-panel button.primary {
                background: #315b82;
                border-color: #477eae;
            }

            .validation-summary {
                display: grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                gap: 6px;
            }

            .validation-stat {
                padding: 8px;
                background: #303030;
                border-radius: 4px;
                min-width: 0;
            }

            .validation-stat strong {
                display: block;
                font-size: 17px;
            }

            .validation-stat.error strong {
                color: #ff8585;
            }

            .validation-stat.warning strong {
                color: #e9c46a;
            }

            .validation-status {
                padding: 8px;
                border-radius: 4px;
                background: #303030;
                color: #ccc;
            }

            .validation-results {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 360px;
                overflow: auto;
            }

            .validation-item {
                display: flex;
                flex-direction: column;
                gap: 5px;
                text-align: left;
                width: 100%;
                background: #292929 !important;
                border-left: 3px solid #c99b3c !important;
            }

            .validation-item.error {
                border-left-color: #d65c5c !important;
            }

            .validation-item .title {
                font-weight: 700;
            }

            .validation-item .message {
                color: #bbb;
                white-space: normal;
                line-height: 1.35;
            }

            .validation-item .meta {
                font-size: 11px;
                color: #999;
            }

            .validation-empty {
                padding: 12px;
                text-align: center;
                color: #aaa;
                background: #303030;
                border-radius: 4px;
            }

            .validation-statistics {
                padding: 9px;
                background: #303030;
                border-radius: 4px;
                line-height: 1.7;
            }

            .validation-statistics ul {
                margin: 4px 0 0;
                padding-left: 18px;
            }
        `;


        document.head.appendChild(style);
    }


    // --------------------------------------------------
    // HTML-Layout
    // --------------------------------------------------

    _createLayout() {

        this.root = document.createElement('section');

        this.root.className = 'validation-panel';

        this.root.innerHTML = `

            <h3>Modellprüfung</h3>

            <div class="validation-actions">

                <button
                    type="button"
                    class="primary"
                    data-action="run"
                >
                    Prüfung starten
                </button>

                <button
                    type="button"
                    data-action="clear"
                >
                    Ergebnisse zurücksetzen
                </button>

            </div>


            <div
                class="validation-status"
                data-status
            >
                Die Modellprüfung wurde noch nicht ausgeführt.
            </div>


            <div
                class="validation-summary"
                data-summary
            ></div>


            <div class="validation-filters">

                <button
                    type="button"
                    data-filter="all"
                >
                    Alle
                </button>

                <button
                    type="button"
                    data-filter="error"
                >
                    Fehler
                </button>

                <button
                    type="button"
                    data-filter="warning"
                >
                    Warnungen
                </button>

            </div>


            <div
                class="validation-results"
                data-results
            ></div>


            <div
                class="validation-statistics"
                data-statistics
            ></div>
        `;


        this.container.appendChild(this.root);


        this.statusElement =
            this.root.querySelector('[data-status]');

        this.summaryElement =
            this.root.querySelector('[data-summary]');

        this.resultsElement =
            this.root.querySelector('[data-results]');

        this.statisticsElement =
            this.root.querySelector('[data-statistics]');

        this.runButton =
            this.root.querySelector('[data-action="run"]');
    }


    // --------------------------------------------------
    // Events
    // --------------------------------------------------

    _bindEvents() {

        this.root.addEventListener('click', event => {

            const actionButton =
                event.target.closest('[data-action]');


            if (actionButton) {

                if (actionButton.dataset.action === 'run') {
                    this.runValidation();
                }

                if (actionButton.dataset.action === 'clear') {
                    this.clear();
                }

                return;
            }


            const filterButton =
                event.target.closest('[data-filter]');


            if (filterButton) {

                this.filter =
                    filterButton.dataset.filter;

                this.render();

                return;
            }


            const resultButton =
                event.target.closest('[data-result-id]');


            if (resultButton) {

                const finding =
                    this.report?.findings.find(
                        item =>
                            item.id === resultButton.dataset.resultId
                    );

                if (finding) {
                    this.onSelectResult?.(finding);
                }
            }
        });
    }


    // --------------------------------------------------
    // Prüfung starten
    // --------------------------------------------------

    runValidation() {

        if (this.isRunning) return null;


        this.isRunning = true;

        this.runButton.disabled = true;

        this.runButton.textContent = 'Prüfung läuft …';

        this.statusElement.textContent =
            'Das Modell wird geprüft. Es werden keine Änderungen vorgenommen.';


        try {

            this.report =
                this.modelValidator.validate();

            this.statusElement.textContent =
                `Prüfung abgeschlossen in ${this.report.durationMs} ms.`;

            this.filter = 'all';

            this.render();

            return this.report;

        } catch (error) {

            this.statusElement.textContent =
                `Die Prüfung ist fehlgeschlagen: ${error?.message ?? String(error)}`;

            console.error(
                'ModelValidation:',
                error
            );

            return null;

        } finally {

            this.isRunning = false;

            this.runButton.disabled = false;

            this.runButton.textContent =
                'Prüfung starten';
        }
    }


    // --------------------------------------------------
    // Ergebnisse zurücksetzen
    // --------------------------------------------------

    clear() {

        this.report = null;
        this.filter = 'all';

        this.statusElement.textContent =
            'Die Ergebnisse wurden zurückgesetzt. Das Modell wurde nicht verändert.';

        this.render();
    }


    // --------------------------------------------------
    // Panel aktualisieren
    // --------------------------------------------------

    render() {

        const report = this.report;

        this.summaryElement.replaceChildren();
        this.resultsElement.replaceChildren();
        this.statisticsElement.replaceChildren();


        if (!report) {

            this._statCard('—', 'Fehler', 'error');
            this._statCard('—', 'Warnungen', 'warning');
            this._statCard('—', 'Prüfungen', '');

            this.resultsElement.append(
                this._empty(
                    'Starte die Modellprüfung, um Probleme und Hinweise anzuzeigen.'
                )
            );

            return;
        }


        this._statCard(
            report.summary.errors,
            'Fehler',
            'error'
        );

        this._statCard(
            report.summary.warnings,
            'Warnungen',
            'warning'
        );

        this._statCard(
            report.statistics.brickCount,
            'Bauteile',
            ''
        );


        const visible = report.findings.filter(item =>

            this.filter === 'all' ||
            item.severity === this.filter
        );


        if (visible.length === 0) {

            this.resultsElement.append(
                this._empty(
                    this.filter === 'all'
                        ? 'Keine Probleme gefunden.'
                        : 'Keine Einträge in dieser Kategorie.'
                )
            );

        } else {

            for (const finding of visible) {

                this.resultsElement.append(
                    this._resultButton(finding)
                );
            }
        }


        this._renderStatistics(
            report.statistics
        );
    }


    // --------------------------------------------------
    // Statistik-Karte
    // --------------------------------------------------

    _statCard(value, label, kind) {

        const card = document.createElement('div');

        card.className =
            `validation-stat ${kind}`;

        const strong =
            document.createElement('strong');

        strong.textContent = String(value);

        const caption =
            document.createElement('span');

        caption.textContent = label;

        card.append(strong, caption);

        this.summaryElement.append(card);
    }


    // --------------------------------------------------
    // Ergebnis-Button
    // --------------------------------------------------

    _resultButton(finding) {

        const button =
            document.createElement('button');

        button.type = 'button';

        button.className =
            `validation-item ${finding.severity}`;

        button.dataset.resultId = finding.id;


        const title =
            document.createElement('span');

        title.className = 'title';

        title.textContent =
            `${finding.severity === 'error' ? 'Fehler' : 'Warnung'}: ${finding.title}`;


        const message =
            document.createElement('span');

        message.className = 'message';

        message.textContent = finding.message;


        const meta =
            document.createElement('span');

        meta.className = 'meta';

        meta.textContent =
            finding.brickIds.length
                ? `${finding.brickIds.length} betroffenes Bauteil(e) · Anklicken zum Auswählen`
                : finding.code;


        button.append(title, message, meta);


        if (finding.suggestion) {

            const suggestion =
                document.createElement('span');

            suggestion.className = 'message';

            suggestion.textContent =
                `Vorschlag: ${finding.suggestion}`;

            button.append(suggestion);
        }


        if (finding.details?.length) {

            const details =
                document.createElement('span');

            details.className = 'meta';

            details.textContent =
                finding.details.join(', ');

            button.append(details);
        }


        button.disabled =
            finding.brickIds.length === 0;

        return button;
    }


    // --------------------------------------------------
    // Modellstatistik darstellen
    // --------------------------------------------------

    _renderStatistics(stats) {

        const heading =
            document.createElement('strong');

        heading.textContent =
            'Modellstatistik';


        const line =
            document.createElement('div');

        line.textContent =
            `${stats.brickCount} Bauteile · ` +
            `${stats.groupCount} Baugruppen · ` +
            `${stats.connectionCount} Verbindungen · ` +
            `${stats.componentCount} Komponenten`;


        const detail =
            document.createElement('div');

        detail.textContent =
            `${stats.typeCount} Bauteiltypen · ${stats.colorCount} Farben`;


        const dimensions =
            document.createElement('div');

        dimensions.textContent =
            `Modellabmessungen: ` +
            `${stats.dimensions.width} × ` +
            `${stats.dimensions.height} × ` +
            `${stats.dimensions.depth}`;


        this.statisticsElement.append(
            heading,
            line,
            detail,
            dimensions
        );


        if (stats.types.length) {

            const list =
                document.createElement('ul');

            for (const item of stats.types.slice(0, 8)) {

                const li =
                    document.createElement('li');

                li.textContent =
                    `${item.type}: ${item.count}`;

                list.append(li);
            }

            this.statisticsElement.append(list);
        }
    }


    // --------------------------------------------------
    // Leerer Zustand
    // --------------------------------------------------

    _empty(message) {

        const element =
            document.createElement('div');

        element.className =
            'validation-empty';

        element.textContent = message;

        return element;
    }


    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    dispose() {

        this.root?.remove();
    }
}