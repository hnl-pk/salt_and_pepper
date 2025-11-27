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
        // Request 4: Adjust thickness for Page 2 (isComplex) to match origin size
        // Origin scale is 0.13 * 0.7 for Page 2. Radius scale is 9.0.
        // Normal LINE_WIDTH is 0.2 * radiusScale.
        // For Page 2, we want it thicker relative to the scale? Or thinner?
        // "Page 2 ... adjust total thickness to match origin size"
        // If origin is small, line should be small?
        // Let's try to make it proportional to originScale.
        // Request 1: Match line thickness to origin width.
        // Origin diameter is approx 2 * originScale * radiusScale.
        // Previous was 0.2 * radiusScale.
        // If originScale is ~0.13, diameter is ~0.26.
        // Let's make LINE_WIDTH closer to origin diameter or at least significantly thicker.
        // Let's try 1.5x the origin scale factor as a base width multiplier.

        const originScale = this.config.originScale || CONFIG.DEFAULT_ORIGIN_SCALE;
        if (this.config.isComplex) {
            // Page 2
            // Request 2: Restore thickness.
            // Previous: 1.6. Restoring to 2.5.
            this.LINE_WIDTH = originScale * this.config.radiusScale * 2.5;
        } else {
            // Page 1
            // Previous: 1.5. Let's try 2.0.
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

        // Page 2 Opacity Logic
        if (this.config.isComplex) {
            // Request 1: Don't lower opacity. Keep it 100%.
            // Removed transition logic. Just force 1.0.
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
        // Origin radius is approx config.originScale * config.radiusScale
        // Request 3: Smooth connection without thinning the whole line.
        // We restore thickness (2.5x) but need to handle protrusion.
        // We will taper the tip of the line so it fits into the origin.
        // We stop slightly inside the origin.
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


        // Optimization: Use pre-allocated typed arrays if possible, but here we calculate fresh.
        // To strictly follow "Optimize updateGeometry", we should minimize allocations.
        // However, the BufferAttribute.set usage below is good. 
        // We can optimize by not creating new arrays `positions` and `alphas` every time if we want,
        // but for now let's stick to the logic and ensure correctness first.

        // Actually, let's write directly to the buffer attributes to avoid intermediate array allocation.


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

                // Request: Smoother connection but not too thin.
                // We want to taper only near the connection point.
                // We calculate the taper start based on a fixed angle distance, not a percentage of t.

                // Calculate total angle length of the drawn line
                const totalAngle = Math.abs(start - effectiveEnd);

                // We want to start tapering a certain "distance" before the tip.
                // angleOffset corresponds to ~0.8 * originRadius.
                // Let's start tapering at ~2.5 * angleOffset (approx 2.0 * originRadius).
                // This ensures the taper starts before entering the origin.
                const taperAngle = angleOffset * 2.5;

                // Calculate t threshold
                // t goes from 0 to 1. 1 is at effectiveEnd.
                // The segment length is totalAngle.
                // We want the last taperAngle portion.
                // threshold = 1.0 - (taperAngle / totalAngle)
                let taperThreshold = 0.85; // Default fallback
                if (totalAngle > 0.001) {
                    taperThreshold = Math.max(0, 1.0 - (taperAngle / totalAngle));
                }

                let widthFactor = 0.5 + 0.5 * t * t; // Original profile (thickest at tip)

                if (this.config.isComplex && t > taperThreshold) {
                    // Taper down to 0.6 at t=1 (instead of 0.1)
                    // This keeps it thick enough to match the origin but thin enough to not stick out.
                    const taperRange = 1.0 - taperThreshold;
                    if (taperRange > 0.0001) {
                        const taperT = (t - taperThreshold) / taperRange; // 0 to 1
                        // Smooth taper from 1.0 to 0.6
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

        // Request 5: Delay disappearance slightly more.
        // We can add a small buffer to the tailDelay check.
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
