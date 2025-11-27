import * as THREE from 'three';
import { CONFIG } from './Config';
import { State } from './State';
import { EllipseConfig } from './EllipseSet';

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

export class Ellipse {
    data: EllipseData;
    config: EllipseConfig;
    LINE_WIDTH: number;

    constructor(config: EllipseConfig, meshes: THREE.Mesh[], originMesh: THREE.Mesh, initialX: number, initialY: number, initialRot: number) {
        this.config = config;

        const originScale = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
        if (this.config.isComplex) {
            // Page 2: Thicker line relative to scale
            this.LINE_WIDTH = originScale * this.config.radiusScale * 2.5;
        } else {
            // Page 1: Standard thickness
            this.LINE_WIDTH = originScale * this.config.radiusScale * 2.0;
        }

        // Container Setup
        const container = new THREE.Object3D();

        // Position (Random or Centered logic handled by caller, passed here?) 
        // Actually, let's keep position logic in EllipseSet or pass it in.
        // For now, we assume the caller sets the container position.

        container.rotation.z = initialRot;

        // Add lines
        meshes.forEach((m, i) => {
            container.add(m);
            m.position.z = i * CONFIG.Z_SPACING;
            m.rotation.z = (Math.random() - 0.5) * CONFIG.ROTATION_JITTER;
        });

        // Add origin
        container.add(originMesh);
        if (!this.config.isComplex) {
            originMesh.rotation.z = 0;
        } else {
            originMesh.rotation.z = Math.random() * Math.PI * 2;
        }
        originMesh.position.set(initialX, 0, CONFIG.ORIGIN_Z);

        // Visibility
        container.visible = true;
        originMesh.visible = true;
        meshes.forEach(m => m.visible = false);

        this.data = {
            container, meshes, originMesh,
            xRadius: initialX,
            yRadius: initialY,
            rotation: initialRot,
            startAngle: 0,
            currentStartAngle: 0,
            currentEndAngle: 0,
            targetEndAngle: -2 * Math.PI,
            drawSpeed: CONFIG.UNIFIED_DRAW_SPEED,
            tailDelay: CONFIG.UNIFIED_TAIL_DELAY,
            finished: false
        };

        this.updateGeometry();
    }

    updateGeometry() {
        const d = this.data;
        const start = d.currentStartAngle;
        const end = d.currentEndAngle;
        const a = d.xRadius;
        const b = d.yRadius;

        // Update Origin Position
        const tipX = a * Math.cos(end);
        const tipY = b * Math.sin(end);
        d.originMesh.position.set(tipX, tipY, CONFIG.ORIGIN_Z);

        // Page 2 Opacity Logic: Force 100% opacity for origin
        if (this.config.isComplex) {
            const mat = d.originMesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 1.0;
        }

        // Visibility Check
        if (!State.hasInteracted || Math.abs(start - end) < 0.001) {
            d.meshes.forEach(m => m.visible = false);
            return;
        }
        d.meshes.forEach(m => m.visible = true);

        // Calculate offset to stop line before origin center
        // Stop slightly inside the origin to prevent overlap
        const originRadius = (this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE) * this.config.radiusScale;
        const currentRadius = Math.sqrt(tipX * tipX + tipY * tipY);
        // Stop at 0.8 * radius (deep inside)
        const angleOffset = (originRadius * 0.8) / (currentRadius || 1);

        // We are drawing from start (0) to end (negative).
        // So we want effectiveEnd to be end + angleOffset (less negative).
        let effectiveEnd = end + angleOffset;
        if (effectiveEnd > start) effectiveEnd = start;

        // Geometry Calculation
        const segments = this.config.segments;
        const maxHalfWidth = this.LINE_WIDTH / 2;

        // We need to update ALL meshes
        for (const m of d.meshes) {
            const posAttr = m.geometry.attributes.position;
            const alphaAttr = m.geometry.attributes.alpha;

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const theta = start + (effectiveEnd - start) * t;

                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                const x = a * cosTheta;
                const y = b * sinTheta;

                // Normal calculation
                let tx = -a * sinTheta;
                let ty = b * cosTheta;
                const len = Math.sqrt(tx * tx + ty * ty);
                tx /= len; ty /= len;

                const nx = ty; const ny = -tx;

                // Tapering logic:
                // Taper the line width near the connection point to ensure a smooth join with the origin.
                // The taper starts a fixed distance (angle) before the tip.

                // Calculate total angle length of the drawn line
                const totalAngle = Math.abs(start - effectiveEnd);

                // Start tapering at ~2.5 * angleOffset (approx 2.0 * originRadius)
                const taperAngle = angleOffset * 2.5;

                let taperThreshold = 0.85; // Default fallback
                if (totalAngle > 0.001) {
                    taperThreshold = Math.max(0, 1.0 - (taperAngle / totalAngle));
                }

                let widthFactor = 0.5 + 0.5 * t * t; // Original profile (thickest at tip)

                if (this.config.isComplex && t > taperThreshold) {
                    // Taper down to 0.6 at the tip to match origin width without protruding
                    const taperRange = 1.0 - taperThreshold;
                    if (taperRange > 0.0001) {
                        const taperT = (t - taperThreshold) / taperRange; // 0 to 1
                        const targetScale = 0.6;
                        const taper = 1.0 - taperT * (1.0 - targetScale);
                        widthFactor *= taper;
                    }
                }

                const halfWidth = maxHalfWidth * widthFactor;

                // Vertex 1
                posAttr.setXYZ(i * 2, x + nx * halfWidth, y + ny * halfWidth, 0);
                // Vertex 2
                posAttr.setXYZ(i * 2 + 1, x - nx * halfWidth, y - ny * halfWidth, 0);

                const alpha = Math.pow(t, 1.5) * 0.9;
                alphaAttr.setX(i * 2, alpha);
                alphaAttr.setX(i * 2 + 1, alpha);
            }

            posAttr.needsUpdate = true;
            alphaAttr.needsUpdate = true;
            m.geometry.computeBoundingSphere();
        }
    }

    resetDrawingParams() {
        const d = this.data;
        d.startAngle = 0;
        d.currentStartAngle = 0;
        d.currentEndAngle = 0;
        d.targetEndAngle = -2 * Math.PI;
        d.finished = false;

        d.container.rotation.z = d.rotation;
        this.updateGeometry();
    }

    update(_dt: number): boolean {
        const d = this.data;
        if (d.finished) return false;

        let animating = false;

        if (d.currentEndAngle > d.targetEndAngle) {
            d.currentEndAngle -= d.drawSpeed;
            if (d.currentEndAngle < d.targetEndAngle) d.currentEndAngle = d.targetEndAngle;
            animating = true;
        }

        // Delay disappearance slightly to ensure full visibility before fading
        const disappearanceDelayBuffer = 0.5; // Extra radians or time equivalent
        if ((d.startAngle - d.currentEndAngle) > (d.tailDelay + disappearanceDelayBuffer) || d.currentEndAngle === d.targetEndAngle) {
            if (d.currentStartAngle > d.targetEndAngle) {
                d.currentStartAngle -= d.drawSpeed;
                if (d.currentStartAngle < d.targetEndAngle) d.currentStartAngle = d.targetEndAngle;
                animating = true;
            }
        }

        if (d.currentStartAngle <= d.targetEndAngle) d.finished = true;

        if (animating) this.updateGeometry();

        return animating;
    }

    updateOriginGeometry(geometry: THREE.BufferGeometry) {
        this.data.originMesh.geometry.dispose();
        this.data.originMesh.geometry = geometry;
    }
}
