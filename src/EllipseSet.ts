import * as THREE from 'three';
import { CONFIG } from './Config';
import { State } from './State';
import { SHADERS } from './Shaders';
import { createParticleGeometry } from './Utils';

// Materials (Initialized lazily or at module scope if safe)
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

// Page 2 Origins (Standard Material with Smooth Shading)
const originMaterialsPage2 = CONFIG.COLORS.map(color => new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.4,
    metalness: 0.3,
    flatShading: false,
    transparent: true, // Enable transparency for opacity changes
    opacity: 1.0
}));

// Page 1 Origins (Basic Material - No Lighting)
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

export interface EllipseData {
    container: THREE.Object3D;
    meshes: THREE.Mesh[];
    originMesh: THREE.Mesh;
    xRadius: number;
    yRadius: number;
    rotation: number;
    startAngle: number;
    currentStartAngle: number;
    currentEndAngle: number;
    targetEndAngle: number;
    drawSpeed: number;
    tailDelay: number;
    finished: boolean;
}

export class EllipseSet {
    scene: THREE.Scene;
    config: EllipseConfig;
    ellipses: EllipseData[];
    lastCycleTime: number;
    BASE_X_RADIUS: number;
    BASE_Y_RADIUS: number;
    BASE_ROTATION: number;
    LINE_WIDTH: number;
    sharedParticleGeo?: THREE.ExtrudeGeometry;

    constructor(scene: THREE.Scene, config: EllipseConfig) {
        this.scene = scene;
        this.config = config;
        this.ellipses = [];
        this.lastCycleTime = 0;

        this.BASE_X_RADIUS = 0.6 * config.radiusScale;
        this.BASE_Y_RADIUS = 0.3 * config.radiusScale;
        this.BASE_ROTATION = -Math.PI / 4;
        this.LINE_WIDTH = 0.2 * config.radiusScale;

        // Shared Geometry for Uniformity in Page 1
        if (!this.config.isComplex) {
            const originScaleFactor = this.config.originScale || 0.13;
            this.sharedParticleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale);
        }

