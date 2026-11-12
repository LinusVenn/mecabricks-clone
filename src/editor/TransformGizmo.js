
export class TransformGizmo {

    constructor(editor, coordinateSystem) {
        if (!editor) {
            throw new Error('TransformGizmo benötigt einen Editor.');
        }

        this.editor = editor;
        this.coordinateSystem = coordinateSystem;

        this.mode = 'translate';
        this.enabled = true;

        this.setMode(this.mode);
        this.setSpace(this.coordinateSystem.getSpace());
    }

    setMode(mode) {
        const allowedModes = ['translate', 'rotate'];
    
        if (!allowedModes.includes(mode)) {
            throw new Error(
                'Zulässige Modi sind translate und rotate.'
            );
        }
    
        this.mode = mode;
    
        this.editor.transformManager.controls.setMode(mode);
        this.editor.groupTransformManager._controls.setMode(mode);
    
        this.setEnabled(true);
    }

    getMode() {
        return this.mode;
    }

    setSpace(space) {
        this.coordinateSystem.setSpace(space);
        this.coordinateSystem.applyToEditor(this.editor);
    }

    getSpace() {
        return this.coordinateSystem.getSpace();
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);

        const single = this.editor.transformManager;
        const group = this.editor.groupTransformManager;

        if (single?.controls) {
            single.controls.enabled = this.enabled;
        }

        if (group?._controls) {
            group._controls.enabled = this.enabled;
        }
    }

    rotateSelection() {
        const bricks = this.editor._getActiveSelection();

        if (bricks.length === 0) return false;

        if (bricks.length > 1) {
            return this.editor.groupTransformManager.rotateSelection();
        }

        this.editor.transformManager.rotateSelected();
        return true;
    }

    dispose() {
        this.setEnabled(false);
    }
}
