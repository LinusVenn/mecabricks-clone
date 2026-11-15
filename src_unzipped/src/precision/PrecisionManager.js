
import { AlignmentManager } from './AlignmentManager.js';
import { DistributionManager } from './DistributionManager.js';
import { MeasurementManager } from './MeasurementManager.js';
import { MirrorManager } from './MirrorManager.js';
import { PrecisionSnapManager } from './PrecisionSnapManager.js';

export class PrecisionManager {
    constructor(editor) {
        if (!editor) {
            throw new Error('PrecisionManager benötigt einen Editor.');
        }

        this.editor = editor;

        this.alignment = new AlignmentManager(editor);
        this.distribution = new DistributionManager(editor);
        this.measurement = new MeasurementManager(editor);
        this.mirror = new MirrorManager(editor);
        this.snap = new PrecisionSnapManager(editor);
    }

    getSelection() {
        return this.editor._getActiveSelection();
    }

    getSelectionCount() {
        return this.getSelection().length;
    }

    clearMeasurements() {
        this.measurement.clear();
    }

    dispose() {
        this.measurement.dispose();
        this.snap.dispose();
    }
}