        this.init();
    }

    init() {
        for (let i = 0; i < this.config.count; i++) {
            this.ellipses.push(this.createEllipse());
        }
    }

    createEllipse(): EllipseData {
        const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);

        const numLayers = this.config.isComplex ? 3 : 1;
        const meshes: THREE.Mesh[] = [];

        // --- GEOMETRY PRE-ALLOCATION ---
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
        let particleGeo: THREE.ExtrudeGeometry;
        if (this.sharedParticleGeo) {
            particleGeo = this.sharedParticleGeo;
        } else {
            const originScaleFactor = this.config.originScale || 0.13;
            particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale);
        }

        // Material Selection based on Mode (Complex = Page 2)
        let originMat;
        if (this.config.isComplex) {
            // Page 2: Standard Material (Clone to allow individual opacity control)
            originMat = originMaterialsPage2[colorIndex].clone();
        } else {
            // Page 1: Basic Material (No Lighting)
            originMat = originMaterialsPage1[colorIndex];
        }

        const originMesh = new THREE.Mesh(particleGeo, originMat);

        let xPos, yPos;
        if (this.config.isCentered) {
            xPos = 0; yPos = 0;
        } else {
            xPos = (Math.random() - 0.5) * 36;
            yPos = (Math.random() - 0.5) * 16;
        }

        // --- STRICT UNIFORM INITIALIZATION ---
        const initialXRadius = State.interactionTarget.xRadius * this.config.radiusScale;
        const initialYRadius = State.interactionTarget.yRadius * this.config.radiusScale;
        const initialRotation = State.interactionTarget.rotation;

        // --- CONTAINER STRUCTURE ---
        const container = new THREE.Object3D();
        container.position.set(xPos, yPos, 0);
        container.rotation.z = initialRotation;

        // Add lines to container
        meshes.forEach((m, i) => {
            container.add(m);
            m.position.z = i * 0.002;
            m.rotation.z = (Math.random() - 0.5) * 0.05;
        });

        // Add origin to container
        container.add(originMesh);

        // UNIFORM ROTATION FOR PAGE 1
        if (!this.config.isComplex) {
            originMesh.rotation.z = 0;
        } else {
            originMesh.rotation.z = Math.random() * Math.PI * 2;
        }

        originMesh.position.set(initialXRadius, 0, 0.02);

        this.scene.add(container);

        // Visibility Logic
        container.visible = true;
        originMesh.visible = true;
        meshes.forEach(m => m.visible = false);

        const ellipseData: EllipseData = {
            container, meshes, originMesh,
            xRadius: initialXRadius,
            yRadius: initialYRadius,
            rotation: initialRotation,
            startAngle: 0,
            currentStartAngle: 0,
            currentEndAngle: 0,
            targetEndAngle: -2 * Math.PI,
            drawSpeed: CONFIG.UNIFIED_DRAW_SPEED,
            tailDelay: CONFIG.UNIFIED_TAIL_DELAY,
            finished: false
        };

        this.updateGeometry(ellipseData);
        return ellipseData;
    }

    updateGeometry(ellipseData: EllipseData) {
        const start = ellipseData.currentStartAngle;
        const end = ellipseData.currentEndAngle;
        const a = ellipseData.xRadius;
        const b = ellipseData.yRadius;

        const tipX = a * Math.cos(end);
        const tipY = b * Math.sin(end);

        ellipseData.originMesh.position.set(tipX, tipY, 0.02);

        // Page 2 Opacity Logic
        if (this.config.isComplex) {
            const isDrawing = !ellipseData.finished && State.hasInteracted;
            const mat = ellipseData.originMesh.material as THREE.MeshStandardMaterial;
            if (isDrawing) {
                mat.opacity = 0.4; // Lower opacity while drawing
            } else {
                mat.opacity = 1.0; // Restore opacity
            }
        }

        if (!State.hasInteracted) {
            ellipseData.meshes.forEach(m => m.visible = false);
            return;
        }

        if (Math.abs(start - end) < 0.001) {
            ellipseData.meshes.forEach(m => m.visible = false);
            return;
        }
        ellipseData.meshes.forEach(m => m.visible = true);

        const segments = this.config.segments;
        const maxHalfWidth = this.LINE_WIDTH / 2;

        const positions: number[] = [];
        const alphas: number[] = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const theta = start + (end - start) * t;

            const x = a * Math.cos(theta);
            const y = b * Math.sin(theta);

            let tx = -a * Math.sin(theta);
            let ty = b * Math.cos(theta);
            const len = Math.sqrt(tx * tx + ty * ty);
            tx /= len; ty /= len;

            const nx = ty; const ny = -tx;
            const halfWidth = maxHalfWidth * (0.5 + 0.5 * t * t);

            positions.push(x + nx * halfWidth, y + ny * halfWidth, 0);
            positions.push(x - nx * halfWidth, y - ny * halfWidth, 0);

            const alpha = Math.pow(t, 1.5) * 0.9;
            alphas.push(alpha, alpha);
        }

        ellipseData.meshes.forEach(m => {
            const geo = m.geometry;
            const posAttr = geo.attributes.position;
            const alphaAttr = geo.attributes.alpha;

            for (let k = 0; k < positions.length; k++) {
                posAttr.array[k] = positions[k];
            }
            posAttr.needsUpdate = true;

            for (let k = 0; k < alphas.length; k++) {
                alphaAttr.array[k] = alphas[k];
            }
            alphaAttr.needsUpdate = true;

            geo.computeBoundingSphere();
        });
    }

    resetDrawingParams(e: EllipseData) {
        e.startAngle = 0;
        e.currentStartAngle = 0;
        e.currentEndAngle = 0;
        e.targetEndAngle = -2 * Math.PI;
        e.finished = false;

        e.container.rotation.z = e.rotation;

        this.updateGeometry(e);
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
            e.xRadius += (currentCycleTargetX - e.xRadius) * lerpFactor;
            e.yRadius += (currentCycleTargetY - e.yRadius) * lerpFactor;

            let diff = currentCycleTargetRot - e.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            e.rotation += diff * lerpFactor;

            this.resetDrawingParams(e);
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
            if (!e.finished) {
                isAnyAnimating = true;
                if (e.currentEndAngle > e.targetEndAngle) {
                    e.currentEndAngle -= e.drawSpeed;
                    if (e.currentEndAngle < e.targetEndAngle) e.currentEndAngle = e.targetEndAngle;
                }
                if ((e.startAngle - e.currentEndAngle) > e.tailDelay || e.currentEndAngle === e.targetEndAngle) {
                    if (e.currentStartAngle > e.targetEndAngle) {
                        e.currentStartAngle -= e.drawSpeed;
                        if (e.currentStartAngle < e.targetEndAngle) e.currentStartAngle = e.targetEndAngle;
                    }
                }
                if (e.currentStartAngle <= e.targetEndAngle) e.finished = true;
                this.updateGeometry(e);
            }
        });
        return isAnyAnimating;
    }

    setVisible(visible: boolean) {
        this.ellipses.forEach(e => {
            e.container.visible = visible;
            if (visible) {
                e.originMesh.visible = true;
                if (State.hasInteracted) {
                    e.meshes.forEach(m => m.visible = true);
                } else {
                    e.meshes.forEach(m => m.visible = false);
                }
            }
        });
    }
}
