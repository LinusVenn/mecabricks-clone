
import { ObjectVisibilityManager } from '../hierarchy/ObjectVisibilityManager.js';

export class IsolationManager {
    constructor(scene, library, visibilityManager = null) {
        if (!scene) {
            throw new Error('IsolationManager: Three.js-Szene fehlt.');
        }

        if (!library) {
            throw new Error('IsolationManager: PartLibrary fehlt.');
        }

        this.scene = scene;
        this.library = library;

        this.visibilityManager =
            visibilityManager ?? new ObjectVisibilityManager(scene);

        this.ownsVisibilityManager = !visibilityManager;
    }

    isolate(bricks) {
        if (!Array.isArray(bricks) || bricks.length === 0) {
            return false;
        }

        const objects = bricks
            .map(brick => this.getObject(brick))
            .filter(Boolean);

        if (objects.length === 0) return false;

        return this.visibilityManager.isolate(objects);
    }

    exitIsolation() {
        return this.visibilityManager.exitIsolation();
    }

    isIsolating() {
        return this.visibilityManager.isIsolating();
    }

    showAll() {
        this.visibilityManager.resetVisibility();
    }

    getObject(brick) {
        if (!brick) return null;

        if (brick.group?.isObject3D) return brick.group;
        if (brick.object?.isObject3D) return brick.object;
        if (brick.mesh?.isObject3D) return brick.mesh;

        let result = null;

        this.scene.traverse(object => {
            if (
                !result &&
                object.userData?.brickId === brick.id
            ) {
                result = object;
            }
        });

        return result;
    }

    dispose() {
        if (this.ownsVisibilityManager) {
            this.visibilityManager.dispose();
        }
    }
}
