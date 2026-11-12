import * as THREE from "three";


export class LightingManager {

    constructor(scene, {

        ambientIntensity = 0.65,
        keyIntensity = 2.2,
        fillIntensity = 0.8,
        rimIntensity = 1.4,

        keyPosition = [8, 12, 8]

    } = {}) {

        if (!scene?.isScene) {
            throw new TypeError(
                "LightingManager requires a THREE.Scene."
            );
        }

        this.scene = scene;

        // Umgebungslicht

        this.ambient = new THREE.HemisphereLight(
            0xffffff,
            0x596273,
            ambientIntensity
        );

        // Hauptlicht

        this.key = new THREE.DirectionalLight(
            0xffffff,
            keyIntensity
        );

        // Fülllicht

        this.fill = new THREE.DirectionalLight(
            0xd9e8ff,
            fillIntensity
        );

        // Gegenlicht

        this.rim = new THREE.DirectionalLight(
            0xffffff,
            rimIntensity
        );

        this.key.position.set(...keyPosition);

        this.fill.position.set(-8, 5, -4);

        this.rim.position.set(0, 7, -10);

        this.key.name = "Phase7_KeyLight";
        this.fill.name = "Phase7_FillLight";
        this.rim.name = "Phase7_RimLight";

        scene.add(
            this.ambient,
            this.key,
            this.fill,
            this.rim
        );

        this.lights = {

            ambient: this.ambient,
            key: this.key,
            fill: this.fill,
            rim: this.rim

        };
    }


    setIntensity(name, intensity) {

        const light = this.lights[name];

        if (!light) {
            throw new Error(`Unknown light: ${name}`);
        }

        light.intensity = Math.max(
            0,
            Number(intensity) || 0
        );
    }


    setColor(name, color) {

        const light = this.lights[name];

        if (!light) {
            throw new Error(`Unknown light: ${name}`);
        }

        light.color.set(color);
    }


    setPosition(name, x, y, z) {

        const light = this.lights[name];

        if (!light?.position) {
            throw new Error(`Unknown positional light: ${name}`);
        }

        light.position.set(x, y, z);
    }


    setEnabled(name, enabled) {

        const light = this.lights[name];

        if (!light) {
            throw new Error(`Unknown light: ${name}`);
        }

        light.visible = Boolean(enabled);
    }


    dispose() {

        for (const light of Object.values(this.lights)) {
            this.scene.remove(light);
        }
    }
}