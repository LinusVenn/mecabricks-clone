import * as THREE from "three";


export class ShadowManager {

    constructor(renderer, light = null, {

        mapSize = 2048,
        bias = -0.00015,
        normalBias = 0.02,
        radius = 3,
        cameraBounds = 30

    } = {}) {

        if (!renderer?.shadowMap) {
            throw new TypeError(
                "ShadowManager requires a WebGLRenderer."
            );
        }

        this.renderer = renderer;
        this.light = light;

        this.configure({

            mapSize,
            bias,
            normalBias,
            radius,
            cameraBounds

        });
    }


    configure({

        mapSize,
        bias,
        normalBias,
        radius,
        cameraBounds

    } = {}) {

        if (this.light?.shadow) {

            this.light.castShadow = true;

            this.light.shadow.mapSize.set(
                mapSize ?? 2048,
                mapSize ?? 2048
            );

            this.light.shadow.bias =
                bias ?? -0.00015;

            this.light.shadow.normalBias =
                normalBias ?? 0.02;

            this.light.shadow.radius =
                radius ?? 3;

            const camera = this.light.shadow.camera;

            camera.left = -(cameraBounds ?? 30);
            camera.right = cameraBounds ?? 30;

            camera.top = cameraBounds ?? 30;
            camera.bottom = -(cameraBounds ?? 30);

            camera.near = 0.1;
            camera.far = 150;

            camera.updateProjectionMatrix();

            this.light.shadow.needsUpdate = true;
        }
    }


    setEnabled(enabled) {

        this.renderer.shadowMap.enabled =
            Boolean(enabled);

        if (this.light) {
            this.light.castShadow = Boolean(enabled);
        }
    }


    applyToScene(scene, {

        cast = true,
        receive = true

    } = {}) {

        scene.traverse((object) => {

            if (object.isMesh) {

                object.castShadow = cast;

                object.receiveShadow = receive;
            }
        });
    }
}