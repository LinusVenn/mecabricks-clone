import * as THREE from "three";

import {
    MaterialLibrary
} from "./MaterialLibrary.js";

import {
    MaterialFactory
} from "./MaterialFactory.js";


export class MaterialManager {

    constructor({

        library = new MaterialLibrary(),

        factory = MaterialFactory

    } = {}) {

        this.library = library;

        this.factory = factory;
    }


    apply(target, materialOrId, { clone = false } = {}) {

        const material =
            typeof materialOrId === "string"

                ? (
                    this.library.get(materialOrId)
                    ?? this.library.createPreset(materialOrId)
                )

                : materialOrId;


        if (!material?.isMaterial) {

            throw new TypeError(
                "A valid THREE.Material or material id is required."
            );
        }


        const applied = clone
            ? material.clone()
            : material;


        const meshes = collectMeshes(target);


        for (const mesh of meshes) {

            if (Array.isArray(mesh.material)) {

                mesh.material = mesh.material.map(
                    () => clone ? applied.clone() : applied
                );

            } else {

                mesh.material = clone
                    ? applied.clone()
                    : applied;
            }
        }

        return meshes.length;
    }


    create(options) {

        return this.factory.create(options);
    }


    update(target, changes) {

        const meshes = collectMeshes(target);

        for (const mesh of meshes) {

            const updateOne = (material) => {

                if (changes.color !== undefined) {

                    material.color?.set(changes.color);
                }

                for (const [key, value] of Object.entries(changes)) {

                    if (key !== "color" && key in material) {

                        material[key] = value;
                    }
                }

                material.needsUpdate = true;
            };


            (
                Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material]

            ).forEach(updateOne);
        }

        return meshes.length;
    }

}


// Sammelt alle Meshes eines Objektes.

function collectMeshes(target) {

    if (target?.isMesh) {

        return [target];
    }


    if (target?.traverse) {

        const meshes = [];

        target.traverse((object) => {

            if (object.isMesh) {

                meshes.push(object);
            }
        });

        return meshes;
    }


    if (Array.isArray(target)) {

        return target.flatMap(collectMeshes);
    }


    throw new TypeError(
        "Target must be a Mesh, Object3D, or array of targets."
    );
}