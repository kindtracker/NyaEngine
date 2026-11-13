import { CSM } from "https://esm.sh/three@0.185.1/examples/jsm/csm/CSM.js";
import { WebGPURenderer } from "https://esm.sh/three@0.185.1/webgpu.js";
import * as THREE from "https://esm.sh/three@0.185.1";
import * as CANNON from "https://esm.sh/cannon-es";

let Scene = null;
let Camera = null;
let Renderer = null;

export function EngineInitialize() {
  Scene = new THREE.Scene();
  Camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  Renderer = new THREE.WebGLRenderer();
}

export function EngineLoad() {
  Renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(Renderer.domElement);

  const Loader = new THREE.TextureLoader();
  const SkyboxTexture = Loader.load("/Resources/Images/DefaultSkybox.png");
  SkyboxTexture.colorSpace = THREE.SRGBColorSpace;
  Scene.background = SkyboxTexture;
}

function EngineRunAnimate() {
  Renderer.render(Scene, Camera);
}

export function EngineRun() {
  Renderer.setAnimationLoop(EngineRunAnimate);
}

function addStud(X, Y, Z, Color, Width, Height, Depth) {
  const Geometry = new THREE.BoxGeometry(Width, Height, Depth);
  const Material = new THREE.MeshBasicMaterial({ color: Color });
  const Mesh = new THREE.Mesh(Geometry, Material);
  Mesh.position.set(X, Y, Z);
  Scene.add(Mesh);
}

window.addStud = addStud;
