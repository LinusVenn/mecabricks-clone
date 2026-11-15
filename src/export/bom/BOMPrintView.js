/**
 * BOMPrintView – Druckansicht der Stückliste (Phase H.6)
 *
 * Erzeugt eine HTML-Seite für den Druck oder PDF-Export via window.print().
 * Keine externen CSS-Dateien oder PDF-Bibliotheken erforderlich.
 *
 * Die Seite enthält:
 *  - Projekttitel und Exportdatum
 *  - Zusammenfassung (Gesamt, Typen, Farben)
 *  - Stücklistentabelle
 *  - Fußzeile mit Gesamtmenge
 *  - Druck-CSS (print media query)
 *
 * Der Ausdruck erfolgt durch das Öffnen eines neuen Fensters
 * und den Aufruf von window.print().
 */
import { BOMFormatter } from './BOMFormatter.js';
import { DownloadHelper } from '../utils/DownloadHelper.js';
import { FileNameHelper } from '../utils/FileNameHelper.js';

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS in generated markup.
 * @param {unknown} value
 * @returns {string}
 */
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a Date object using a German locale date string.
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
function formatDate(date, locale) {
  try {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns a CSS hex color string, falling back to transparent.
 * Accepts '#rrggbb', 'rrggbb', or any string starting with '#'.
 * @param {string|undefined} hex
 * @returns {string}
 */
function safeHex(hex) {
  if (!hex) return 'transparent';
  return hex.startsWith('#') ? hex : `#${hex}`;
}

// ---------------------------------------------------------------------------
// BOMPrintView
// ---------------------------------------------------------------------------

export class BOMPrintView {
  /**
   * @param {object} [options={}]
   * @param {string}  [options.title='Technische Stückliste']
   * @param {string}  [options.locale='de-DE']
   * @param {boolean} [options.groupByCategory=false]
   * @param {boolean} [options.colorSwatches=true]
   */
  constructor(options = {}) {
    this._title          = options.title          ?? 'Technische Stückliste';
    this._locale         = options.locale          ?? 'de-DE';
    this._groupByCategory = options.groupByCategory ?? false;
    this._colorSwatches  = options.colorSwatches   ?? true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Returns a complete HTML document string ready for printing.
   *
   * @param {import('./BOMFormatter.js').BOM} bom
   * @param {object} [options={}]
   * @param {string}  [options.title]           - Override instance title
   * @param {boolean} [options.groupByCategory] - Override groupByCategory
   * @param {boolean} [options.colorSwatches]   - Override colorSwatches
   * @returns {string}
   */
  generateHTML(bom, options = {}) {
    const title          = options.title          ?? this._title;
    const groupByCategory = options.groupByCategory ?? this._groupByCategory;
    const colorSwatches  = options.colorSwatches   ?? this._colorSwatches;
    const locale         = this._locale;

    // ------------------------------------------------------------------
    // Resolve items — use BOMFormatter if available, else bom.items
    // ------------------------------------------------------------------
    let items = [];
    try {
      const formatter = new BOMFormatter({ locale, groupByCategory });
      items = formatter.format(bom);
    } catch (_) {
      // Graceful fallback if BOMFormatter not available or throws
      items = Array.isArray(bom?.items) ? bom.items : [];
    }

    const meta        = bom?.metadata ?? {};
    const projectName = esc(meta.projectName ?? 'Unbekanntes Projekt');
    const dateStr     = formatDate(new Date(), locale);

    // ------------------------------------------------------------------
    // Aggregates
    // ------------------------------------------------------------------
    const totalParts  = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const uniqueTypes = new Set(items.map(item => item.partId ?? item.id ?? item.name)).size;
    const uniqueColors = new Set(
      items
        .map(item => item.colorName ?? item.color ?? null)
        .filter(Boolean)
    ).size;

    // ------------------------------------------------------------------
    // Table rows
    // ------------------------------------------------------------------
    const rows = groupByCategory
      ? this._buildGroupedRows(items, colorSwatches)
      : this._buildFlatRows(items, colorSwatches);

    // ------------------------------------------------------------------
    // HTML
    // ------------------------------------------------------------------
    return this._buildDocument({
      title,
      projectName,
      dateStr,
      totalParts,
      uniqueTypes,
      uniqueColors,
      rows,
    });
  }

  /**
   * Opens a new browser window with the print view and triggers window.print().
   *
   * @param {import('./BOMFormatter.js').BOM} bom
   * @param {object} [options={}]
   * @returns {Window|null}
   */
  openPrintWindow(bom, options = {}) {
    const html = this.generateHTML(bom, options);

    const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!win) {
      console.warn('[BOMPrintView] openPrintWindow: Popup wurde blockiert.');
      return null;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    // Trigger print after the content has loaded
    win.addEventListener('load', () => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.warn('[BOMPrintView] window.print() fehlgeschlagen:', err);
      }
    });

    // Fallback: if load never fires (some browsers), delay-trigger
    setTimeout(() => {
      if (win && !win.closed) {
        try { win.print(); } catch (_) { /* already printed or closed */ }
      }
    }, 1200);

    return win;
  }

  /**
   * Downloads the print view as an HTML file using DownloadHelper.
   *
   * @param {import('./BOMFormatter.js').BOM} bom
   * @param {object} [options={}]
   * @returns {void}
   */
  download(bom, options = {}) {
    const html     = this.generateHTML(bom, options);
    const baseName = bom?.metadata?.projectName ?? 'export';
    const filename = FileNameHelper.forPDF(baseName);

    DownloadHelper.downloadText(html, filename, 'text/html');
  }

  // -------------------------------------------------------------------------
  // Private – row builders
  // -------------------------------------------------------------------------

  /**
   * Builds a flat list of <tr> strings from items.
   * @private
   */
  _buildFlatRows(items, colorSwatches) {
    if (!items.length) {
      return '<tr><td colspan="5" style="text-align:center;color:#999;padding:1em;">Keine Bauteile vorhanden</td></tr>';
    }

    return items.map(item => this._itemToRow(item, colorSwatches)).join('\n');
  }

  /**
   * Builds grouped rows with a category separator row between groups.
   * @private
   */
  _buildGroupedRows(items, colorSwatches) {
    if (!items.length) {
      return '<tr><td colspan="5" style="text-align:center;color:#999;padding:1em;">Keine Bauteile vorhanden</td></tr>';
    }

    // Group by category field
    const groups = new Map();
    for (const item of items) {
      const cat = item.category ?? item.type ?? 'Sonstige';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    }

    const rows = [];
    for (const [category, groupItems] of groups) {
      rows.push(
        `<tr>
          <td colspan="5" style="background:#e8edf4;font-weight:bold;padding:0.4em 0.6em;border-bottom:1px solid #ccc;font-size:0.85em;letter-spacing:0.03em;">
            ${esc(category)}
          </td>
        </tr>`
      );
      rows.push(...groupItems.map(item => this._itemToRow(item, colorSwatches)));
    }

    return rows.join('\n');
  }

  /**
   * Converts a single BOM item to a <tr> string.
   * @private
   */
  _itemToRow(item, colorSwatches) {
    const partId    = esc(item.partId   ?? item.id   ?? '—');
    const label     = esc(item.name     ?? item.label ?? item.description ?? '—');
    const variant   = esc(item.variant  ?? item.subtype ?? '—');
    const qty       = Number(item.quantity) || 1;
    const colorName = esc(item.colorName ?? item.color ?? '—');

    // Color swatch
    let colorCell;
    if (colorSwatches && (item.colorHex || item.colorName)) {
      const hex = safeHex(item.colorHex ?? null);
      colorCell =
        `<span class="color-swatch" style="background:${esc(hex)};"></span>${colorName}`;
    } else {
      colorCell = colorName;
    }

    return `<tr>
      <td style="font-family:monospace;font-size:0.85em;">${partId}</td>
      <td>${label}</td>
      <td>${colorCell}</td>
      <td>${variant}</td>
      <td class="qty">${qty.toLocaleString(this._locale)}</td>
    </tr>`;
  }

  // -------------------------------------------------------------------------
  // Private – document builder
  // -------------------------------------------------------------------------

  /**
   * Assembles the final HTML document string.
   * @private
   */
  _buildDocument({ title, projectName, dateStr, totalParts, uniqueTypes, uniqueColors, rows }) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} – ${projectName}</title>
  <style>
    /* ── Basis ──────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 2cm;
      color: #222;
      background: #fff;
      font-size: 14px;
      line-height: 1.4;
    }

    h1 {
      font-size: 1.4em;
      margin: 0 0 0.2em;
      color: #1a1a2e;
    }

    .subtitle {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 1.5em;
    }

    /* ── KPI-Boxen ──────────────────────────────────────────── */
    .summary {
      display: flex;
      gap: 1em;
      margin-bottom: 1.5em;
      flex-wrap: wrap;
    }

    .kpi {
      border: 1px solid #ddd;
      padding: 0.8em 1.2em;
      border-radius: 4px;
      min-width: 80px;
    }

    .kpi-value {
      font-size: 1.8em;
      font-weight: bold;
      color: #2563eb;
      line-height: 1.1;
    }

    .kpi-label {
      font-size: 0.75em;
      color: #666;
      margin-top: 0.2em;
    }

    /* ── Tabelle ────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
    }

    th {
      background: #f4f4f4;
      text-align: left;
      padding: 0.5em 0.6em;
      border-bottom: 2px solid #ccc;
      white-space: nowrap;
    }

    td {
      padding: 0.4em 0.6em;
      border-bottom: 1px solid #eee;
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: 2px solid #ccc;
    }

    tr:hover td {
      background: #f9f9ff;
    }

    .qty {
      text-align: right;
      font-weight: bold;
    }

    .color-swatch {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1px solid #999;
      vertical-align: middle;
      margin-right: 4px;
      border-radius: 2px;
    }

    /* ── Fußzeile ───────────────────────────────────────────── */
    .footer {
      margin-top: 1em;
      text-align: right;
      font-weight: bold;
      color: #333;
      font-size: 0.9em;
    }

    /* ── Druckbutton (nur Bildschirm) ───────────────────────── */
    @media screen {
      .print-btn {
        background: #2563eb;
        color: #fff;
        border: none;
        padding: 0.5em 1.2em;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 1em;
        font-size: 0.9em;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
      }

      .print-btn:hover { background: #1d4ed8; }
      .print-btn:active { background: #1e40af; }
    }

    /* ── Druck-CSS ──────────────────────────────────────────── */
    @media print {
      .no-print { display: none !important; }

      body { margin: 1cm; }

      .kpi { border: 1px solid #999; }

      a { text-decoration: none; color: inherit; }

      tr:hover td { background: transparent; }

      /* Seitenumbruch vermeiden innerhalb einer Zeile */
      tr { page-break-inside: avoid; }

      h1, .summary { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Drucken / Als PDF speichern</button>

  <h1>${esc(title)}</h1>
  <div class="subtitle">Projekt: ${projectName} &nbsp;·&nbsp; ${esc(dateStr)}</div>

  <div class="summary">
    <div class="kpi">
      <div class="kpi-value">${totalParts.toLocaleString('de-DE')}</div>
      <div class="kpi-label">Bauteile</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${uniqueTypes.toLocaleString('de-DE')}</div>
      <div class="kpi-label">Bauteiltypen</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${uniqueColors.toLocaleString('de-DE')}</div>
      <div class="kpi-label">Farben</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Bauteil-ID</th>
        <th>Bezeichnung</th>
        <th>Farbe</th>
        <th>Variante</th>
        <th class="qty">Anzahl</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">Gesamt: ${totalParts.toLocaleString('de-DE')} Bauteile</div>
</body>
</html>`;
  }
}
