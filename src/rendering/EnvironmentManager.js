import * as THREE from "three";

import {
    RoomEnvironment
} from "three/addons/environments/RoomEnvironment.js";


export class EnvironmentManager {

    constructor(renderer, scene, {

        intensity = 0.8,
        background = null

    } = {}) {

        if (!renderer?.isWebGLRenderer || !scene?.isScene) {

            throw new TypeError(
                "EnvironmentManager requires a WebGLRenderer and THREE.Scene."
            );
        }

        this.renderer = renderer;
        this.scene = scene;

        this.intensity = intensity;
        this.background = background;

        this.pmrem = new THREE.PMREMGenerator(renderer);

        this.pmrem.compileEquirectangularShader();

        this.environmentTarget = null;
    }


    createStudioEnvironment() {

        const room = new RoomEnvironment();

        const target = this.pmrem.fromScene(
            room,
            0.04
        );

        

        this.setEnvironment(target.texture);

        this.environmentTarget?.dispose();

        this.environmentTarget = target;

        return target.texture;
    }


    setEnvironment(texture, {

        background = this.background

    } = {}) {

        this.scene.environment = texture ?? null;

        this.scene.background = background;

        this.scene.environmentIntensity =
            this.intensity;
    }


    setIntensity(intensity) {

        this.intensity = Math.max(
            0,
            Number(intensity) || 0
        );

        this.scene.environmentIntensity =
            this.intensity;
    }


    setBackground(background) {

        this.background = background;

        this.scene.background = background;
    }


    dispose() {

        this.environmentTarget?.dispose();

        this.pmrem.dispose();
    }
}