import * as THREE from 'three';
console.log('THREE.MeshStandardMaterial:', typeof THREE.MeshStandardMaterial);
console.log('THREE.Color:', typeof THREE.Color);
console.log('THREE.Mesh:', typeof THREE.Mesh);
console.log('THREE.DoubleSide:', THREE.DoubleSide);
console.log('THREE.FrontSide:', THREE.FrontSide);

// Try instantiation
try {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    console.log('MeshStandardMaterial instantiated OK:', mat.type);
    mat.dispose();
    console.log('dispose() OK');
} catch(e) {
    console.error('Instantiation error:', e.message);
}

try {
    const col = new THREE.Color(0xFF0000);
    console.log('Color instantiated OK:', col.r, col.g, col.b);
} catch(e) {
    console.error('Color error:', e.message);
}
