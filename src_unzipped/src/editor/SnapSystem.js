
import * as THREE from "three";

import {
  STUD_PITCH,
  ROTATION_STEP,
  SNAP_DISTANCE,
  BRICK_HEIGHT
} from "../utils/Constants.js";

import { PART_DEFINITIONS } from "../objects/PartDefinitions.js";

export class SnapSystem {

  snapToGrid(value) {

    return Math.round(value / STUD_PITCH) * STUD_PITCH;

  }

  snapPosition(position) {

    return {
      x: this.snapToGrid(position.x),
      y: position.y,
      z: this.snapToGrid(position.z)
    };

  }

  getSnappedRotation(rotation) {

    return Math.round(
      rotation / ROTATION_STEP
    ) * ROTATION_STEP;

  }

  getStudOffsets(width, depth) {

    const studs = [];

    const startX = -(width - 1) / 2;
    const startZ = -(depth - 1) / 2;

    for (let x = 0; x < width; x++) {

      for (let z = 0; z < depth; z++) {

        studs.push({
          x: startX + x,
          z: startZ + z
        });

      }

    }

    return studs;

  }

  getWorldStudPositions(brick) {

    const studs = this.getStudOffsets(
      brick.width,
      brick.depth
    );

    brick.group.updateWorldMatrix(true, false);

    return studs.map(stud => {

      const position = new THREE.Vector3(
        stud.x,
        brick.height,
        stud.z
      );

      return brick.group.localToWorld(position);

    });

  }

  findSnapPosition(type, desiredPosition, rotation, bricks) {

    const definition = PART_DEFINITIONS[type];

    if (!definition) return null;

    const candidateStuds = this.getStudOffsets(
      definition.width,
      definition.depth
    );

    const snappedRotation = this.getSnappedRotation(rotation);

    const rotationMatrix = new THREE.Matrix4()
      .makeRotationY(snappedRotation);

    const rotatedStuds = candidateStuds.map(stud => {

      const vector = new THREE.Vector3(
        stud.x,
        0,
        stud.z
      );

      vector.applyMatrix4(rotationMatrix);

      return vector;

    });

    let bestPosition = null;
    let bestDistance = SNAP_DISTANCE;

    for (const brick of bricks) {

      const existingStuds = this.getWorldStudPositions(brick);

      for (const existingStud of existingStuds) {

        for (const candidateStud of rotatedStuds) {

          const candidatePosition = new THREE.Vector3(
            existingStud.x - candidateStud.x,
            brick.group.position.y + brick.height,
            existingStud.z - candidateStud.z
          );

          const dx = candidatePosition.x - desiredPosition.x;
          const dz = candidatePosition.z - desiredPosition.z;

          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < bestDistance) {

            bestDistance = distance;

            bestPosition = {
              x: candidatePosition.x,
              y: candidatePosition.y,
              z: candidatePosition.z
            };

          }

        }

      }

    }

    return bestPosition;

  }

}
