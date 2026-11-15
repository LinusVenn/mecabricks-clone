/** Gemeinsame Serialisierung und Duplizierung von Brick und PartInstance. */
export function createCloneData(source, position = null, rotation = null) {
    if (!source?.id || !source.group) throw new Error('Ungültiges Ausgangsbauteil.');
    const p = source.group.position;
    const r = source.group.rotation;
    const s = source.group.scale;
    const data = {
        id: globalThis.crypto?.randomUUID?.() ?? `part-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: source.type ?? source.partId ?? source.userData?.partId ?? 'unknown',
        color: source.color ?? 0xffffff,
        position: position ?? { x: p.x, y: p.y, z: p.z },
        rotation: rotation ?? { x: r.x, y: r.y, z: r.z },
        scale: { x: s.x, y: s.y, z: s.z }
    };
    if (source.source) {
        data.source = source.source;
        data.sourceInstanceId = source.id;
        data.ldrawPartNumber = source.ldrawPartNumber ?? null;
        data.colorId = source.colorId ?? null;
        data.variantId = source.variantId ?? null;
        data.dimensions = { width: source.width, depth: source.depth, height: source.height };
    }
    return data;
}

function cloneObjectTree(sourceGroup) {
    const clone = sourceGroup.clone(true);
    clone.traverse(node => {
        if (!node.isMesh) return;
        if (node.geometry) node.geometry = node.geometry.clone();
        if (Array.isArray(node.material)) node.material = node.material.map(material => material.clone());
        else if (node.material) node.material = node.material.clone();
    });
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.updateMatrixWorld(true);
    return clone;
}

export function addClonedPartFromData(library, data) {
    if (data.source && data.sourceInstanceId) {
        const source = library.getById(data.sourceInstanceId);
        if (!source?.group) throw new Error(`Ausgangsinstanz ${data.sourceInstanceId} ist nicht verfügbar.`);
        const instance = library.addInstance({
            id: data.id,
            partId: data.type,
            source: data.source,
            object3D: cloneObjectTree(source.group),
            color: data.color,
            dimensions: data.dimensions ?? { width: source.width, depth: source.depth, height: source.height },
            ldrawPartNumber: data.ldrawPartNumber ?? source.ldrawPartNumber ?? null,
            colorId: data.colorId ?? source.colorId ?? null,
            variantId: data.variantId ?? source.variantId ?? null
        });
        instance.setTransform(data.position, data.rotation);
        if (data.scale) instance.group.scale.set(data.scale.x ?? 1, data.scale.y ?? 1, data.scale.z ?? 1);
        instance.group.updateMatrixWorld(true);
        return instance;
    }
    const brick = library.addBrickFromData(data);
    if (data.scale && brick.group?.scale) brick.group.scale.set(data.scale.x ?? 1, data.scale.y ?? 1, data.scale.z ?? 1);
    brick.group.updateMatrixWorld?.(true);
    return brick;
}

export function removeClonedPart(library, id) {
    const part = library.getById(id);
    if (part) library.removeBrick(part);
}
