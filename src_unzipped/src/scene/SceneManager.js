
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { RenderSettings } from '../rendering/RenderSettings.js';
import { RenderManager } from '../rendering/RenderManager.js';
import { LightingManager } from '../rendering/LightingManager.js';
import { ShadowManager } from '../rendering/ShadowManager.js';
import { EnvironmentManager } from '../rendering/EnvironmentManager.js';

export class SceneManager {

    constructor(container, options = {}) {

        if (!container) {
            throw new Error('SceneManager benötigt einen gültigen Container.');
        }

        this.container = container;

        // ==========================================
        // 1. Szene
        // ==========================================

        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0xf0f0f0);


        // ==========================================
        // 2. Kamera
        // ==========================================

        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);

        this.camera = new THREE.PerspectiveCamera(
            50,
            width / height,
            0.1,
            1000
        );

        this.camera.position.set(8, 8, 10);


        // ==========================================
        // 3. Render-Einstellungen
        // ==========================================

        this.renderSettings = options.renderSettings
            ?? new RenderSettings({
                antialias: true,
                shadows: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                exposure: 1.0,
                outputColorSpace: THREE.SRGBColorSpace,
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                clearColor: 0xf0f0f0,
                clearAlpha: 1
            });


        // ==========================================
        // 4. Renderer
        // ==========================================

        this.renderer = new THREE.WebGLRenderer({
            antialias: this.renderSettings.get('antialias')
        });

        this.renderer.setSize(width, height);

        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
        );

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

        this.renderer.toneMappingExposure = 1.0;

        this.renderer.shadowMap.enabled = true;

        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.renderer.setClearColor(0xf0f0f0, 1);

        container.appendChild(this.renderer.domElement);


        // ==========================================
        // 5. Kamerasteuerung
        // ==========================================

        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );

        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.controls.target.set(0, 0, 0);

        this.controls.update();


        // ==========================================
        // 6. Raster
        // ==========================================

        this.grid = new THREE.GridHelper(
            50,
            50,
            0x888888,
            0xcccccc
        );

        this.scene.add(this.grid);


        // ==========================================
        // 7. Achsen
        // ==========================================

        this.axes = new THREE.AxesHelper(5);

        this.scene.add(this.axes);


        // ==========================================
        // 8. Phase 7: Rendering-Manager
        // ==========================================

        this.renderManager = new RenderManager({
            renderer: this.renderer,
            container: this.container,
            scene: this.scene,
            camera: this.camera,
            settings: this.renderSettings
        });


        // ==========================================
        // 9. Phase 7: Lichtverwaltung
        // ==========================================

        this.lightingManager = new LightingManager(
            this.scene,
            {
                ambientIntensity: 0.65,
                keyIntensity: 2.2,
                fillIntensity: 0.8,
                rimIntensity: 1.4
            }
        );


        // ==========================================
        // 10. Phase 7: Schattenverwaltung
        // ==========================================

        this.shadowManager = new ShadowManager(
            this.renderer,
            this.lightingManager.key,
            {
                mapSize: 2048,
                bias: -0.00015,
                normalBias: 0.02,
                radius: 3,
                cameraBounds: 30
            }
        );


        // ==========================================
        // 11. Phase 7: Umgebung
        // ==========================================

        this.environmentManager = new EnvironmentManager(
            this.renderer,
            this.scene,
            {
                intensity: 0.8,
                background: null
            }
        );

        this.environmentManager.createStudioEnvironment();


        // ==========================================
        // 12. Fenstergröße
        // ==========================================

        this.handleResize = () => {
            this.resize();
        };

        window.addEventListener(
            'resize',
            this.handleResize
        );


        // ==========================================
        // 13. Render-Schleife
        // ==========================================

        this.isAnimating = true;

        this.animate();
    }


    // ==========================================
    // Fenstergröße anpassen
    // ==========================================

    resize() {

        const width = Math.max(
            this.container.clientWidth,
            1
        );

        const height = Math.max(
            this.container.clientHeight,
            1
        );

        this.camera.aspect = width / height;

        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height, false);

        this.renderManager?.resize();
    }


    // ==========================================
    // Render-Schleife
    // ==========================================

    animate() {

        if (!this.isAnimating) {
            return;
        }

        requestAnimationFrame(() => this.animate());

        this.controls.update();

        this.renderer.render(
            this.scene,
            this.camera
        );
    }


    // ==========================================
    // Phase 7: Schatten auf Objekte anwenden
    // ==========================================

    updateShadows() {

        this.shadowManager.applyToScene(
            this.scene,
            {
                cast: true,
                receive: true
            }
        );
    }


    // ==========================================
    // Kamera positionieren
    // ==========================================

    setCameraPosition(x, y, z) {

        this.camera.position.set(x, y, z);

        this.controls.update();
    }


    // ==========================================
    // Kamera-Ziel setzen
    // ==========================================

    setCameraTarget(x, y, z) {

        this.controls.target.set(x, y, z);

        this.controls.update();
    }


    // ==========================================
    // Raster ein-/ausblenden
    // ==========================================

    setGridVisible(visible) {

        this.grid.visible = visible;
    }


    // ==========================================
    // Achsen ein-/ausblenden
    // ==========================================

    setAxesVisible(visible) {

        this.axes.visible = visible;
    }


    // ==========================================
    // Ressourcen freigeben
    // ==========================================

    dispose() {

        this.isAnimating = false;

        window.removeEventListener(
            'resize',
            this.handleResize
        );

        this.controls.dispose();

        this.environmentManager.dispose();

        this.lightingManager.dispose();

        this.shadowManager.dispose?.();

        this.renderManager.dispose();

        this.grid.geometry.dispose();
        this.grid.material.dispose();

        this.axes.geometry.dispose();
        this.axes.material.dispose();

        this.renderer.dispose();

        if (this.renderer.domElement.parentElement === this.container) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
