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
        this.LINE_WIDTH = 0.2 * config.radiusScale;

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
        const angleOffset = (originRadius * 0.5) / (currentRadius || 1);

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

        if ((d.startAngle - d.currentEndAngle) > d.tailDelay || d.currentEndAngle === d.targetEndAngle) {
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
}
