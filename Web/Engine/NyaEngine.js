// import * as CANNON from "https://esm.sh/cannon-es";
// import { CSM } from "https://esm.sh/three@0.185.1/examples/jsm/csm/CSM.js";
// import { WebGPURenderer } from "https://esm.sh/three@0.185.1/webgpu.js";
import { FBXLoader } from "https://esm.sh/three@0.185.1/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "https://esm.sh/three@0.185.1";

let Scene = null;
let Camera = null;
let Renderer = null;
let SkyScene = null;
let SkyCamera = null;
let Skybox = null;
let Character = null;
let SpawnLocation = null;
let Keyboard = null;
let Mouse = null;
let Orbit = null;

const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 5;
const GRAITY = -196.2;

export function EngineInitialize() {
  Scene = new THREE.Scene();

  Camera = new THREE.PerspectiveCamera(
    85,
    window.innerWidth / window.innerHeight,
    0.1,
    5000,
  );

  Renderer = new THREE.WebGLRenderer({
    antialias: true,
  });

  Renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  Renderer.setSize(window.innerWidth, window.innerHeight);

  Mouse = {
    X: 0,
    Y: 0,
  };

  Keyboard = {};

  SkyScene = new THREE.Scene();

  SkyCamera = new THREE.PerspectiveCamera(
    Camera.fov,
    Camera.aspect,
    Camera.near,
    Camera.far,
  );

  Orbit = {
    Target: new THREE.Vector3(),
    Radius: 25.6,
    Theta: 0,
    Phi: Math.PI / 2,
    RotateSensitivity: 0.005,
    ZoomSensitivity: 0.001,
    MinRadius: 2,
    MaxRadius: 512,
    MinPhi: 0.01,
    MaxPhi: Math.PI - 0.01,
    Button: -1,
  };

  Character = {
    Model: null,
    Physics: null,
    Position: new THREE.Vector3(),
    Speed: 50,
    IsLoaded: false,
  };
}

export function EngineLoad() {
  document.body.appendChild(Renderer.domElement);

  EngineLoadSkybox();
  EngineLoadCharacterModel();
  EngineInitializeInput();

  window.addEventListener("resize", EngineResize);
}

function EngineLoadSkybox() {
  const Loader = new THREE.TextureLoader();
  const Texture = Loader.load(
    "/Resources/Images/DefaultSkybox.png",
    undefined,
    undefined,
    (Error) => {
      console.error("Failed to load skybox:", Error);
    },
  );
  Texture.colorSpace = THREE.SRGBColorSpace;

  const Geometry = new THREE.SphereGeometry(500, 64, 64);
  const Material = new THREE.MeshBasicMaterial({
    map: Texture,
    side: THREE.BackSide,
    depthWrite: false,
  });

  Skybox = new THREE.Mesh(Geometry, Material);
  SkyScene.add(Skybox);
}

function EngineLoadCharacterModel() {
  const Loader = new FBXLoader();

  Loader.load(
    "/Resources/Models/R6.fbx",

    (FBX) => {
      if (Character.Model) {
        Scene.remove(Character.Model);
      }

      Character.Model = FBX;
      Character.Model.position.set(0, 0, 0);
      Character.Model.updateMatrixWorld(true);

      Scene.add(Character.Model);
    },

    undefined,

    (Error) => {
      console.error("Failed to load character model:", Error);
    },
  );
}

function EngineUpdateCharacter() {}

function EngineSyncCharacter() {}

function EngineUpdateOrbit() {
  if (!Character) return;

  Orbit.Target.copy(Character.Position);
  Orbit.Target.y += 2.56;

  const SinPhi = Math.sin(Orbit.Phi);
  Camera.position.set(
    Orbit.Target.x + Orbit.Radius * SinPhi * Math.sin(Orbit.Theta),
    Orbit.Target.y + Orbit.Radius * Math.cos(Orbit.Phi),
    Orbit.Target.z + Orbit.Radius * SinPhi * Math.cos(Orbit.Theta),
  );

  Camera.lookAt(Orbit.Target);
}

function EngineInitializeInput() {
  const Element = Renderer.domElement;

  Element.addEventListener("contextmenu", (Event) => {
    Event.preventDefault();
  });

  Element.addEventListener("mousedown", (Event) => {
    Orbit.Button = Event.button;

    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;
  });

  Element.addEventListener("wheel", (Event) => {
    Orbit.Radius *= Math.exp(Event.deltaY * Orbit.ZoomSensitivity);

    Orbit.Radius = THREE.MathUtils.clamp(
      Orbit.Radius,
      Orbit.MinRadius,
      Orbit.MaxRadius,
    );
  });

  window.addEventListener("mouseup", () => {
    Orbit.Button = -1;
  });

  window.addEventListener("mousemove", (Event) => {
    if (Orbit.Button !== 2) return;

    const DeltaX = Event.clientX - Mouse.X;
    const DeltaY = Event.clientY - Mouse.Y;

    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;

    Orbit.Theta -= DeltaX * Orbit.RotateSensitivity;

    Orbit.Phi -= DeltaY * Orbit.RotateSensitivity;

    Orbit.Phi = THREE.MathUtils.clamp(Orbit.Phi, Orbit.MinPhi, Orbit.MaxPhi);
  });

  window.addEventListener("keydown", (Event) => {
    Keyboard[Event.code] = true;
  });

  window.addEventListener("keyup", (Event) => {
    Keyboard[Event.code] = false;
  });

  window.addEventListener("blur", () => {
    Keyboard = {};
    Orbit.Button = -1;
  });
}

function EngineResize() {
  if (!Camera || !Renderer) return;

  Camera.aspect = window.innerWidth / window.innerHeight;
  Camera.updateProjectionMatrix();
  SkyCamera.aspect = Camera.aspect;
  SkyCamera.updateProjectionMatrix();
  Renderer.setSize(window.innerWidth, window.innerHeight);
}

function EngineRunAnimate() {
  EngineUpdateCharacter();
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

export function EngineStop() {
  if (!Renderer) return;

  Renderer.setAnimationLoop(null);
}

export function EngineLoadProject(Project) {
  if (typeof Project === "string") {
    Project = JSON.parse(Project);
  }

  for (const Instance of Project) {
    if (Instance.Type !== "Part" && Instance.Type !== "SpawnLocation") {
      console.warn(`Unknown instance: ${Instance.Type}`);

      continue;
    }

    const [X, Y, Z] = Instance.Position;
    const [RX, RY, RZ] = Instance.Rotation.map((Angle) =>
      THREE.MathUtils.degToRad(Angle),
    );
    const [Width, Height, Depth] = Instance.Size;
    const Color = parseInt(Instance.Color, 16);
    const Part = addStud(Width, Height, Depth, Color, X, Y, Z, RX, RY, RZ);

    if (Instance.Type === "SpawnLocation") {
      SpawnLocation = Part;
    }
  }
}

function addStud(Width, Height, Depth, Color, X, Y, Z, RX = 0, RY = 0, RZ = 0) {
  const Geometry = new THREE.BoxGeometry(Width, Height, Depth);
  const Material = new THREE.MeshBasicMaterial({
    color: Color,
  });

  const Mesh = new THREE.Mesh(Geometry, Material);
  Mesh.position.set(X, Y, Z);
  Mesh.rotation.order = "XYZ";
  Mesh.rotation.set(RX, RY, RZ);
  Mesh.castShadow = true;
  Mesh.receiveShadow = true;
  Scene.add(Mesh);
  return Mesh;
}

window.addStud = addStud;
