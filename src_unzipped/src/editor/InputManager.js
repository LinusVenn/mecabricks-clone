export class InputManager {

    constructor(editor) {

        this.editor = editor;

        window.addEventListener(
            "keydown",
            (event) => this.handleKey(event)
        );
    }

    handleKey(event) {

        // Nicht reagieren, wenn der Benutzer gerade in einem Eingabefeld schreibt.
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement
        ) {
            return;
        }

        const ctrl  = event.ctrlKey || event.metaKey;
        const shift = event.shiftKey;
        const key   = event.key.toLowerCase();

        // ─── Strg/Cmd-Kombinationen ─────────────────────────────────────
        if (ctrl) {
            switch (key) {
                case 'g':
                    event.preventDefault();
                    if (shift) {
                        this.editor.ungroupSelected();
                    } else {
                        this.editor.groupSelected();
                    }
                    return;

                case 'c':
                    this.editor.copySelected();
                    return;

                case 'v':
                    event.preventDefault();
                    this.editor.pasteSelected();
                    return;

                case 'd':
                    event.preventDefault();
                    this.editor.duplicateSelected();
                    return;
            }
            // Alle anderen Ctrl-Kombinationen (Z, S, Y) behandelt main.js
            return;
        }

        // ─── Einfache Tasten ─────────────────────────────────────────────
        switch (key) {

            case 'r':
                // Mehrfachauswahl → gemeinsam drehen; sonst Einzeldrehung
                if (this.editor.multiSelectionManager?.hasSelection()) {
                    this.editor.groupTransformManager.rotateSelection();
                } else {
                    this.editor.transformManager.rotateSelected();
                }
                break;

            case 'delete':
                this.editor.deleteSelected();
                break;

            case 'escape':
                this.editor.selectionManager.selectedObject = null;
                this.editor.transformManager.detach();
                this.editor.multiSelectionManager?.clearSelection();
                this.editor.groupTransformManager?.detach();
                break;

            case 'g':
                this.editor.transformManager.setMode('translate');
                break;

            case 'v':
                this.editor.placementManager.cancelPlacement();
                this.editor.selectionManager.selectedObject = null;
                this.editor.transformManager.detach();
                this.editor.multiSelectionManager?.clearSelection();
                this.editor.groupTransformManager?.detach();
                break;
        }
    }
}