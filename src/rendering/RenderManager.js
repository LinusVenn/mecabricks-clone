import * as THREE from "three";

import { RenderSettings } from "./RenderSettings.js";


const TONE_MAPPINGS = {

    None: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
    ACESFilmic: THREE.ACESFilmicToneMapping,
    AgX: THREE.AgXToneMapping,
    Neutral: THREE.NeutralToneMapping

};


const COLOR_SPACES = {

    SRGB: THREE.SRGBColorSpace,
    LinearSRGB: THREE.LinearSRGBColorSpace

};


export class RenderManager {

    constructor({
        renderer = null,
        canvas = null,
        container = null,
        scene = null,
        camera = null,
        settings = new RenderSettings(),
        onError = console.error
    } = {}) {

        this.settings = settings;

        this.scene = scene;
        this.camera = camera;

        this.onError = onError;
        this.container = container;

        this.renderer = renderer ?? new THREE.WebGLRenderer({

            canvas: canvas ?? undefined,

            antialias: settings.get("antialias"),

            alpha: settings.get("clearAlpha") < 1

        });

        this.disposed = false;

        this.applySettings(settings.getAll());

        this.unsubscribe = settings.subscribe((all) => {
            this.applySettings(all);
        });

        if (
            container &&
            !this.renderer.domElement.parentElement
        ) {
            container.appendChild(this.renderer.domElement);
        }

        this.resizeObserver =
            typeof ResizeObserver !== "undefined" && container
                ? new ResizeObserver(() => this.resize())
                : null;

        this.resizeObserver?.observe(container);

        this.resize();
    }


    applySettings(settings) {

        const renderer = this.renderer;

        renderer.shadowMap.enabled =
            Boolean(settings.shadows);

        renderer.shadowMap.type =
            THREE.PCFSoftShadowMap;

        renderer.toneMapping =
            TONE_MAPPINGS[settings.toneMapping]
            ?? THREE.ACESFilmicToneMapping;

        renderer.toneMappingExposure =
            Number(settings.exposure) || 1;

        renderer.outputColorSpace =
            COLOR_SPACES[settings.outputColorSpace]
            ?? THREE.SRGBColorSpace;

        renderer.setClearColor(
            settings.clearColor,
            settings.clearAlpha
        );

        const ratio = Math.min(
            window.devicePixelRatio || 1,
            Number(settings.pixelRatio) || 2
        );

        renderer.setPixelRatio(ratio);

        this.resize();
    }


    setScene(scene) {
        this.scene = scene;
    }


    setCamera(camera) {
        this.camera = camera;
    }


    resize(width, height) {

        if (this.disposed) return;

        const rect = this.container?.getBoundingClientRect();

        const w = Math.max(
            1,
            Math.floor(width ?? rect?.width ?? window.innerWidth)
        );

        const h = Math.max(
            1,
            Math.floor(height ?? rect?.height ?? window.innerHeight)
        );

        this.renderer.setSize(w, h, false);

        if (this.camera?.isPerspectiveCamera) {

            this.camera.aspect = w / h;

            this.camera.updateProjectionMatrix();

        } else if (this.camera?.isOrthographicCamera) {

            const halfHeight =
                (this.camera.top - this.camera.bottom) / 2;

            const halfWidth = halfHeight * (w / h);

            const centerX =
                (this.camera.left + this.camera.right) / 2;

            this.camera.left = centerX - halfWidth;
            this.camera.right = centerX + halfWidth;

            this.camera.updateProjectionMatrix();
        }
    }


    render(scene = this.scene, camera = this.camera) {

        if (this.disposed) return;

        if (!scene || !camera) {

            this.onError?.(
                new Error(
                    "RenderManager needs both a scene and a camera."
                )
            );

            return;
        }

        this.renderer.render(scene, camera);
    }


    getRenderer() {
        return this.renderer;
    }


    dispose() {

        if (this.disposed) return;

        this.disposed = true;

        this.unsubscribe?.();

        this.resizeObserver?.disconnect();

        this.renderer.dispose();
    }
}