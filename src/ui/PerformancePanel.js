// =====================================================================
// PerformancePanel – Schritt 7 (Phase 8.8)
//
// Zeigt Laufzeitkennzahlen an und steuert die Optimierungen:
//   • Instancing aktivieren / deaktivieren
//   • Sichtbarkeitsoptimierung aktivieren / deaktivieren
//   • Performance-Monitor ein- / ausblenden
//   • Schattenoptimierung steuern
//   • Ladefortschritt anzeigen
// =====================================================================


export class PerformancePanel {

    /**
     * @param {HTMLElement}                                              container
     * @param {import('../performance/PerformanceManager.js').PerformanceManager} performanceManager
     */
    constructor(container, performanceManager) {
        this._container = container;
        this._pm        = performanceManager;

        this._metricsEl  = null;
        this._progressEl = null;
        this._rafId      = null;

        this._build();
        this._startMetricsLoop();
    }


    // ------------------------------------------------------------------
    // Aufbau
    // ------------------------------------------------------------------

    _build() {
        const c = this._container;
        c.innerHTML = '';

        // ── Instancing ──────────────────────────────────────────────
        const instGroup  = this._makeGroup('Instancing');
        const instToggle = this._makeCheckbox(
            instGroup,
            'Instancing aktivieren',
            this._pm.instanceManager.enabled,
            checked => {
                if (checked) {
                    this._pm.enableInstancing();
                } else {
                    this._pm.disableInstancing();
                }
            }
        );
        this._instToggle = instToggle;

        const rebuildBtn = this._makeButton(instGroup, 'Neu aufbauen', () => {
            if (this._pm.instanceManager.enabled) {
                this._pm.instanceManager.rebuild();
            }
        });
        rebuildBtn.title = 'InstancedMesh-Daten neu berechnen';


        // ── Sichtbarkeitsoptimierung ─────────────────────────────────
        const visGroup  = this._makeGroup('Frustum Culling');
        this._makeCheckbox(
            visGroup,
            'Sichtbarkeitsoptimierung aktivieren',
            this._pm.visibilityOptimizer.enabled,
            checked => {
                if (checked) {
                    this._pm.enableVisibilityOptimizer();
                } else {
                    this._pm.disableVisibilityOptimizer();
                }
            }
        );


        // ── Schattenoptimierung ──────────────────────────────────────
        const shadowGroup = this._makeGroup('Schatten');
        this._makeCheckbox(
            shadowGroup,
            'Schattenoptimierung aktivieren',
            this._pm.isShadowOptimizationEnabled(),
            checked => {
                if (checked) {
                    this._pm.enableShadowOptimization();
                } else {
                    this._pm.disableShadowOptimization();
                }
            }
        );


        // ── Performance-Monitor ──────────────────────────────────────
        const monGroup  = this._makeGroup('Performance-Monitor');
        const monToggle = this._makeCheckbox(
            monGroup,
            'Metriken anzeigen',
            this._pm.performanceMonitor.isEnabled(),
            checked => {
                if (checked) {
                    this._pm.enableMonitor();
                    this._metricsEl.style.display = '';
                } else {
                    this._pm.disableMonitor();
                    this._metricsEl.style.display = 'none';
                }
            }
        );

        this._metricsEl = document.createElement('table');
        this._metricsEl.className = 'perf-metrics-table';
        this._metricsEl.style.fontSize    = '11px';
        this._metricsEl.style.width       = '100%';
        this._metricsEl.style.borderCollapse = 'collapse';
        if (!this._pm.performanceMonitor.isEnabled()) {
            this._metricsEl.style.display = 'none';
        }
        monGroup.appendChild(this._metricsEl);


        // ── Ladefortschritt ──────────────────────────────────────────
        const loadGroup     = this._makeGroup('Gestaffeltes Laden');
        this._progressEl    = document.createElement('div');
        this._progressEl.style.fontSize = '11px';
        this._progressEl.style.color    = '#888';
        this._progressEl.textContent    = 'Kein Ladevorgang aktiv.';
        loadGroup.appendChild(this._progressEl);

        const loadAbortBtn = this._makeButton(loadGroup, 'Laden abbrechen', () => {
            this._pm.modelLoadingManager.abort();
        });
        loadAbortBtn.disabled = true;
        this._loadAbortBtn = loadAbortBtn;
    }


