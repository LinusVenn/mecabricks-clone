
import { Box3, Vector3 } from 'three';

export class SelectionFilter {
    constructor(library, groupManager = null) {
        if (!library) {
            throw new Error('SelectionFilter: Eine PartLibrary ist erforderlich.');
        }

        this.library = library;
        this.groupManager = groupManager;
    }

    getAllBricks() {
        if (typeof this.library.getAll === 'function') {
            return this.library.getAll();
        }

        if (Array.isArray(this.library.bricks)) {
            return [...this.library.bricks];
        }

        throw new Error('SelectionFilter: Die PartLibrary stellt keine Bauteilliste bereit.');
    }

    filter(criteria = {}) {
        const name = this.normalize(criteria.name);
        const type = this.normalize(criteria.type);
        const color = this.normalize(criteria.color);
        const material = this.normalize(criteria.material);
        const groupId = criteria.groupId || '';

        return this.getAllBricks().filter(brick => {
            if (!brick || this.isLocked(brick) || !this.isVisible(brick)) {
                return false;
            }

            if (name && !this.getName(brick).includes(name)) return false;
            if (type && !this.getType(brick).includes(type)) return false;
            if (color && !this.getColor(brick).includes(color)) return false;
            if (material && !this.getMaterial(brick).includes(material)) return false;

            if (groupId && this.getGroupId(brick) !== groupId) {
                return false;
            }

            if (criteria.spatial && !this.matchesSpatial(brick, criteria.spatial)) {
                return false;
            }

            return true;
        });
    }

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

    filterBySpatial(spatial) {
        return this.filter({ spatial });
    }

    // --------------------------------------------------
    // Räumliche Filterung
    // --------------------------------------------------

    matchesSpatial(brick, spatial = {}) {
        const bounds = this.getBoundingBox(brick);

        if (!bounds || bounds.isEmpty()) {
            return false;
        }

        const mode = spatial.mode === 'contained'
            ? 'contained'
            : 'intersects';

        const hasBoxCriteria = [
            'minX', 'maxX',
            'minY', 'maxY',
            'minZ', 'maxZ'
        ].some(key => this.toNumber(spatial[key]) !== null);

        if (hasBoxCriteria) {
            const min = new Vector3(
                this.toNumber(spatial.minX) ?? -Infinity,
                this.toNumber(spatial.minY) ?? -Infinity,
                this.toNumber(spatial.minZ) ?? -Infinity
            );

            const max = new Vector3(
                this.toNumber(spatial.maxX) ?? Infinity,
                this.toNumber(spatial.maxY) ?? Infinity,
                this.toNumber(spatial.maxZ) ?? Infinity
            );

            if (
                min.x > max.x ||
                min.y > max.y ||
                min.z > max.z
            ) {
                return false;
            }

            const searchBox = new Box3(min, max);

            if (mode === 'contained') {
                if (
                    bounds.min.x < searchBox.min.x ||
                    bounds.min.y < searchBox.min.y ||
                    bounds.min.z < searchBox.min.z ||
                    bounds.max.x > searchBox.max.x ||
                    bounds.max.y > searchBox.max.y ||
                    bounds.max.z > searchBox.max.z
                ) {
                    return false;
                }
            } else if (!bounds.intersectsBox(searchBox)) {
                return false;
            }
        }

        const radius = this.toNumber(spatial.radius);

        if (radius !== null) {
            if (radius < 0) return false;

            const center = new Vector3(
                this.toNumber(spatial.centerX) ?? 0,
                this.toNumber(spatial.centerY) ?? 0,
                this.toNumber(spatial.centerZ) ?? 0
            );

            if (mode === 'contained') {
                // Der am weitesten entfernte Eckpunkt muss innerhalb
                // des Radius liegen.
                const farthest = new Vector3(
                    Math.max(
                        Math.abs(bounds.min.x - center.x),
                        Math.abs(bounds.max.x - center.x)
                    ),
                    Math.max(
                        Math.abs(bounds.min.y - center.y),
                        Math.abs(bounds.max.y - center.y)
                    ),
                    Math.max(
                        Math.abs(bounds.min.z - center.z),
                        Math.abs(bounds.max.z - center.z)
                    )
                );

                if (farthest.lengthSq() > radius * radius) {
                    return false;
                }
            } else {
                // Kleinster Abstand zwischen Mittelpunkt und AABB.
                const closest = center.clone().clamp(
                    bounds.min,
                    bounds.max
                );

                if (closest.distanceToSquared(center) > radius * radius) {
                    return false;
                }
            }
        }

        return true;
    }

    getBoundingBox(brick) {
        const object = this.getObject(brick);

        if (!object) return null;

        object.updateWorldMatrix(true, true);

        return new Box3().setFromObject(object);
    }

    toNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number) ? number : null;
    }

    // --------------------------------------------------
    // Eigenschaften
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
        const color =
            brick.color ??
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

        return this.groupManager.getGroupByBrickId(brick.id)?.id ?? null;
    }

    // --------------------------------------------------
    // Sichtbarkeit und Sperren
    // --------------------------------------------------

    isLocked(brick) {
        const object = this.getObject(brick);

        if (
            brick.locked === true ||
            brick.userData?.locked === true
        ) {
            return true;
        }

        let current = object;

        while (current) {
            if (
                current.userData?.editorLocked === true ||
                current.userData?.locked === true
            ) {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    isVisible(brick) {
        const object = this.getObject(brick);

        if (brick.visible === false) return false;
        if (!object) return true;

        let current = object;

        while (current) {
            if (current.visible === false) return false;
            current = current.parent;
        }

        return true;
    }

    getObject(brick) {
        if (!brick) return null;

        if (brick.group?.isObject3D) return brick.group;
        if (brick.object?.isObject3D) return brick.object;
        if (brick.mesh?.isObject3D) return brick.mesh;

        return null;
    }

    normalize(value) {
        return String(value ?? '').trim().toLowerCase();
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
