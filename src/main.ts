import './style.css'
import * as THREE from 'three';

import { State, Mode } from './State';
import { EllipseSet } from './EllipseSet';
import { randomizeShapeConditions } from './Utils';

/**
 * ============================================================================
 * MAIN INITIALIZATION
 * ============================================================================
 */
function initEllipseAnimation() {

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

            if (State.currentMode === Mode.PAGE1) {
                State.currentMode = Mode.PAGE2;
                setPage1.setVisible(false);
                setPage2.setVisible(true);
            } else {
                State.currentMode = Mode.PAGE1;
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
        if (State.currentMode === Mode.PAGE1) {
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

initEllipseAnimation();
