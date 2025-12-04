// === 1. IMPORTS ===
// Get the main Three.js library
import * as THREE from 'three';
// Get the loader for GLB/GLTF 3D model files
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Get the camera controls (orbit, zoom, pan)
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Get the GSAP animation library (for smooth camera moves, glows, etc.)
import gsap from 'gsap';


// --- Store our two camera shots ---
const WIDE_SHOT_POS = { x: 8.5, y: 23, z: -36 }; // <-- YOUR wide shot position
const WIDE_SHOT_TARGET = { x: 6.5, y: 2.4, z: -2.2 }; // <-- YOUR wide shot target

// === 2. HTML ELEMENT GRABBERS ===
// Find the <div> where the 3D canvas will live
const container = document.getElementById('canvas-container');
// Find the hidden <div> for the portfolio overlay
const overlay = document.getElementById('overlay');
// Find the 'X' button inside the overlay
const closeBtn = document.getElementById('close-overlay');
// Find the text hint at the bottom
const uiHint = document.getElementById('ui-hint');

// === 3. CORE THREE.JS SETUP ===
// The Scene is the "world" that holds all your objects
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1720); // Set dark blue background

// The Renderer "draws" the scene onto the screen
const renderer = new THREE.WebGLRenderer({ 
    antialias: true, // Makes edges smoother
    powerPreference: 'high-performance' // Asks browser to use the good GPU
});
// Don't render at 8K if the user has a 4K screen. Max 2x pixel ratio.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Make the renderer's canvas fill its container <div>
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true; // We want shadows!
// Add the <canvas> element (created by the renderer) to our HTML page
container.appendChild(renderer.domElement);

// The Camera is your "eye" in the world
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
camera.position.set(WIDE_SHOT_POS.x, WIDE_SHOT_POS.y, WIDE_SHOT_POS.z);

// === 4. CAMERA CONTROLS ===
// Lets you drag to orbit, scroll to zoom
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Adds a smooth "coasting" effect
controls.dampingFactor = 0.1;
controls.minDistance = 0.1; // How close you can zoom in
controls.maxDistance = 100; // How far you can zoom out
controls.target.set(WIDE_SHOT_TARGET.x, WIDE_SHOT_TARGET.y, WIDE_SHOT_TARGET.z); // What the camera "looks at"
controls.update(); // Must be called after changing target/position

window.myCamera = camera;
window.myControls = controls;

// === 5. LIGHTING ===
// HemisphereLight: A cheap, "sky" light. (Sky color, ground color, intensity)
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
scene.add(hemi);

// DirectionalLight: Acts like the "sun".
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 10, 7); // Position it up and to the side
dir.castShadow = true; // This light will create shadows
dir.shadow.camera.near = 0.5; // Finetuning for shadow quality
dir.shadow.camera.far = 50;
scene.add(dir);

// AmbientLight: A subtle "fill" light that hits everything equally
const ambient = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambient);

// === 6. FLOOR ===
// A simple flat plane to receive shadows
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 1 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
floor.rotation.x = -Math.PI / 2; // Rotate it to be flat
floor.position.y = 0;
floor.receiveShadow = true; // This object will have shadows cast ON it
scene.add(floor);

// === 7. MODEL LOADING ===
// Variables to hold our model parts
let monitorMesh = null; // The clickable screen
let deskRoot = null; // The whole desk model

// Initialize the GLB file loader
const loader = new GLTFLoader();
const glbPath = '/assets/office.glb'; // This path is correct!

loader.load(
  glbPath,
  // 1. OnSuccess callback (runs when model is loaded)
  (gltf) => {
    deskRoot = gltf.scene; // The 'scene' property holds the 3D objects
    // Go through every part of the model (traverse)
    deskRoot.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true; // Make every part of the desk cast a shadow
        c.receiveShadow = true; // And receive shadows
      }
    });

    // --- Smart Monitor-Finding Logic ---
    // Try to find the screen by its exact name from Blender
    monitorMesh = deskRoot.getObjectByName('monitor_screen') || deskRoot.getObjectByName('monitor') || deskRoot.getObjectByName('screen');
    
    // Find your specific clickable screen by its exact Blender name
    monitorMesh = deskRoot.getObjectByName('Screen_Plane_clickable');

    // Add a check so you know if it worked
    if (!monitorMesh) {
      console.error('CRITICAL: Could not find object named "Screen_Plane_clickable" in the model!');
    }

    scene.add(deskRoot); // Add the fully loaded desk to the world

    // --- Pulsing Glow Effect (using GSAP) ---
    // This makes the monitor "pulse" to show it's clickable
    if (monitorMesh && monitorMesh.material && !Array.isArray(monitorMesh.material)) {
      gsap.to(monitorMesh.material.color, { 
          r: 0.3, g: 0.35, b: 0.75, // Target color
          duration: 1.2, // seconds
          yoyo: true, // Animate back and forth
          repeat: -1, // Repeat forever
          ease: 'sine.inOut' // Smooth animation curve
      });
    }
  },
  // 2. OnProgress callback (optional)
  (xhr) => {
    // console.log('Model progress', xhr.loaded / xhr.total);
  },
  // 3. OnError callback (runs if model fails to load)
  (err) => {
    console.warn('GLB load failed, building procedural desk instead. Error:', err);
    buildProceduralDesk(); // Run the fallback function
  }
);

