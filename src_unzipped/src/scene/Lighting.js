import * as THREE from 'three';

export function addLighting(scene){

    //Grundbeleuchtung
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambient);


    //Gerichtetes Licht
    const directional = new THREE.DirectionalLight(0xffffff, 2);

    directional.position.set(10, 20, 10);
    scene.add(directional);
}