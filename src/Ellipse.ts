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

        const originScale = this.config.originScale || 0.13;
        if (this.config.isComplex) {
            // Page 2
            this.LINE_WIDTH = originScale * this.config.radiusScale * 1.2;
        } else {
            // Page 1
            this.LINE_WIDTH = originScale * this.config.radiusScale * 1.5;
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
            m.position.z = i * 0.002;
            m.rotation.z = (Math.random() - 0.5) * 0.05;
        });

        // Add origin
        container.add(originMesh);
        if (!this.config.isComplex) {
            originMesh.rotation.z = 0;
        } else {
            originMesh.rotation.z = Math.random() * Math.PI * 2;
        }
        originMesh.position.set(initialX, 0, 0.02);

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
        d.originMesh.position.set(tipX, tipY, 0.02);

        // Page 2 Opacity Logic
        if (this.config.isComplex) {
            const isDrawing = !d.finished && State.hasInteracted;
            const mat = d.originMesh.material as THREE.MeshStandardMaterial;
            mat.opacity = isDrawing ? 0.4 : 1.0;
        }

        // Visibility Check
        if (!State.hasInteracted || Math.abs(start - end) < 0.001) {
            d.meshes.forEach(m => m.visible = false);
            return;
        }
        d.meshes.forEach(m => m.visible = true);

        // Calculate offset to stop line before origin center
        // Origin radius is approx config.originScale * config.radiusScale
        // We want to stop roughly 0.6 * originRadius before the center to be safe but connected
        const originRadius = (this.config.originScale || 0.13) * this.config.radiusScale;
        const currentRadius = Math.sqrt(tipX * tipX + tipY * tipY);
        // Angle offset = arcLength / radius. 
        // We use a factor (e.g. 0.5) to go halfway into the origin or just to the edge.
        // Request 2: "Ellipse drawing tip is visible through the origin... smooth connection"
        // If origin is opaque, we don't see it. If transparent, we see it.
        // Page 2 origin is transparent (opacity 1.0 but maybe alpha map? No, just opacity).
        // Wait, if opacity is 1.0, it's opaque.
        // But user said "visible through the origin".
        // Maybe the origin is small or the line is thick?
        // Let's offset by a fraction of the origin radius.
        // Request 4: Ellipse tip visible through origin... stop drawing where it overlaps.
        // Since origin is transparent, we must stop AT the edge of the origin.
        // Origin radius is approx originScale * radiusScale.
        // We use a factor of 1.0 to stop exactly at the edge (or slightly more to be safe).
        const angleOffset = (originRadius * 1.05) / (currentRadius || 1);

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
                const halfWidth = maxHalfWidth * (0.5 + 0.5 * t * t);

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
