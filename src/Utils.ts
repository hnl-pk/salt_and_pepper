import * as THREE from 'three';
import { State } from './State';

export function createParticleGeometry(baseRadius: number, options: {
    minPoints?: number;
    maxPoints?: number;
    irregularity?: number;
    depth?: number;
    bevelEnabled?: boolean;
} = {}): THREE.ExtrudeGeometry {
    const minPoints = options.minPoints || 5;
    const maxPoints = options.maxPoints || 8;
    const irregularity = options.irregularity !== undefined ? options.irregularity : 0.2; // 0 to 1
    const depth = options.depth !== undefined ? options.depth : baseRadius * 0.4;
    const bevelEnabled = options.bevelEnabled !== undefined ? options.bevelEnabled : true;

    const numPoints = Math.floor(minPoints + Math.random() * (maxPoints - minPoints + 1));
    const shape = new THREE.Shape();

    const angleStep = (Math.PI * 2) / numPoints;

    for (let i = 0; i < numPoints; i++) {
        // Base angle with some jitter if needed, but keeping it simple for now:
        // To make edges uneven, we vary the radius significantly.
        // To make angles uneven, we could jitter theta.

        // Let's jitter theta slightly for more irregularity
        const angleJitter = (Math.random() - 0.5) * angleStep * 0.5;
        const theta = i * angleStep + angleJitter;

        const r = baseRadius * (1.0 + (Math.random() - 0.5) * irregularity * 2);

        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;

        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }

    const extrudeSettings = {
        steps: 2,
        depth: depth,
        bevelEnabled: bevelEnabled,
        bevelThickness: bevelEnabled ? baseRadius * 0.2 : 0,
        bevelSize: bevelEnabled ? baseRadius * 0.1 : 0,
        bevelSegments: 3
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

export function randomizeShapeConditions() {
    State.drift.speed = 0.2 + Math.random() * 1.0;
    State.drift.amplitude = 0.02 + Math.random() * 0.15;

    // Request 4: Increase probability of longer major axis (sizeVarAmp).
    // sizeVarAmp affects xRadius (major axis usually).
    // Let's bias it higher.
    State.drift.sizeVarAmp = 0.3 + Math.random() * 0.5; // Previously 0.1 + 0.4

    State.drift.curveVarAmp = 0.1 + Math.random() * 0.4;

    if (Math.random() > 0.5) State.drift.speed *= -1;
}

export function getRandomizedColor(baseColor: THREE.Color | number): THREE.Color {
    const color = new THREE.Color(baseColor);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);

    hsl.s += (Math.random() - 0.5) * 0.2;
    hsl.l += (Math.random() - 0.5) * 0.2;

    hsl.s = Math.max(0, Math.min(1, hsl.s));
    hsl.l = Math.max(0, Math.min(1, hsl.l));

    color.setHSL(hsl.h, hsl.s, hsl.l);
    return color;
}
