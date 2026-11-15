import { CommandHistory } from '../commands/Command.js';
import { TransformManager } from './TransformManager.js';
import { AlignmentManager } from './AlignmentManager.js';
import { DuplicationManager } from './DuplicationManager.js';
import { PatternManager } from './PatternManager.js';
import { GroupExtension } from './GroupExtension.js';
import { AssemblyEditingManager } from './AssemblyEditingManager.js';
import { MeasurementManager } from './MeasurementManager.js';
import { ModelValidationManager } from './ModelValidationManager.js';

/** Initialisiert Phase K nach Phase 8.7 und Phase J. */
export function initializeModelingPhaseK({
    editor,
    library,
    groupManager,
    assemblyManager = null,
    connectionManager = null,
    historyManager,
    isolationManager,
    precisionAlignmentManager,
    precisionMeasurementManager,
    modelValidator,
    collaborationManager = null
}) {
    const required = {
        library, groupManager, historyManager, isolationManager,
        precisionAlignmentManager, precisionMeasurementManager, modelValidator
    };
    for (const [name, value] of Object.entries(required)) {
        if (!value) throw new Error(`initializeModelingPhaseK: ${name} fehlt.`);
    }

    const commandHistory = new CommandHistory({ historyManager, collaborationManager });
    const assemblyEditingManager = new AssemblyEditingManager({
        isolationManager,
        library,
        groupManager,
        assemblyManager,
        collaborationManager
    });

    const transformManager = new TransformManager({
        library,
        commandHistory,
        historyManager,
        assemblyEditingManager,
        transformConstraintManager: editor?.transformConstraintManager ?? null
    });
    const alignmentManager = new AlignmentManager({
        precisionAlignmentManager,
        commandHistory,
        library,
        assemblyEditingManager,
        transformConstraintManager: editor?.transformConstraintManager ?? null
    });
    const duplicationManager = new DuplicationManager({ library, commandHistory, assemblyEditingManager });
    const patternManager = new PatternManager({ library, commandHistory, assemblyEditingManager });
    const groupExtension = new GroupExtension({ groupManager, commandHistory, library });
    const measurementManager = new MeasurementManager({ precisionMeasurementManager, library });
    const modelValidationManager = new ModelValidationManager({
        modelValidator,
        library,
        connectionManager,
        groupManager
    });

    const dispatcher = collaborationManager?._dispatcher;
    if (dispatcher) dispatcher._assemblyEditingManager = assemblyEditingManager;

    // Messungen werden nach jeder echten Modelländerung als veraltet markiert.
    // Der Hook bleibt idempotent, falls Phase K erneut initialisiert wird.
    if (!historyManager.__phaseKMeasurementHook) {
        const previousOnChange = historyManager.onChange;
        historyManager.onChange = (...args) => {
            previousOnChange?.(...args);
            measurementManager.markStale();
        };
        historyManager.__phaseKMeasurementHook = true;
    }

    return {
        commandHistory,
        assemblyManager,
        transformManager,
        alignmentManager,
        duplicationManager,
        patternManager,
        groupExtension,
        assemblyEditingManager,
        measurementManager,
        modelValidationManager
    };
}
