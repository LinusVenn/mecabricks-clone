
import * as THREE from "three";

export class PlacementManager {

  constructor(
    camera,
    renderer,
    scene,
    library,
    snapSystem,
    collisionManager,
    connectionManager,
    preview
  ) {

    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    this.library = library;

    this.snapSystem = snapSystem;
    this.collisionManager = collisionManager;
    this.connectionManager = connectionManager;
    this.preview = preview;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.ground = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      0
    );

    this.selectedPart = null;
    this.selectedColor = 0xff0000;

    this.previewPosition = null;
    this.previewRotation = 0;
    this.previewValid = false;

  }

  setSelectedPart(type) {

    this.selectedPart = type;

    this.preview.setType(type);
    this.preview.show();

  }

  setSelectedColor(color) {

    this.selectedColor = color;

  }

  getMousePosition(event) {

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    this.mouse.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(
      this.mouse,
      this.camera
    );

    const intersection = new THREE.Vector3();

    const hit = this.raycaster.ray.intersectPlane(
      this.ground,
      intersection
    );

    if (!hit) return null;

    return intersection;

  }

  updatePreview(event) {

    if (!this.selectedPart) return;

    const mousePosition = this.getMousePosition(event);

    if (!mousePosition) return;

    const desiredPosition = this.snapSystem.snapPosition({
      x: mousePosition.x,
      y: 0,
      z: mousePosition.z
    });

    const rotation = 0;

    const bricks = this.library.getAll();

    const snapPosition = this.snapSystem.findSnapPosition(
      this.selectedPart,
      desiredPosition,
      rotation,
      bricks
    );

    const position = snapPosition || desiredPosition;

    const collision = this.collisionManager.checkCollision(
      this.selectedPart,
      position,
      rotation,
      bricks
    );

    this.previewPosition = position;
    this.previewRotation = rotation;
    this.previewValid = !collision;

    this.preview.update(
      position,
      rotation,
      !collision
    );

  }

  placeBrick() {

    if (!this.selectedPart) return null;

    if (!this.previewPosition || !this.previewValid) {
      return null;
    }

    const brick = this.library.addBrick(
      this.previewPosition.x,
      this.previewPosition.y,
      this.previewPosition.z,
      this.selectedColor,
      this.selectedPart
    );

    if (this.editor?.historyManager) {
        this.editor.historyManager.saveState();
    }

    this.createConnections(brick);

    return brick;

  }

  createConnections(brick) {

    const bricks = this.library.getAll();

    for (const other of bricks) {

      if (other.id === brick.id) continue;

      const topY = other.group.position.y + other.height;

      const sameHeight =
        Math.abs(brick.group.position.y - topY) < 0.001;

      if (!sameHeight) continue;

      const dx = Math.abs(
        brick.group.position.x - other.group.position.x
      );

      const dz = Math.abs(
        brick.group.position.z - other.group.position.z
      );

      if (dx <= (brick.width + other.width) / 2 &&
          dz <= (brick.depth + other.depth) / 2) {

        this.connectionManager.createConnection(
          other.id,
          brick.id,
          brick.group.position
        );

      }

    }

  }

  cancelPlacement() {

    this.selectedPart = null;

    this.preview.hide();

    this.previewPosition = null;
    this.previewValid = false;

  }

}
