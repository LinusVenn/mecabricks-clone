import { ModelValidator }
    from './ModelValidator.js';

import { ValidationPanel }
    from '../ui/ValidationPanel.js';


/**
 * Erstellt und verdrahtet die Phase-8.7-Modellprüfung
 * mit dem bestehenden Editor.
 */
export function initializeModelValidationPhase87({

    sidebar,

    library,

    connectionManager,

    collisionManager,

    groupManager,

    materialLibrary = null,

    componentLibrary = null,

    editor = null,

    outlinerManager = null

} = {}) {

    if (!sidebar) {

        throw new Error(
            'Phase 8.7 benötigt den Sidebar-Container.'
        );
    }

    if (!library) {

        throw new Error(
            'Phase 8.7 benötigt die PartLibrary.'
        );
    }


    // --------------------------------------------------
    // Panel-Container
    // --------------------------------------------------

    const container =
        document.createElement('div');

    container.id =
        'model-validation-panel-container';

    container.className =
        'phase-panel-container';

    sidebar.appendChild(container);


    // --------------------------------------------------
    // ModelValidator
    // --------------------------------------------------

    const modelValidator =
        new ModelValidator({

            library,

            collisionManager,

            connectionManager,

            groupManager,

            materialLibrary,

            componentLibrary
        });


    // --------------------------------------------------
    // Betroffene Bauteile auswählen
    // --------------------------------------------------

    const selectFinding = finding => {

        const bricks =
            (finding.brickIds ?? [])

                .map(id => library.getById(id))

                .filter(Boolean);


        if (bricks.length === 0) return;


        // Bevorzugt den Outliner verwenden.
        // Die vorhandene Synchronisierung übernimmt
        // anschließend die Auswahl im Editor.

        if (outlinerManager?.selectObjects) {

            outlinerManager.selectObjects(
                bricks.map(brick => brick.group)
            );

            return;
        }


        // Fallback ohne Outliner

        if (!editor) return;


        if (bricks.length === 1) {

            editor.multiSelectionManager
                ?.clearSelection?.();

            editor.selectionManager
                ?.selectObject?.(bricks[0].group);

        } else {

            editor.selectionManager
                ?.clearSelection?.();

            editor.multiSelectionManager
                ?.setSelection?.(bricks);
        }
    };


    // --------------------------------------------------
    // ValidationPanel
    // --------------------------------------------------

    const panel =
        new ValidationPanel(
            container,
            modelValidator,
            {
                onSelectResult: selectFinding
            }
        );


    return {

        modelValidator,

        panel,

        container
    };
}