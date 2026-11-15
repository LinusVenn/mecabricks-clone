import * as THREE from "three";


export class MaterialFactory {

    static create(options = {}) {

        const {

            name = "Custom Material",

            color = 0xffffff,

            roughness = 0.4,

            metalness = 0,

            opacity = 1,

            transparent = opacity < 1,

            side = THREE.FrontSide,

            ...physical

        } = options;


        const material = new THREE.MeshPhysicalMaterial({

            color,

            roughness: clamp01(roughness),

            metalness: clamp01(metalness),

            opacity: clamp01(opacity),

            transparent,

            side,

            ...physical

        });

        material.name = name;

        return material;
    }


    static cloneWith(material, changes = {}) {

        if (!material?.isMaterial) {

            throw new TypeError(
                "Expected a THREE.Material."
            );
        }

        const clone = material.clone();

        for (const [key, value] of Object.entries(changes)) {

            if (key === "color") {

                clone.color?.set(value);

            } else if (key in clone) {

                clone[key] = value;
            }
        }

        clone.needsUpdate = true;

        return clone;
    }

}


function clamp01(value) {

    return Math.min(
        1,
        Math.max(0, Number(value) || 0)
    );
}