import {
    MATERIAL_PRESETS
} from "./MaterialPresets.js";

import {
    MaterialFactory
} from "./MaterialFactory.js";


export class MaterialLibrary {

    constructor({

        presets = MATERIAL_PRESETS,

        factory = MaterialFactory

    } = {}) {

        this.presets = presets;

        this.factory = factory;

        this.materials = new Map();
    }


    listPresets() {

        return Object.entries(this.presets).map(
            ([id, preset]) => ({
                id,
                ...preset
            })
        );
    }


    createPreset(id, { cache = false } = {}) {

        const preset = this.presets[id];

        if (!preset) {

            throw new Error(
                `Unknown material preset: ${id}`
            );
        }

        if (cache && this.materials.has(id)) {

            return this.materials.get(id);
        }

        const material = this.factory.create(preset);

        if (cache) {

            this.materials.set(id, material);
        }

        return material;
    }


    add(id, material) {

        if (!id || !material?.isMaterial) {

            throw new TypeError(
                "add requires an id and THREE.Material."
            );
        }

        this.materials.set(id, material);

        return material;
    }


    get(id) {

        return this.materials.get(id) ?? null;
    }


    remove(id, { dispose = false } = {}) {

        const material = this.materials.get(id);

        if (!material) {
            return false;
        }

        this.materials.delete(id);

        if (dispose) {
            material.dispose();
        }

        return true;
    }


    dispose() {

        for (const material of this.materials.values()) {

            material.dispose();
        }

        this.materials.clear();
    }

}