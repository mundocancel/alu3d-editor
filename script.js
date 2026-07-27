// script.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- ESTADO DE LA APLICACIÓN ---
const state = {
    elements: [],        // { id, name, type, color, width, height, depth, mesh }
    selectedId: null,
    nextId: 1
};

// --- REFERENCIAS A UI ---
const container = document.getElementById('canvas-container');
const editName = document.getElementById('edit-name');
const editType = document.getElementById('edit-type');
const editColor = document.getElementById('edit-color');
const editWidth = document.getElementById('edit-width');
const editHeight = document.getElementById('edit-height');
const editDepth = document.getElementById('edit-depth');

// --- INICIALIZACIÓN DE ESCENA 3D ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Cámara
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(5, 4, 8);
camera.lookAt(0, 0, 0);

// Renderizador con antialiasing y tono PBR
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// Controles
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = false;
controls.target.set(0, 0.5, 0);

// --- ILUMINACIÓN (PBR) ---
// Luz ambiental suave
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);

// Luz principal con sombras
const mainLight = new THREE.DirectionalLight(0xffeedd, 2);
mainLight.position.set(5, 8, 3);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
scene.add(mainLight);

// Luz de relleno
const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
fillLight.position.set(-3, 1, 4);
scene.add(fillLight);

// Luz trasera para resaltar bordes
const backLight = new THREE.DirectionalLight(0xffaa66, 0.3);
backLight.position.set(0, 2, -6);
scene.add(backLight);

// --- PLANO DE APOYO (suelo) ---
const gridHelper = new THREE.GridHelper(10, 20, 0x8888ff, 0x444466);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

const planeGeometry = new THREE.PlaneGeometry(10, 10);
const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.4 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0;
plane.receiveShadow = true;
scene.add(plane);

// --- FUNCIONES CRUD DE ELEMENTOS ---

function createElementMesh(type, color, width, height, depth) {
    let geometry;
    switch(type) {
        case 'sphere': geometry = new THREE.SphereGeometry(width/2, 32, 32); break;
        case 'cylinder': geometry = new THREE.CylinderGeometry(width/2, width/2, height, 32); break;
        case 'box':
        default: geometry = new THREE.BoxGeometry(width, height, depth);
    }
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.1,
        envMapIntensity: 0.6,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, height/2, 0);
    return mesh;
}

function addElement(name, type, color, width, height, depth) {
    const id = state.nextId++;
    const mesh = createElementMesh(type, color, width, height, depth);
    scene.add(mesh);
    
    const element = { id, name, type, color, width, height, depth, mesh };
    state.elements.push(element);
    renderList();
    selectElement(id);
    return element;
}

function deleteElement(id) {
    const index = state.elements.findIndex(el => el.id === id);
    if (index === -1) return;
    const element = state.elements[index];
    scene.remove(element.mesh);
    // Limpiar recursos de Three.js
    element.mesh.geometry.dispose();
    element.mesh.material.dispose();
    state.elements.splice(index, 1);
    if (state.selectedId === id) {
        state.selectedId = null;
        clearEditorFields();
    }
    renderList();
}

function updateElement(id, data) {
    const element = state.elements.find(el => el.id === id);
    if (!element) return;
    
    // Actualizar propiedades
    Object.assign(element, data);
    
    // Reconstruir el mesh
    const newMesh = createElementMesh(element.type, element.color, element.width, element.height, element.depth);
    newMesh.position.copy(element.mesh.position);
    newMesh.rotation.copy(element.mesh.rotation);
    newMesh.scale.copy(element.mesh.scale);
    
    scene.remove(element.mesh);
    element.mesh.geometry.dispose();
    element.mesh.material.dispose();
    element.mesh = newMesh;
    scene.add(newMesh);
    
    renderList();
    if (state.selectedId === id) loadElementToEditor(id);
}

function getElement(id) {
    return state.elements.find(el => el.id === id);
}

// --- FUNCIONES DE UI ---

function renderList() {
    (document.getElementById('items-container')).innerHTML = '';
    state.elements.forEach(el => {
        const li = document.createElement('li');
        li.textContent = el.name;
        li.dataset.id = el.id;
        if (el.id === state.selectedId) li.classList.add('active');
        li.addEventListener('click', () => selectElement(el.id));
        
        // Pequeña muestra de color
        const colorDot = document.createElement('span');
        colorDot.style.display = 'inline-block';
        colorDot.style.width = '12px';
        colorDot.style.height = '12px';
        colorDot.style.borderRadius = '50%';
        colorDot.style.backgroundColor = el.color;
        colorDot.style.marginLeft = '8px';
        li.appendChild(colorDot);
        
        (document.getElementById('items-container')).appendChild(li);
    });
}

function selectElement(id) {
    state.selectedId = id;
    renderList();
    if (id) {
        loadElementToEditor(id);
    } else {
        clearEditorFields();
    }
}

function loadElementToEditor(id) {
    const el = getElement(id);
    if (!el) return;
    editName.value = el.name;
    editType.value = el.type;
    editColor.value = el.color;
    editWidth.value = el.width;
    editHeight.value = el.height;
    editDepth.value = el.depth;
}

function clearEditorFields() {
    editName.value = '';
    editType.value = 'box';
    editColor.value = '#ff5722';
    editWidth.value = '1.5';
    editHeight.value = '1.5';
    editDepth.value = '1.5';
}

// --- EVENTOS DE UI ---

// Añadir elemento
document.getElementById('add-btn').addEventListener('click', () => {
    const name = prompt('Nombre del elemento:', `Elemento ${state.elements.length+1}`);
    if (!name) return;
    addElement(
        name,
        'box',
        '#ff5722',
        parseFloat(editWidth.value),
        parseFloat(editHeight.value),
        parseFloat(editDepth.value)
    );
});

// Guardar cambios
document.getElementById('save-btn').addEventListener('click', () => {
    if (state.selectedId === null) {
        alert('Selecciona un elemento para guardar');
        return;
    }
    updateElement(state.selectedId, {
        name: editName.value || 'Sin nombre',
        type: editType.value,
        color: editColor.value,
        width: parseFloat(editWidth.value),
        height: parseFloat(editHeight.value),
        depth: parseFloat(editDepth.value),
    });
});

// Eliminar elemento
document.getElementById('delete-btn').addEventListener('click', () => {
    if (state.selectedId === null) {
        alert('Selecciona un elemento para eliminar');
        return;
    }
    if (confirm('¿Eliminar este elemento?')) {
        deleteElement(state.selectedId);
    }
});

// --- INICIALIZAR CON ELEMENTOS DE EJEMPLO ---
addElement('Base', 'box', '#4a6fa5', 2.0, 0.4, 2.0);
addElement('Columna', 'cylinder', '#b0b0b0', 0.6, 1.8, 0.6);
addElement('Tope', 'sphere', '#ff5722', 0.8, 0.8, 0.8);
selectElement(1);

// --- ANIMACIÓN Y BUCLE ---
let frameCount = 0;
let lastFpsUpdate = performance.now();

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    renderer.render(scene, camera);
    
    // Contador de FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        document.getElementById('fps-counter').textContent = `${frameCount} FPS`;
        frameCount = 0;
        lastFpsUpdate = now;
    }
}
animate();

// --- RESPONSIVE ---
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