    // ------------------------------------------------------------------
    // Fortschritts-Anzeige (von außen aufrufbar)
    // ------------------------------------------------------------------

    /**
     * Zeigt den Ladefortschritt an.
     * @param {number} loaded
     * @param {number} total
     */
    showProgress(loaded, total) {
        if (!this._progressEl) return;
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        this._progressEl.textContent =
            `Lade … ${loaded} / ${total} Bauteile (${pct}%)`;

        if (this._loadAbortBtn) this._loadAbortBtn.disabled = false;
    }


    /** Zeigt an, dass der Ladevorgang abgeschlossen ist. */
    showLoadComplete(totalMs = 0) {
        if (!this._progressEl) return;
        this._progressEl.textContent =
            `Laden abgeschlossen (${totalMs} ms)`;
        if (this._loadAbortBtn) this._loadAbortBtn.disabled = true;
    }


    /** Zeigt an, dass der Ladevorgang abgebrochen wurde. */
    showLoadAborted() {
        if (!this._progressEl) return;
        this._progressEl.textContent = 'Laden abgebrochen.';
        if (this._loadAbortBtn) this._loadAbortBtn.disabled = true;
    }


    // ------------------------------------------------------------------
    // Metriken-Schleife
    // ------------------------------------------------------------------

    _startMetricsLoop() {
        const tick = () => {
            if (this._pm.performanceMonitor.isEnabled()) {
                this._updateMetricsTable();
            }
            this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    }


    _updateMetricsTable() {
        const m = this._pm.getMetrics();
        const rows = [
            ['FPS',          m.fps],
            ['Draw Calls',   m.drawCalls],
            ['Dreiecke',     m.triangles.toLocaleString()],
            ['Objekte',      m.objects],
            ['Geometrien',   m.geometries],
            ['Texturen',     m.textures],
            ['Materialien',  m.materials],
            ['Ladezeit',     `${m.loadTime} ms`]
        ];

        if (!this._metricsEl) return;

        this._metricsEl.innerHTML = rows.map(([label, value]) =>
            `<tr>
               <td style="padding:1px 4px;color:#aaa">${label}</td>
               <td style="padding:1px 4px;text-align:right;font-weight:bold">${value}</td>
             </tr>`
        ).join('');
    }


    // ------------------------------------------------------------------
    // UI-Helfer
    // ------------------------------------------------------------------

    _makeGroup(title) {
        const group = document.createElement('div');
        group.className = 'perf-group';
        group.style.marginBottom = '8px';

        const h = document.createElement('strong');
        h.textContent = title;
        h.style.display     = 'block';
        h.style.marginBottom = '4px';
        h.style.fontSize    = '12px';
        group.appendChild(h);

        this._container.appendChild(group);
        return group;
    }


    _makeCheckbox(parent, label, initialChecked, onChange) {
        const wrapper = document.createElement('label');
        wrapper.style.display    = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap        = '6px';
        wrapper.style.cursor     = 'pointer';
        wrapper.style.fontSize   = '12px';
        wrapper.style.marginBottom = '4px';

        const cb  = document.createElement('input');
        cb.type   = 'checkbox';
        cb.checked = Boolean(initialChecked);
        cb.addEventListener('change', () => onChange(cb.checked));

        const span = document.createElement('span');
        span.textContent = label;

        wrapper.appendChild(cb);
        wrapper.appendChild(span);
        parent.appendChild(wrapper);
        return cb;
    }


    _makeButton(parent, text, onClick) {
        const btn = document.createElement('button');
        btn.type        = 'button';
        btn.textContent = text;
        btn.style.fontSize    = '11px';
        btn.style.marginRight = '4px';
        btn.style.marginTop   = '2px';
        btn.addEventListener('click', onClick);
        parent.appendChild(btn);
        return btn;
    }


    // ------------------------------------------------------------------
    // Aufräumen
    // ------------------------------------------------------------------

    dispose() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}
