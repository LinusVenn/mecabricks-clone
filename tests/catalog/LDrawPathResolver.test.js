import test from 'node:test';
import assert from 'node:assert/strict';
import { LDrawPathResolver } from '../../src/catalog/ldraw/LDrawPathResolver.js';

test('resolves the standard LDraw library paths', () => {
    const resolver = new LDrawPathResolver('/ldraw');
    assert.equal(resolver.resolvePartFile('3001'), '/ldraw/parts/3001.dat');
    assert.equal(resolver.resolvePartFile('3020.dat'), '/ldraw/parts/3020.dat');
    assert.equal(resolver.resolveConfigFile(), '/ldraw/LDConfig.ldr');
});

test('rejects path traversal and invalid part numbers', () => {
    const resolver = new LDrawPathResolver('/ldraw/');
    assert.throws(() => resolver.resolvePartFile('../secret'));
    assert.throws(() => resolver.resolveLibraryFile('parts/../../secret.dat'));
});
