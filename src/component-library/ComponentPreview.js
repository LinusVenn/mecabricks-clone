import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Brick } from '../objects/Brick.js';

/** Eigenständige Vorschau-Szene. Sie greift weder auf PartLibrary noch History zu. */
export class ComponentPreview {
    constructor(container, { width = 320, height = 220 } = {}) {
        if (!container) throw new Error('ComponentPreview benötigt einen Container.');
        this.container = container;
        this.width = width;
        this.height = height;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x20252b);
        this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
        this.camera.position.set(8, 7, 9);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 1, 0);
        this.controls.update();

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667080, 2.0));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(6, 10, 7);
        key.castShadow = true;
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.8);
        fill.position.set(-7, 4, -5);
        this.scene.add(fill);

        const grid = new THREE.GridHelper(20, 20, 0x69717a, 0x3b4148);
        grid.position.y = -0.02;
        this.scene.add(grid);
        this._staticObjects = [grid, key, fill];
        this.bricks = [];
        this._raf = 0;
        this._disposed = false;
        this._animate = this._animate.bind(this);
        this._raf = requestAnimationFrame(this._animate);
        this.resize(width, height);
    }

    show(template) {
        this.clear();
        if (!template?.data?.bricks?.length) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const sourceBricks = template.data.bricks;
        const center = new THREE.Vector3();
        for (const data of sourceBricks) {
            center.x += data.position.x;
            center.y += data.position.y;
            center.z += data.position.z;
        }
        center.divideScalar(sourceBricks.length);

        for (const data of sourceBricks) {
            const brick = new Brick(
                this.scene,
                data.position.x - center.x,
                data.position.y - center.y,
                data.position.z - center.z,
                data.color,
                data.type,
                `preview-${data.id}`
            );
            brick.setTransform(
                { x: data.position.x - center.x, y: data.position.y - center.y, z: data.position.z - center.z },
                data.rotation
            );
            this.bricks.push(brick);
        }

        const bounds = new THREE.Box3();
        for (const brick of this.bricks) bounds.expandByObject(brick.group);
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 2);
        this.controls.target.set(0, size.y * 0.45, 0);
        this.camera.position.set(maxDimension * 1.8, maxDimension * 1.35, maxDimension * 1.8);
        this.camera.near = Math.max(0.05, maxDimension / 100);
        this.camera.far = maxDimension * 100;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    clear() {
        for (const brick of this.bricks) brick.dispose();
        this.bricks = [];
    }

    resize(width, height) {
        this.width = Math.max(1, width || this.container.clientWidth || 320);
        this.height = Math.max(1, height || this.container.clientHeight || 220);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    _animate() {
        if (this._disposed) return;
        this._raf = requestAnimationFrame(this._animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        cancelAnimationFrame(this._raf);
        this.clear();
        this.controls.dispose();
        for (const object of this._staticObjects) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
                else object.material.dispose();
            }
        }
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
