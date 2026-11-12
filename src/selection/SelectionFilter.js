
export class SelectionFilter {

    constructor(library, groupManager = null) {
        if (!library) {
            throw new Error(
                'SelectionFilter: Eine PartLibrary ist erforderlich.'
            );
        }

        this.library = library;
        this.groupManager = groupManager;
    }

    // --------------------------------------------------
    // Bauteile ermitteln
    // --------------------------------------------------

    getAllBricks() {
        if (typeof this.library.getAll === 'function') {
            return this.library.getAll();
        }

        if (Array.isArray(this.library.bricks)) {
            return [...this.library.bricks];
        }

        throw new Error(
            'SelectionFilter: Die PartLibrary stellt keine Bauteilliste bereit.'
        );
    }

    // --------------------------------------------------
    // Filter anwenden
    // --------------------------------------------------

    filter(criteria = {}) {
        const bricks = this.getAllBricks();

        const name = this.normalize(criteria.name);
        const type = this.normalize(criteria.type);
        const color = this.normalize(criteria.color);
        const material = this.normalize(criteria.material);
        const groupId = criteria.groupId || '';

        return bricks.filter(brick => {
            if (!brick) return false;

            if (this.isLocked(brick)) return false;
            if (!this.isVisible(brick)) return false;

            if (
                name &&
                !this.getName(brick).includes(name)
            ) {
                return false;
            }

            if (
                type &&
                !this.getType(brick).includes(type)
            ) {
                return false;
            }

            if (
                color &&
                !this.getColor(brick).includes(color)
            ) {
                return false;
            }

            if (
                material &&
                !this.getMaterial(brick).includes(material)
            ) {
                return false;
            }

            if (
                groupId &&
                this.getGroupId(brick) !== groupId
            ) {
                return false;
            }

            return true;
        });
    }

    // --------------------------------------------------
    // Einzelne Filter
    // --------------------------------------------------

    filterByName(name) {
        return this.filter({ name });
    }

    filterByType(type) {
        return this.filter({ type });
    }

    filterByColor(color) {
        return this.filter({ color });
    }

    filterByMaterial(material) {
        return this.filter({ material });
    }

    filterByGroup(groupId) {
        return this.filter({ groupId });
    }

    // --------------------------------------------------
    // Eigenschaften auslesen
    // --------------------------------------------------

    getName(brick) {
        const object = this.getObject(brick);

        return this.normalize(
            brick.name ??
            brick.userData?.name ??
            object?.name ??
            brick.type ??
            ''
        );
    }

    getType(brick) {
        return this.normalize(
            brick.type ??
            brick.userData?.type ??
            this.getObject(brick)?.userData?.type ??
            ''
        );
    }

    getColor(brick) {
        const color = brick.color ??
            brick.material?.color ??
            this.getObject(brick)?.material?.color ??
            '';

        if (typeof color === 'string') {
            return this.normalize(color);
        }

        if (typeof color === 'number') {
            return color.toString(16).toLowerCase();
        }

        if (color && typeof color.getHexString === 'function') {
            return color.getHexString().toLowerCase();
        }

        if (color && typeof color.getHex === 'function') {
            return color.getHex().toString(16).toLowerCase();
        }

        return this.normalize(color?.value ?? '');
    }

    getMaterial(brick) {
        const object = this.getObject(brick);

        const material =
            brick.material ??
            brick.materialName ??
            brick.materialId ??
            brick.userData?.material ??
            object?.material ??
            object?.userData?.material ??
            '';

        if (typeof material === 'string') {
            return this.normalize(material);
        }

        if (Array.isArray(material)) {
            return this.normalize(
                material.map(item => item?.name ?? '').join(' ')
            );
        }

        return this.normalize(
            material?.name ??
            material?.userData?.name ??
            material?.uuid ??
            ''
        );
    }

    getGroupId(brick) {
        if (!this.groupManager) return null;

        return this.groupManager
            .getGroupByBrickId(brick.id)?.id ?? null;
    }

    // --------------------------------------------------
    // Sichtbarkeit und Sperrstatus
    // --------------------------------------------------

    isLocked(brick) {
        const object = this.getObject(brick);

        return (
            brick.locked === true ||
            brick.userData?.locked === true ||
            object?.userData?.locked === true
        );
    }

    isVisible(brick) {
        const object = this.getObject(brick);

        if (brick.visible === false) return false;
        if (object?.visible === false) return false;

        let current = object?.parent;

        while (current) {
            if (current.visible === false) return false;
            current = current.parent;
        }

        return true;
    }

    // --------------------------------------------------
    // Three.js-Objekt ermitteln
    // --------------------------------------------------

    getObject(brick) {
        if (!brick) return null;

        if (brick.group?.isObject3D) {
            return brick.group;
        }

        if (brick.object?.isObject3D) {
            return brick.object;
        }

        if (brick.mesh?.isObject3D) {
            return brick.mesh;
        }

        return null;
    }

    // --------------------------------------------------
    // Hilfsmethoden
    // --------------------------------------------------

    normalize(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase();
    }

    getAvailableTypes() {
        return [
            ...new Set(
                this.getAllBricks()
                    .map(brick => brick.type)
                    .filter(Boolean)
            )
        ].sort();
    }

    getAvailableColors() {
        return [
            ...new Set(
                this.getAllBricks()
                    .map(brick => this.getColor(brick))
                    .filter(Boolean)
            )
        ].sort();
    }

    getAvailableMaterials() {
        return [
            ...new Set(
                this.getAllBricks()
                    .map(brick => this.getMaterial(brick))
                    .filter(Boolean)
            )
        ].sort();
    }

    getAvailableGroups() {
        return this.groupManager?.getAllGroups() ?? [];
    }
}
