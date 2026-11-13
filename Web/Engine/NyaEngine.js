// import { CSM } from "https://esm.sh/three@0.185.1/examples/jsm/csm/CSM.js";
// import { WebGPURenderer } from "https://esm.sh/three@0.185.1/webgpu.js";
// import * as CANNON from "https://esm.sh/cannon-es";
import * as THREE from "https://esm.sh/three@0.185.1";

let Scene = null;
let Camera = null;
let Renderer = null;
let Mouse = null;
let Orbit = null;
let Skybox = null;
let SkyScene = null;
let SkyCamera = null;

export function EngineInitialize() {
  Scene = new THREE.Scene();

  Camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  Renderer = new THREE.WebGLRenderer();
  Mouse = { X: 0, Y: 0 };

  SkyScene = new THREE.Scene();
  SkyCamera = new THREE.PerspectiveCamera(Camera.fov, Camera.aspect, 0.1, 1000);

  Orbit = {
    Target: new THREE.Vector3(0, 0, 0),
    Radius: 10,
    Theta: 0,
    Phi: Math.PI / 2,

    RotateSensitivity: 0.005,
    ZoomSensitivity: 0.1,
    PanSensitivity: 0.01,

    MinRadius: 1,
    MaxRadius: 100,

    MinPhi: 0.01,
    MaxPhi: Math.PI - 0.01,

    Button: -1,
  };
}

export function EngineLoad() {
  Renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(Renderer.domElement);

  const Loader = new THREE.TextureLoader();
  const SkyboxTexture = Loader.load("/Resources/Images/DefaultSkybox.png");
  SkyboxTexture.colorSpace = THREE.SRGBColorSpace;

  const Geometry = new THREE.SphereGeometry(500, 64, 64);
  const Material = new THREE.MeshBasicMaterial({
    map: SkyboxTexture,
    side: THREE.BackSide,
    depthWrite: false,
  });

  Skybox = new THREE.Mesh(Geometry, Material);
  SkyScene.add(Skybox);

  Renderer.domElement.addEventListener("contextmenu", (Event) => {
    Event.preventDefault();
  });

  Renderer.domElement.addEventListener("mousedown", (Event) => {
    Orbit.Button = Event.button;
    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;
  });

  window.addEventListener("mouseup", () => {
    Orbit.Button = -1;
  });

  window.addEventListener("mousemove", (Event) => {
    if (Orbit.Button === -1) return;

    const DeltaX = Event.clientX - Mouse.X;
    const DeltaY = Event.clientY - Mouse.Y;

    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;

    if (Orbit.Button === 0) {
      Orbit.Theta -= DeltaX * Orbit.RotateSensitivity;
      Orbit.Phi -= DeltaY * Orbit.RotateSensitivity;

      Orbit.Phi = THREE.MathUtils.clamp(Orbit.Phi, Orbit.MinPhi, Orbit.MaxPhi);
    }

    if (Orbit.Button === 2) {
      const Right = new THREE.Vector3();
      const Up = new THREE.Vector3();

      Camera.updateMatrixWorld();

      Right.setFromMatrixColumn(Camera.matrix, 0);
      Up.setFromMatrixColumn(Camera.matrix, 1);

      const PanSpeed = Orbit.Radius * Orbit.PanSensitivity;

      Orbit.Target.addScaledVector(Right, -DeltaX * PanSpeed);

      Orbit.Target.addScaledVector(Up, DeltaY * PanSpeed);
    }
  });

  Renderer.domElement.addEventListener("wheel", (Event) => {
    Orbit.Radius *= Math.exp(Event.deltaY * Orbit.ZoomSensitivity * 0.001);

    Orbit.Radius = THREE.MathUtils.clamp(
      Orbit.Radius,
      Orbit.MinRadius,
      Orbit.MaxRadius,
    );
  });
}

function EngineUpdateOrbit() {
  const SinPhi = Math.sin(Orbit.Phi);

  Camera.position.set(
    Orbit.Target.x + Orbit.Radius * SinPhi * Math.sin(Orbit.Theta),
    Orbit.Target.y + Orbit.Radius * Math.cos(Orbit.Phi),
    Orbit.Target.z + Orbit.Radius * SinPhi * Math.cos(Orbit.Theta),
  );

  Camera.lookAt(Orbit.Target);
}

function EngineRunAnimate() {
  EngineUpdateOrbit();

  SkyCamera.quaternion.copy(Camera.quaternion);
  SkyCamera.position.set(0, 0, 0);

  Renderer.autoClear = false;
  Renderer.clear();
  Renderer.render(SkyScene, SkyCamera);
  Renderer.clearDepth();
  Renderer.render(Scene, Camera);
}

export function EngineRun() {
  Renderer.setAnimationLoop(EngineRunAnimate);
}

function addStud(Width, Height, Depth, Color, X, Y, Z) {
  const Geometry = new THREE.BoxGeometry(Width, Height, Depth);
  const Material = new THREE.MeshBasicMaterial({ color: Color });

  const Mesh = new THREE.Mesh(Geometry, Material);
  Mesh.position.set(X, Y, Z);

  Scene.add(Mesh);
}

window.addStud = addStud;
