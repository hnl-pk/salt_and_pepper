import * as THREE from 'three';
import { State } from './State';

export function createParticleGeometry(baseRadius: number): THREE.ExtrudeGeometry {
    const numPoints = 12;
    const shape = new THREE.Shape();
    for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const r = baseRadius * (0.95 + Math.random() * 0.1);
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    const extrudeSettings = {
        steps: 2,
        depth: baseRadius * 0.4,
        bevelEnabled: true,
        bevelThickness: baseRadius * 0.2,
        bevelSize: baseRadius * 0.1,
        bevelSegments: 3
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

export function randomizeShapeConditions() {
    State.drift.speed = 0.2 + Math.random() * 1.0;
    State.drift.amplitude = 0.02 + Math.random() * 0.15;
    State.drift.sizeVarAmp = 0.1 + Math.random() * 0.4;
    State.drift.curveVarAmp = 0.1 + Math.random() * 0.4;

    if (Math.random() > 0.5) State.drift.speed *= -1;
}
