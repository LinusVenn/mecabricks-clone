import { ComponentTemplateManager } from './ComponentTemplateManager.js';
import { ComponentLibraryPanel } from '../ui/ComponentLibraryPanel.js';

/**
 * Initialisiert Phase 8.6 ohne die projektbezogene ComponentLibrary zu
 * verändern. Diese Funktion wird aus main.js aufgerufen, nachdem History,
 * Editor und die Phase-8.3-Manager angelegt wurden.
 */
export async function initializeComponentLibraryPhase86({
    sidebar,
    library,
    connectionManager,
    groupManager,
    assemblyManager,
    historyManager,
    editor,
    onInsert = null
}) {
    if (!sidebar) throw new Error('Phase 8.6: Sidebar fehlt.');

    let container = document.getElementById('component-template-library-container');
    if (!container) {
        container = document.createElement('section');
        container.id = 'component-template-library-container';
        container.className = 'phase-panel-container';
        const heading = document.createElement('h3');
        heading.textContent = 'Baugruppenbibliothek';
        container.appendChild(heading);
        sidebar.appendChild(container);
    }

    const templateManager = new ComponentTemplateManager({
        library,
        connectionManager,
        groupManager,
        assemblyManager,
        historyManager,
        editor
    });

    await templateManager.initialize();

    const panel = new ComponentLibraryPanel(container, templateManager, groupManager, {
        onInsert: result => {
            editor?.multiSelectionManager?.setSelection?.(result.bricks);
            editor?._notifyGroupUI?.();
            onInsert?.(result);
        }
    });

    return { templateManager, panel, dispose() { panel.dispose(); templateManager.storage.close?.(); } };
}
