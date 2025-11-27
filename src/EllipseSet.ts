import * as THREE from 'three';
import { CONFIG } from './Config';
import { State } from './State';
import { SHADERS } from './Shaders';
import { createParticleGeometry } from './Utils';
import { Ellipse } from './Ellipse';

// Materials
const lineMaterials = CONFIG.COLORS.map(color => {
    return new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(color) },
            opacityMultiplier: { value: 3.0 }
        },
        vertexShader: SHADERS.line.vertex,
        fragmentShader: SHADERS.line.fragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
});



const originMaterialsPage1 = CONFIG.COLORS.map(color => new THREE.MeshBasicMaterial({
    color: color
}));

export interface EllipseConfig {
    count: number;
    radiusScale: number;
    isCentered: boolean;
    segments: number;
    hasShadow: boolean;
    originScale: number;
    opacityMultiplier: number;
    isComplex?: boolean;
}

export class EllipseSet {
    scene: THREE.Scene;
    config: EllipseConfig;
    ellipses: Ellipse[];
    lastCycleTime: number;
    // sharedParticleGeo removed


    constructor(scene: THREE.Scene, config: EllipseConfig) {
        this.scene = scene;
        this.config = config;
        this.ellipses = [];
        this.lastCycleTime = 0;

        // Shared Geometry removed to allow unique shapes per ellipse


        this.init();
    }

    init() {
        for (let i = 0; i < this.config.count; i++) {
            this.createEllipse();
        }
    }

    createEllipse() {
        const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);

        const numLayers = this.config.isComplex ? 3 : 1;
        const meshes: THREE.Mesh[] = [];

        const segments = this.config.segments;
        const vertexCount = (segments + 1) * 2;

        for (let i = 0; i < numLayers; i++) {
            const mat = lineMaterials[colorIndex].clone();
            mat.uniforms.opacityMultiplier.value = this.config.opacityMultiplier || 3.0;
            if (this.config.isComplex) {
                mat.uniforms.opacityMultiplier.value *= (0.6 + Math.random() * 0.4);
            }

            const geometry = new THREE.BufferGeometry();

            const positions = new Float32Array(vertexCount * 3);
            const alphas = new Float32Array(vertexCount);
            const sides = new Float32Array(vertexCount);
            const progresses = new Float32Array(vertexCount);
            const indices: number[] = [];

            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                sides[j * 2] = 0.0;
                sides[j * 2 + 1] = 1.0;
                progresses[j * 2] = t;
                progresses[j * 2 + 1] = t;

                if (j < segments) {
                    const base = j * 2;
                    indices.push(base, base + 1, base + 2);
                    indices.push(base + 2, base + 1, base + 3);
                }
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
            geometry.setAttribute('side', new THREE.BufferAttribute(sides, 1));
            geometry.setAttribute('progress', new THREE.BufferAttribute(progresses, 1));
            geometry.setIndex(indices);

            const mesh = new THREE.Mesh(geometry, mat);
            meshes.push(mesh);
        }

        // Origin Geometry
        const originScaleFactor = this.config.originScale || 0.13;
        const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
            minPoints: this.config.isComplex ? 6 : 5,
            maxPoints: this.config.isComplex ? 9 : 8,
            irregularity: this.config.isComplex ? 0.2 : 0.4,
            bevelEnabled: !this.config.isComplex // No bevel for Page 2 (isComplex) to remove inner shadow
        });

        // Material Selection
        let originMat;
        if (this.config.isComplex) {
            // Page 2: Use BasicMaterial to remove inner shadow, as requested.
            // Also reusing Page 1 materials or creating new BasicMaterial.
            originMat = originMaterialsPage1[colorIndex].clone();
            originMat.transparent = true;
            originMat.opacity = 1.0;
        } else {
            // Page 1: Randomize color
            originMat = originMaterialsPage1[colorIndex].clone();
            const color = originMat.color;
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);

            // Randomize Saturation and Lightness
            hsl.s += (Math.random() - 0.5) * 0.2;
            hsl.l += (Math.random() - 0.5) * 0.2;

            // Clamp
            hsl.s = Math.max(0, Math.min(1, hsl.s));
            hsl.l = Math.max(0, Math.min(1, hsl.l));

            originMat.color.setHSL(hsl.h, hsl.s, hsl.l);
        }

        const originMesh = new THREE.Mesh(particleGeo, originMat);

        let xPos, yPos;
        if (this.config.isCentered) {
            xPos = 0; yPos = 0;
        } else {
            xPos = (Math.random() - 0.5) * 36;
            yPos = (Math.random() - 0.5) * 16;
        }

        const initialXRadius = State.interactionTarget.xRadius * this.config.radiusScale;
        const initialYRadius = State.interactionTarget.yRadius * this.config.radiusScale;
        const initialRotation = State.interactionTarget.rotation;

        const ellipse = new Ellipse(this.config, meshes, originMesh, initialXRadius, initialYRadius, initialRotation);

        ellipse.data.container.position.set(xPos, yPos, 0);

        this.scene.add(ellipse.data.container);
        this.ellipses.push(ellipse);
    }

    updateCycle() {
        if (!State.hasInteracted) return;

        const scale = this.config.radiusScale;

        // --- GLOBAL DRIFT ---
        State.drift.time += 0.05;

        // Rotation
        const rotDrift = Math.sin(State.drift.time * State.drift.speed) * State.drift.amplitude;
        const currentCycleTargetRot = State.interactionTarget.rotation + rotDrift;

        // Size
        const sizeVar = 1.0 + Math.sin(State.drift.time * 0.3) * State.drift.sizeVarAmp;
        const currentCycleTargetX = State.interactionTarget.xRadius * scale * sizeVar;

        // Curvature
        const curveVar = 1.0 + Math.cos(State.drift.time * 0.4) * State.drift.curveVarAmp;
        const currentCycleTargetY = State.interactionTarget.yRadius * scale * curveVar;

        this.ellipses.forEach(e => {
            const lerpFactor = 0.1;
            e.data.xRadius += (currentCycleTargetX - e.data.xRadius) * lerpFactor;
            e.data.yRadius += (currentCycleTargetY - e.data.yRadius) * lerpFactor;

            let diff = currentCycleTargetRot - e.data.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            e.data.rotation += diff * lerpFactor;

            e.resetDrawingParams();
        });
    }

    update(dt: number) {
        if (dt - this.lastCycleTime > CONFIG.CYCLE_INTERVAL) {
            this.lastCycleTime = dt;
            this.updateCycle();
        }

        if (!State.hasInteracted) return false;

        let isAnyAnimating = false;
        this.ellipses.forEach(e => {
            if (e.update(dt)) {
                isAnyAnimating = true;
            }
        });
        return isAnyAnimating;
    }

    setVisible(visible: boolean) {
        this.ellipses.forEach(e => {
            e.data.container.visible = visible;
            if (visible) {
                e.data.originMesh.visible = true;
                if (State.hasInteracted) {
                    e.data.meshes.forEach(m => m.visible = true);
                } else {
                    e.data.meshes.forEach(m => m.visible = false);
                }
            }
        });
    }

    regenerateOrigins() {
        this.ellipses.forEach(e => {
            // Generate new geometry
            const originScaleFactor = this.config.originScale || 0.13;
            const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
                minPoints: this.config.isComplex ? 6 : 5,
                maxPoints: this.config.isComplex ? 9 : 8,
                irregularity: this.config.isComplex ? 0.2 : 0.4,
                bevelEnabled: !this.config.isComplex
            });

            e.updateOriginGeometry(particleGeo);
        });
    }
}
