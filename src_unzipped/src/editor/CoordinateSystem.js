
export class CoordinateSystem {

    constructor(defaultSpace = 'world') {
        this.space = defaultSpace === 'local' ? 'local' : 'world';
    }

    setSpace(space) {
        if (space !== 'world' && space !== 'local') {
            throw new Error('Koordinatensystem muss world oder local sein.');
        }

        this.space = space;
    }

    getSpace() {
        return this.space;
    }

    toggle() {
        this.space = this.space === 'world' ? 'local' : 'world';
        return this.space;
    }

    applyToTransformManager(transformManager) {
        if (transformManager?.controls) {
            transformManager.controls.setSpace(this.space);
        }
    }

    applyToGroupTransformManager(groupTransformManager) {
        if (groupTransformManager?._controls) {
            groupTransformManager._controls.setSpace(this.space);
        }
    }

    applyToEditor(editor) {
        this.applyToTransformManager(editor?.transformManager);
        this.applyToGroupTransformManager(editor?.groupTransformManager);
    }
}
