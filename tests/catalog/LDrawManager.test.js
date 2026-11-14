import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { LDrawManager } from '../../src/catalog/ldraw/LDrawManager.js';

function makeFakeLoader() {
    return {
        setPath() { return this; },
        async preloadMaterials() {},
        async loadAsync(path) {
            const group = new Group();
            group.add(new Mesh(new BoxGeometry(20, 24, 40), new MeshBasicMaterial()));
            group.userData.loadedPath = path;
            return group;
        }
    };
}

test('loads an LDraw part at 1/20 scale and returns independent object hierarchies', async () => {
    let loads = 0;
    const loader = makeFakeLoader();
    const manager = new LDrawManager({
        loaderFactory: { create: () => loader },
        materialManager: { initialize: async () => {} }
    });
    const originalLoad = loader.loadAsync;
    loader.loadAsync = async (...args) => { loads++; return originalLoad(...args); };

    const first = await manager.loadPart('3001');
    const second = await manager.loadPart('3001');

    assert.notEqual(first, second);
    assert.equal(first.scale.x, 0.05);
    assert.equal(second.userData.ldrawPartNumber, '3001');
    assert.equal(loads, 1);
    assert.equal(manager.getCachedPartCount(), 1);

    manager.dispose();
});