// --- Fallback Desk (if GLB fails) ---
// This function builds a desk from simple shapes (boxes, planes)
// This is amazing for development, so the app *never* crashes.
function buildProceduralDesk() {
  // ... (all the code to build a desk from scratch) ...
  // This code is complex but is just creating materials and geometries
  // and positioning them, just like the floor plane.
  // The important part is it also creates a "monitorMesh".
  deskRoot = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.05 });
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.2), topMat);
  deskTop.position.set(0, 1, 0);
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskRoot.add(deskTop);
  // ... (rest of the procedural desk code) ...
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x08102b, emissive: 0x001122, roughness: 0.3 });
  monitorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), screenMat);
  monitorMesh.name = 'monitor_screen';
  monitorMesh.position.set(0, 1.5, -0.22);
  deskRoot.add(monitorMesh);
  scene.add(deskRoot);
}

// === 8. INTERACTIVITY (CLICK DETECTION) ===
// Raycasting is like shooting a "laser" from the camera through the mouse
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(); // Stores mouse X, Y coords (-1 to +1)

function onPointerDown(e) {
  // Get the size of the canvas on the page
  const rect = renderer.domElement.getBoundingClientRect();
  // Calculate the mouse position relative to the canvas
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Update the "laser" to point from the camera through the mouse
  raycaster.setFromCamera(pointer, camera);

  // Get a list of all objects the "laser" hit
  const intersects = raycaster.intersectObjects(scene.children, true); // 'true' means check inside models

  if (intersects.length > 0) {
    const picked = intersects[0].object;
    if (monitorMesh && (picked === monitorMesh || picked.uuid === monitorMesh.uuid || picked.name.toLowerCase().includes('monitor') || picked.name.toLowerCase().includes('screen'))) {
      // openOverlay(); // <-- NO LONGER CALLED HERE
      focusOnMonitor(); // <-- Just fly the camera
    }
  }
}
// Listen for 'pointerdown' (click or tap) on the 3D canvas
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// === 9. HELPER FUNCTIONS ===
// Camera "fly-to" animation
function focusOnMonitor() {
  if (!monitorMesh) return;

  // --- GET THE NEW "SITTING" POV COORDS ---
  const SIT_POS = { x: -3.4, y: 6.4, z: 3.27 }; 
  const SIT_TARGET = { x: -3.44, y: 6.16, z: 4.22 };
  
  // We don't need the old logic, we're setting the exact position
  const targetPos = new THREE.Vector3(SIT_POS.x, SIT_POS.y, SIT_POS.z);
  const targetLookAt = new THREE.Vector3(SIT_TARGET.x, SIT_TARGET.y, SIT_TARGET.z);
  
  controls.enabled = false; // Disable controls *before* flying

  gsap.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    duration: 1.2, // A little longer
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.lookAt(targetLookAt);
    },
    onComplete: () => {
      // --- CALLED *AFTER* ANIMATION FINISHES ---
      openOverlay();
    }
  });
}

// Show the overlay
function openOverlay() {
  overlay.classList.remove('hidden'); // Remove the .hidden CSS class
  uiHint.style.display = 'none'; // Hide the text hint
  controls.enabled = false; // Disable camera controls so you can't orbit
  const iframe = document.getElementById('monitor-frame');
  iframe.focus(); // Put keyboard focus inside the iframe (good for accessibility)
}

// Close the overlay (triggered by the 'X' button)
closeBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  uiHint.style.display = 'block';
  
  // Animate camera back to the saved WIDE_SHOT variables
  gsap.to(camera.position, {
    x: WIDE_SHOT_POS.x,
    y: WIDE_SHOT_POS.y,
    z: WIDE_SHOT_POS.z,
    duration: 1.0,
    ease: 'power3.inOut',
    onUpdate: () => camera.lookAt(WIDE_SHOT_TARGET.x, WIDE_SHOT_TARGET.y, WIDE_SHOT_TARGET.z),
    onComplete: () => {
      controls.enabled = true; // Re-enable controls *after* flying back
    }
  });
});

// Allow closing the overlay with the "Escape" key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
    closeBtn.click(); // Just "click" the close button programmatically
  }
});

// === 10. IDLE ANIMATION ===
// Gently orbit the camera if the user is idle
let idleTime = 0;
function updateControlsIdle(dt) { // 'dt' is "delta time" - time since last frame
  if (!controls.enabled) return; // Don't orbit if overlay is open
  idleTime += dt;
  
  if (idleTime > 1.5) { // After 1.5 seconds of no interaction
    // Use time to slowly move camera in a circle
    const t = performance.now() * 0.00008;
    camera.position.x = Math.sin(t) * 6;
    camera.position.z = Math.cos(t) * 6;
    camera.lookAt(0, 1, 0); // Keep looking at the center
  }
}
// Reset idle timer when user interacts
controls.addEventListener('start', () => { idleTime = 0; });


// === 11. THE "GAME LOOP" ===
// This function runs 60 times per second
// rendering loop
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  // Only update controls if they are enabled!
  if (controls.enabled) {
    controls.update(); // <-- NOW IT'S SAFE
  }
  
  renderer.render(scene, camera);
}
animate(); // Start the loop!

// === 12. WINDOW RESIZE HANDLER ===
// This makes sure the 3D scene resizes cleanly when you resize the browser
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h; // Update camera's aspect ratio
  camera.updateProjectionMatrix(); // Apply the change
  renderer.setSize(w, h); // Resize the renderer's canvas
});