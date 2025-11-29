import * as THREE from 'three';
import { CONFIG } from './Config';
import { State } from './State';
import { SHADERS } from './Shaders';
import { createParticleGeometry, getRandomizedColor } from './Utils';
import { Ellipse } from './Ellipse';

// Materials
const lineMaterials = CONFIG.COLORS.map(color => {
    return new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(color) },
            opacityMultiplier: { value: CONFIG.PAGE1_OPACITY_MULT }
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
    // Removed isComplex, replaced by specific flags if needed, or handled by subclass
    taperEnabled?: boolean;
    forceSolidLine?: boolean;
}

export abstract class EllipseSetBase {
    scene: THREE.Scene;
    config: EllipseConfig;
    ellipses: Ellipse[];
    lastCycleTime: number;

    constructor(scene: THREE.Scene, config: EllipseConfig) {
        this.scene = scene;
        this.config = config;
        this.ellipses = [];
        this.lastCycleTime = 0;
        this.init();
    }

    init() {
        for (let i = 0; i < this.config.count; i++) {
            this.createEllipse();
        }
    }

    abstract createEllipse(): void;
    abstract regenerateOrigins(): void;

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
}

export class Page1EllipseSet extends EllipseSetBase {
    createEllipse() {
        const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);
        const meshes: THREE.Mesh[] = [];

        const segments = this.config.segments;
        const vertexCount = (segments + 1) * 2;

        // Create Line Meshes
        const mat = lineMaterials[colorIndex].clone();
        mat.uniforms.opacityMultiplier.value = this.config.opacityMultiplier || CONFIG.PAGE1_OPACITY_MULT;

        const geometry = this.createLineGeometry(vertexCount, segments);
        const mesh = new THREE.Mesh(geometry, mat);
        meshes.push(mesh);

        // Origin Geometry
        const originScaleFactor = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
        const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
            minPoints: 5,
            maxPoints: 8,
            irregularity: 0.4,
            bevelEnabled: true
        });

        // Material Selection (Page 1: Randomize color)
        const originMat = originMaterialsPage1[colorIndex].clone();
        originMat.color = getRandomizedColor(originMat.color);

        const originMesh = new THREE.Mesh(particleGeo, originMat);

        // Position (Random)
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

        // Calculate Line Width for Page 1
        const lineWidth = originScaleFactor * this.config.radiusScale * 2.0;

        const ellipse = new Ellipse(
            this.config,
            meshes,
            originMesh,
            initialXRadius,
            initialYRadius,
            initialRotation,
            lineWidth,
            false // No tapering for Page 1? Or was it? It was "isComplex" check.
        );

        ellipse.data.container.position.set(xPos, yPos, 0);
        this.scene.add(ellipse.data.container);
        this.ellipses.push(ellipse);
    }

    regenerateOrigins() {
        // Page 1 doesn't usually regenerate origins in the same way, but if needed:
        this.ellipses.forEach(e => {
            const originScaleFactor = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
            const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
                minPoints: 5,
                maxPoints: 8,
                irregularity: 0.4,
                bevelEnabled: true
            });
            e.updateOriginGeometry(particleGeo);

            // Randomize color again?
            const originMat = e.data.originMesh.material as THREE.MeshBasicMaterial;
            originMat.color = getRandomizedColor(originMat.color);
        });
    }

    private createLineGeometry(vertexCount: number, segments: number): THREE.BufferGeometry {
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
        return geometry;
    }
}

export class Page2EllipseSet extends EllipseSetBase {
    createEllipse() {
        const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);
        const numLayers = 3;
        const meshes: THREE.Mesh[] = [];

        const segments = this.config.segments;
        const vertexCount = (segments + 1) * 2;

        for (let i = 0; i < numLayers; i++) {
            const mat = lineMaterials[colorIndex].clone();
            mat.uniforms.opacityMultiplier.value = this.config.opacityMultiplier || CONFIG.PAGE2_OPACITY_MULT;
            mat.uniforms.opacityMultiplier.value *= (0.6 + Math.random() * 0.4);

            const geometry = this.createLineGeometry(vertexCount, segments);
            const mesh = new THREE.Mesh(geometry, mat);
            meshes.push(mesh);
        }

        // Origin Geometry
        const originScaleFactor = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
        const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
            minPoints: 6,
            maxPoints: 9,
            irregularity: 0.2,
            bevelEnabled: false
        });

        // Material Selection (Page 2: Solid, synced color)
        const originMat = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS[colorIndex],
            transparent: true,
            opacity: 1.0
        });

        const originMesh = new THREE.Mesh(particleGeo, originMat);
        originMesh.rotation.z = Math.random() * Math.PI * 2;

        // Position (Centered)
        let xPos = 0, yPos = 0;

        const initialXRadius = State.interactionTarget.xRadius * this.config.radiusScale;
        const initialYRadius = State.interactionTarget.yRadius * this.config.radiusScale;
        const initialRotation = State.interactionTarget.rotation;

        // Calculate Line Width for Page 2
        const lineWidth = originScaleFactor * this.config.radiusScale * 2.5;

        const ellipse = new Ellipse(
            this.config,
            meshes,
            originMesh,
            initialXRadius,
            initialYRadius,
            initialRotation,
            lineWidth,
            true // Tapering enabled
        );

        ellipse.data.container.position.set(xPos, yPos, 0);
        this.scene.add(ellipse.data.container);
        this.ellipses.push(ellipse);
    }

    regenerateOrigins() {
        this.ellipses.forEach(e => {
            const originScaleFactor = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
            const particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale, {
                minPoints: 6,
                maxPoints: 9,
                irregularity: 0.2,
                bevelEnabled: false
            });

            e.updateOriginGeometry(particleGeo);

            // Synchronize color
            const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);
            const newColor = getRandomizedColor(CONFIG.COLORS[colorIndex]);

            // Update Line Meshes
            e.data.meshes.forEach(m => {
                const mat = m.material as THREE.ShaderMaterial;
                if (mat.uniforms && mat.uniforms.color) {
                    mat.uniforms.color.value.copy(newColor);
                }
            });

            // Update Origin Mesh
            const originMat = e.data.originMesh.material as THREE.MeshBasicMaterial;
            if (originMat.color) {
                originMat.color.copy(newColor);
            }
        });
    }

    private createLineGeometry(vertexCount: number, segments: number): THREE.BufferGeometry {
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
        return geometry;
    }
}
