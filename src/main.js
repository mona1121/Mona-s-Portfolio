// === 1. IMPORTS ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import gsap from 'gsap';

// === 2. CONFIGURATION ===
const WIDE_SHOT_POS = { x: 11.97, y: 19.59, z: -26.95 };
const WIDE_SHOT_TARGET = { x: -0.95, y: 4.7, z: -2.39 };

const SIT_POS = { x: -3.4, y: 6.4, z: 3.27 }; 
const SIT_TARGET = { x: -3.44, y: 6.16, z: 4.22 };

const container = document.getElementById('canvas-container');
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('close-overlay');
const uiHint = document.getElementById('ui-hint');

// === 3. CORE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x111111, 0.015);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: 'high-performance' 
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
camera.position.set(WIDE_SHOT_POS.x, WIDE_SHOT_POS.y, WIDE_SHOT_POS.z);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.1;
controls.maxDistance = 100;
controls.target.set(WIDE_SHOT_TARGET.x, WIDE_SHOT_TARGET.y, WIDE_SHOT_TARGET.z);
controls.maxPolarAngle = Math.PI / 2 - 0.1;

RectAreaLightUniformsLib.init();

// === 4. LIGHTING ===
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.6); 
scene.add(hemiLight);

const monitorLight = new THREE.RectAreaLight(0xaaccff, 10, 1.5, 1.0);
monitorLight.position.set(0, 2.5, 0); 
monitorLight.lookAt(0, 0, 5);
scene.add(monitorLight);

// THE HERO SPOTLIGHT
const deskSpotlight = new THREE.SpotLight(0xffdca4, 0); // Start at 0, we set it in loader
deskSpotlight.angle = Math.PI / 3;
deskSpotlight.penumbra = 0.4;
deskSpotlight.decay = 2;
deskSpotlight.distance = 100;
deskSpotlight.castShadow = true;
deskSpotlight.shadow.bias = -0.0001;
// We create a dummy target object to ensure we can point it precisely
const spotlightTarget = new THREE.Object3D();
scene.add(deskSpotlight);
scene.add(spotlightTarget);
deskSpotlight.target = spotlightTarget; // Point light at this object

// Background Lights
const backLight1 = new THREE.PointLight(0xffaa55, 1, 20);
backLight1.position.set(8, 6, -8);
scene.add(backLight1);

const backLight2 = new THREE.PointLight(0xaaffaa, 1.0, 25);
backLight2.position.set(-10, 6, -5);
scene.add(backLight2);


// === 5. MODEL LOADING ===
let monitorMesh = null;
let targetDeskAnchor = null; // Defined here so it works!

const loader = new GLTFLoader();
loader.load('/assets/office.glb', (gltf) => {
    const deskRoot = gltf.scene;
    
    deskRoot.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // 1. Screen Glow Logic
            if (child.name.includes('Monitor_Screen')) {
                monitorMesh = child;
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x000000,
                    emissive: 0x0073df, // Deep Blue
                    emissiveIntensity: 4.0, // Stronger Glow
                    roughness: 0.2,
                    metalness: 0.5
                });
                
                // Snap RectAreaLight to screen
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                monitorLight.position.copy(worldPos);
                monitorLight.translateZ(0.2); 
            }
            // 2. Matte Material for everything else
            else {
                if(child.material) {
                    child.material.roughness = 0.9;
                    child.material.metalness = 0.1;
                }
            }
        }

        // 3. Find the Anchor Collection/Empty
        if (child.name.includes('Target_Desk')) {
            targetDeskAnchor = child;
        }
    });

    scene.add(deskRoot);

    // --- SPOTLIGHT FIX ---
    if (targetDeskAnchor) {
        // Calculate center of the desk group
        const box = new THREE.Box3().setFromObject(targetDeskAnchor);
        const center = box.getCenter(new THREE.Vector3());

        // Move the dummy target to the desk center
        spotlightTarget.position.copy(center);
        
        // Move the light 7 units above that center
        deskSpotlight.position.set(center.x, center.y + 7, center.z);
        
        // Turn it ON (High intensity because decay=2 fades fast)
        deskSpotlight.intensity = 200; 
    } else {
        console.warn("Could not find 'Target_Desk'. Check Blender naming!");
    }
    
    // Intro Animation
    gsap.from(camera.position, {
        y: 50,
        duration: 2,
        ease: "power3.out"
    });

}, undefined, (error) => {
    console.error('An error happened', error);
});


// === 6. INTERACTION ===
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerDown(event) {
    if(!controls.enabled) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object === monitorMesh || object.name.includes('Desk') || object.name.includes('Screen')) {
            moveToMonitor();
        }
    }
}
window.addEventListener('pointerdown', onPointerDown);

// === 7. ANIMATION FUNCTIONS ===
function moveToMonitor() {
    controls.enabled = false;
    gsap.to(camera.position, {
        x: SIT_POS.x, y: SIT_POS.y, z: SIT_POS.z,
        duration: 1.5, ease: "power2.inOut"
    });
    gsap.to(controls.target, {
        x: SIT_TARGET.x, y: SIT_TARGET.y, z: SIT_TARGET.z,
        duration: 1.5, ease: "power2.inOut",
        onUpdate: () => { camera.lookAt(controls.target); },
        onComplete: () => { openOverlay(); }
    });
}

function returnToOffice() {
    hideOverlay();
    gsap.to(camera.position, {
        x: WIDE_SHOT_POS.x, y: WIDE_SHOT_POS.y, z: WIDE_SHOT_POS.z,
        duration: 1.5, ease: "power2.inOut"
    });
    gsap.to(controls.target, {
        x: WIDE_SHOT_TARGET.x, y: WIDE_SHOT_TARGET.y, z: WIDE_SHOT_TARGET.z,
        duration: 1.5, ease: "power2.inOut",
        onUpdate: () => { camera.lookAt(controls.target); },
        onComplete: () => { controls.enabled = true; }
    });
}

// === 8. UI HELPERS ===
function openOverlay() {
    overlay.classList.remove('hidden');
    uiHint.style.opacity = 0;
    const iframe = document.getElementById('monitor-frame');
    if(iframe) iframe.focus();
}

function hideOverlay() {
    overlay.classList.add('hidden');
    uiHint.style.opacity = 1;
}

closeBtn.addEventListener('click', returnToOffice);

// === 9. MAIN LOOP ===
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
