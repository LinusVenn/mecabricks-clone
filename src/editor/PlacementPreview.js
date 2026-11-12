
import * as THREE from "three";

import { PART_DEFINITIONS } from "../objects/PartDefinitions.js";

import {
  STUD_PITCH,
} from "../utils/Constants.js";

export class PlacementPreview {

  constructor(scene) {

    this.scene = scene;

    this.group = null;

    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4
    });

    this.validMaterial = this.material;

    this.invalidMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.4
    });

    this.currentType = null;

  }

  setType(type) {

    if (this.group) {
      this.scene.remove(this.group);
    }

    const definition = PART_DEFINITIONS[type];

    if (!definition) return;

    this.currentType = type;

    this.group = new THREE.Group();

    // Echte Höhe aus der Bauteildefinition – Platten (0.4) sind sichtbar flacher
    const height = definition.height;

    const geometry = new THREE.BoxGeometry(
      definition.width * STUD_PITCH,
      height,
      definition.depth * STUD_PITCH
    );

    const mesh = new THREE.Mesh(
      geometry,
      this.validMaterial
    );

    mesh.position.y = height / 2;

    this.group.add(mesh);

    this.scene.add(this.group);

  }

  update(position, rotation, valid) {

    if (!this.group) return;

    this.group.position.set(
      position.x,
      position.y,
      position.z
    );

    this.group.rotation.y = rotation;

    const mesh = this.group.children[0];

    mesh.material = valid
      ? this.validMaterial
      : this.invalidMaterial;

  }

  hide() {

    if (this.group) {
      this.group.visible = false;
    }

  }

  show() {

    if (this.group) {
      this.group.visible = true;
    }

  }

}
