import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager{

    constructor(container){
        //Szene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        

        //Kamera
        this.camera = new THREE.PerspectiveCamera(
            50,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(8, 8, 10);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });


        //Renderer
        this.renderer.setSize(
            container.clientWidth,
            container.clientHeight
        );
        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
        );
        container.appendChild(
            this.renderer.domElement
        );


        //Kamerasteuerung
        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.enableDamping = true;
        this.controls.target.set(0, 0, 0);


        //Raster
        const grid = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
        this.scene.add(grid);


        //Achsen
        const axes = new THREE.AxesHelper(5);
        this.scene.add(axes);


        //Fenstergröße
        window.addEventListener('resize', () => {
            this.resize(container);
        });


        //Render-Schleife
        this.animate();
    }

    resize(container){
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    animate(){
        requestAnimationFrame(
            () => this.animate()
        );

        this.controls.update();

        this.renderer.render(
            this.scene,
            this.camera
        );
    }
}