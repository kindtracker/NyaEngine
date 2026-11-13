// import { CSM } from "https://esm.sh/three@0.185.1/examples/jsm/csm/CSM.js";
// import { WebGPURenderer } from "https://esm.sh/three@0.185.1/webgpu.js";
import * as CANNON from "https://esm.sh/cannon-es";
import { GLTFLoader } from "https://esm.sh/three@0.185.1/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "https://esm.sh/three@0.185.1";

let Scene = null;
let Camera = null;
let Renderer = null;
let Mouse = null;
let Orbit = null;
let Skybox = null;
let SkyScene = null;
let SkyCamera = null;
let Keyboard = null;
let Character = null;
let World = null;
let PhysicsClock = null;
let CharacterBody = null;
let CharacterOffset = null;
let SpawnLocation = null;

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
    ZoomSensitivity: 0.0025,
    PanSensitivity: 0.01,
    MinRadius: 1,
    MaxRadius: 30,
    MinPhi: 0.01,
    MaxPhi: Math.PI - 0.01,
    Button: -1,
  };

  Keyboard = {};

  Character = {
    Model: null,
    position: new THREE.Vector3(0, 0, 0),
    Speed: 1,
  };

  World = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });

  World.allowSleep = true;

  World.defaultContactMaterial.friction = 0.4;
  World.defaultContactMaterial.restitution = 0;

  PhysicsClock = new THREE.Clock();
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

  EngineLoadCharacterModel();

  Renderer.domElement.addEventListener("contextmenu", (Event) => {
    Event.preventDefault();
  });

  Renderer.domElement.addEventListener("mousedown", (Event) => {
    Orbit.Button = Event.button;
    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;
  });

  Renderer.domElement.addEventListener("wheel", (Event) => {
    Orbit.Radius *= Math.exp(Event.deltaY * Orbit.ZoomSensitivity);

    Orbit.Radius = THREE.MathUtils.clamp(
      Orbit.Radius,
      Orbit.MinRadius,
      Orbit.MaxRadius,
    );
  });

  window.addEventListener("keydown", (Event) => {
    Keyboard[Event.code] = true;
  });

  window.addEventListener("keyup", (Event) => {
    Keyboard[Event.code] = false;
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

    if (Orbit.Button === 2) {
      Orbit.Theta -= DeltaX * Orbit.RotateSensitivity;
      Orbit.Phi -= DeltaY * Orbit.RotateSensitivity;

      Orbit.Phi = THREE.MathUtils.clamp(Orbit.Phi, Orbit.MinPhi, Orbit.MaxPhi);
    }
  });
}

function EngineLoadCharacterModel() {
  const Loader = new GLTFLoader();

  Loader.load(
    "/Resources/Models/R6.glb",
    (GLTF) => {
      Character.Model = GLTF.scene;
      Character.Model.position.set(0, 0, 0);
      Character.Model.scale.setScalar(4);

      Scene.add(Character.Model);

      const Bounds = new THREE.Box3().setFromObject(Character.Model);
      const Size = new THREE.Vector3();
      const Center = new THREE.Vector3();

      Bounds.getSize(Size);
      Bounds.getCenter(Center);

      CharacterOffset = Center.clone().sub(Character.Model.position);

      const Shape = new CANNON.Box(
        new CANNON.Vec3(Size.x / 2, Size.y / 2, Size.z / 2),
      );

      CharacterBody = new CANNON.Body({
        mass: 1,
        shape: Shape,
        position: new CANNON.Vec3(0, 10, 0),
        fixedRotation: true,
        linearDamping: 0.1,
      });

      CharacterBody.updateMassProperties();
      World.addBody(CharacterBody);

      if (SpawnLocation) {
        CharacterBody.position.set(
          SpawnLocation.position.x,
          SpawnLocation.position.y,
          SpawnLocation.position.z,
        );
      }
    },
    undefined,
    (Error) => {
      console.error("Failed to load R6 character:", Error);
    },
  );
}

function EngineUpdateCharacter() {
  if (!CharacterBody) return;

  const Direction = new THREE.Vector3();
  const Forward = new THREE.Vector3();
  const Right = new THREE.Vector3();

  Camera.getWorldDirection(Forward);
  Forward.y = 0;
  Forward.normalize();

  Right.crossVectors(Forward, new THREE.Vector3(0, 1, 0)).normalize();

  if (Keyboard["KeyW"]) Direction.add(Forward);
  if (Keyboard["KeyS"]) Direction.sub(Forward);
  if (Keyboard["KeyA"]) Direction.sub(Right);
  if (Keyboard["KeyD"]) Direction.add(Right);

  if (Direction.lengthSq() > 0) {
    Direction.normalize();
  }

  const Speed = 5;

  CharacterBody.velocity.x = Direction.x * Speed;
  CharacterBody.velocity.z = Direction.z * Speed;
}

function EngineSyncCharacter() {
  if (!CharacterBody || !Character.Model) return;

  Character.Model.position.set(
    CharacterBody.position.x - CharacterOffset.x,
    CharacterBody.position.y - CharacterOffset.y,
    CharacterBody.position.z - CharacterOffset.z,
  );

  Character.position.copy(Character.Model.position);
}

function EngineUpdateOrbit() {
  Orbit.Target.copy(Character.position);

  const SinPhi = Math.sin(Orbit.Phi);

  Camera.position.set(
    Orbit.Target.x + Orbit.Radius * SinPhi * Math.sin(Orbit.Theta),
    Orbit.Target.y + Orbit.Radius * Math.cos(Orbit.Phi),
    Orbit.Target.z + Orbit.Radius * SinPhi * Math.cos(Orbit.Theta),
  );

  Camera.lookAt(Orbit.Target);
}

function EngineRunAnimate() {
  const Delta = Math.min(PhysicsClock.getDelta(), 0.1);

  EngineUpdateOrbit();
  EngineUpdateCharacter();

  World.step(1 / 60, Delta, 3);

  EngineSyncCharacter();
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

export function EngineLoadProject(Project) {
  Project = JSON.parse(Project);

  for (const Instance of Project) {
    const [X, Y, Z] = Instance.Position;
    const [RX, RY, RZ] = Instance.Rotation;
    const [Width, Height, Depth] = Instance.Size;
    const Color = parseInt(Instance.Color, 16);

    if (Instance.Type != "Part" && Instance.Type != "SpawnLocation") {
      console.log(`Unknown instance: ${Instance.Type}`);
    }

    if (Instance.Type === "Part" || Instance.Type === "SpawnLocation") {
      const Part = addStud(Width, Height, Depth, Color, X, Y, Z);

      if (Instance.Type === "SpawnLocation") {
        SpawnLocation = Part;
      }
    }
  }
}

function addStud(Width, Height, Depth, Color, X, Y, Z) {
  const Geometry = new THREE.BoxGeometry(Width, Height, Depth);
  const Material = new THREE.MeshBasicMaterial({ color: Color });

  const Mesh = new THREE.Mesh(Geometry, Material);
  Mesh.position.set(X, Y, Z);

  Scene.add(Mesh);

  const Body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(Width / 2, Height / 2, Depth / 2)),
    position: new CANNON.Vec3(X, Y, Z),
  });

  World.addBody(Body);
  return Mesh;
}

window.addStud = addStud;
