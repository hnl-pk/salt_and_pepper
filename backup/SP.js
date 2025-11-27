import * as THREE from 'three';

//CONSTANTS & CONFIGURATION
const CONFIG = {
    CYCLE_INTERVAL: 1.2,
    UNIFIED_DRAW_SPEED: 1.0,
    UNIFIED_TAIL_DELAY: 2 * Math.PI * 0.85,
    COLORS: [
        0x3b2e2a, // Dark brown close to black
        0x1a261c, // Greenish black (Deep Greenish Black)
        0xd4c5a7  // Beige (Pepper Beige)
    ]
};

const MODE = { PAGE1: 'PAGE1', PAGE2: 'PAGE2' };

//SHADERS
const SHADERS = {
    line: {
        vertex: `
            attribute float alpha;
            attribute float side;
            attribute float progress;
            varying float vAlpha;
            varying float vSide;
            varying float vProgress;
            void main() {
                vAlpha = alpha;
                vSide = side;
                vProgress = progress;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment: `
            uniform vec3 color;
            uniform float opacityMultiplier;
            varying float vAlpha;
            varying float vSide;
            varying float vProgress;

            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            void main() {
                float noise1 = rand(vec2(vSide * 0.5, vProgress * 20.0));
                float layer1 = 0.5 + 0.5 * sin(vSide * 2.0 + noise1 * 2.0);
                
                float noise2 = rand(vec2(vSide * 5.0, vProgress * 100.0));
                float layer2 = 0.5 + 0.5 * sin(vSide * 10.0 + noise2 * 5.0);
                
                float combined = mix(layer1, layer2, 0.3);
                
                float intensity = 0.8 + 0.4 * rand(vec2(vProgress * 10.0, 0.0));
                
                float finalAlpha = vAlpha * opacityMultiplier; 
                if (finalAlpha > 1.0) finalAlpha = 1.0;
                
                gl_FragColor = vec4(color, finalAlpha * pow(combined, 0.8) * intensity);
            }
        `
    }
};

//GLOBAL STATE & MATERIALS

// Animation State
const State = {
    currentMode: MODE.PAGE1,
    modeTimer: 0,
    nextModeSwitchDuration: 5 + Math.random() * 5, // Min 5s
    modeSwitchCount: 0,

    isBlurred: true,
    blurTimer: 0,
    nextBlurSwitchDuration: 5 + Math.random() * 5,

    hasInteracted: false,

    interactionTarget: {
        xRadius: 1.0,
        yRadius: 0.5,
        rotation: 6
    },

    drift: {
        time: 0,
        speed: 0.5,
        amplitude: 0.05,
        sizeVarAmp: 0.3,
        curveVarAmp: 0.3
    }
};

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

const originMaterials = CONFIG.COLORS.map(color => new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.4,
    metalness: 0.3,
    flatShading: false
}));

//HELPER FUNCTIONS

function createParticleGeometry(baseRadius) {
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

function randomizeShapeConditions() {
    State.drift.speed = 0.2 + Math.random() * 1.0;
    State.drift.amplitude = 0.02 + Math.random() * 0.15;
    State.drift.sizeVarAmp = 0.1 + Math.random() * 0.4;
    State.drift.curveVarAmp = 0.1 + Math.random() * 0.4;

    if (Math.random() > 0.5) State.drift.speed *= -1;
}

/**
 * ============================================================================
 * CLASS: EllipseSet
 * ============================================================================
 */
class EllipseSet {
    constructor(scene, config) {
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

    createEllipse() {
        const colorIndex = Math.floor(Math.random() * CONFIG.COLORS.length);

        const numLayers = this.config.isComplex ? 3 : 1;
        const meshes = [];

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
            const indices = [];

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
        let particleGeo;
        if (this.sharedParticleGeo) {
            particleGeo = this.sharedParticleGeo;
        } else {
            const originScaleFactor = this.config.originScale || 0.13;
            particleGeo = createParticleGeometry(originScaleFactor * this.config.radiusScale);
        }

        const originMesh = new THREE.Mesh(particleGeo, originMaterials[colorIndex]);

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

        const ellipseData = {
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

    updateGeometry(ellipseData) {
        const start = ellipseData.currentStartAngle;
        const end = ellipseData.currentEndAngle;
        const a = ellipseData.xRadius;
        const b = ellipseData.yRadius;

        const tipX = a * Math.cos(end);
        const tipY = b * Math.sin(end);

        ellipseData.originMesh.position.set(tipX, tipY, 0.02);

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

        const positions = [];
        const alphas = [];

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

    resetDrawingParams(e) {
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

    update(dt) {
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

    setVisible(visible) {
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

/**
 * ============================================================================
 * MAIN INITIALIZATION
 * ============================================================================
 */
export function initEllipseAnimation() {

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClearColor = false;
    document.body.appendChild(renderer.domElement);

    const fadeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.05
    });
    const fadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), fadeMaterial);
    fadeMesh.position.z = -1;
    camera.add(fadeMesh);
    scene.add(camera);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- 2. Initialize Sets ---
    const setPage1 = new EllipseSet(scene, {
        count: 100,
        radiusScale: 1.0,
        isCentered: false,
        segments: 32,
        hasShadow: false,
        originScale: 0.13,
        opacityMultiplier: 2.0
    });

    const setPage2 = new EllipseSet(scene, {
        count: 1,
        radiusScale: 9.0,
        isCentered: true,
        segments: 256,
        hasShadow: false,
        originScale: 0.13 * 0.7,
        isComplex: true,
        opacityMultiplier: 3.0
    });

    setPage1.setVisible(true);
    setPage2.setVisible(false);

    // --- 3. Animation Loop ---
    const clock = new THREE.Clock();
    const blurOverlay = document.getElementById('blur-overlay');
    if (blurOverlay) blurOverlay.style.opacity = '1';

    function animate() {
        requestAnimationFrame(animate);

        const dt = clock.getElapsedTime();

        // --- Mode Switching ---
        State.modeTimer += 0.016;
        if (State.modeTimer > State.nextModeSwitchDuration) {
            State.modeTimer = 0;
            State.nextModeSwitchDuration = 5 + Math.random() * 5;

            if (State.currentMode === MODE.PAGE1) {
                State.currentMode = MODE.PAGE2;
                setPage1.setVisible(false);
                setPage2.setVisible(true);
            } else {
                State.currentMode = MODE.PAGE1;
                setPage2.setVisible(false);
                setPage1.setVisible(true);
            }

            State.modeSwitchCount++;
            if (State.modeSwitchCount >= 3) {
                if (Math.random() < 0.3) {
                    randomizeShapeConditions();
                }
            }
        }

        // --- Blur Switching ---
        State.blurTimer += 0.016;
        if (State.blurTimer > State.nextBlurSwitchDuration) {
            State.blurTimer = 0;
            State.nextBlurSwitchDuration = 5 + Math.random() * 5;

            State.isBlurred = !State.isBlurred;
            if (blurOverlay) {
                blurOverlay.style.opacity = State.isBlurred ? '1' : '0';
            }
        }

        let isAnyAnimating = false;
        if (State.currentMode === MODE.PAGE1) {
            isAnyAnimating = setPage1.update(dt);
        } else {
            isAnyAnimating = setPage2.update(dt);
        }

        fadeMesh.visible = isAnyAnimating;
        renderer.render(scene, camera);
    }

    animate();

    // --- 4. Event Listeners ---
    window.addEventListener('pointerdown', () => {
        State.hasInteracted = true;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
