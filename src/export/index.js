/**
 * src/export/index.js – Public barrel for the Export subsystem (Phase H)
 *
 * Import any export-related class from this single entry point:
 *
 *   import { ExportManager, LDrawExporter } from './export/index.js';
 */

// ── Core manager ──────────────────────────────────────────────────────────────
export { ExportManager }           from './ExportManager.js';

// ── Snapshot and validation ───────────────────────────────────────────────────
export { ExportSnapshotBuilder }   from './ExportSnapshotBuilder.js';
export { ExportValidator }         from './ExportValidator.js';

// ── Coordinate utilities ──────────────────────────────────────────────────────
export { CoordinateConverter }     from './CoordinateConverter.js';

// ── Format exporters ──────────────────────────────────────────────────────────
export { LDrawExporter }           from './formats/LDrawExporter.js';
export { GLTFExporterAdapter }     from './formats/GLTFExporterAdapter.js';
export { CSVExporter }             from './formats/CSVExporter.js';
export { JSONExporter }            from './formats/JSONExporter.js';

// ── BOM pipeline ──────────────────────────────────────────────────────────────
export { BillOfMaterialsBuilder }  from './bom/BillOfMaterialsBuilder.js';
export { BOMEntry }                from './bom/BOMEntry.js';
export { BOMFormatter }            from './bom/BOMFormatter.js';
export { BOMPrintView }            from './bom/BOMPrintView.js';

// ── Utilities ─────────────────────────────────────────────────────────────────
export { DownloadHelper }          from './utils/DownloadHelper.js';
export { FileNameHelper }          from './utils/FileNameHelper.js';
export { ExportLogger }            from './utils/ExportLogger.js';
