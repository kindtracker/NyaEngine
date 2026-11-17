// import * as CANNON from "https://esm.sh/cannon-es";
// import { CSM } from "https://esm.sh/three@0.185.1/examples/jsm/csm/CSM.js";
// import { WebGPURenderer } from "https://esm.sh/three@0.185.1/webgpu.js";
import { FBXLoader } from "https://esm.sh/three@0.185.1/examples/jsm/loaders/FBXLoader.js";
import RAPIER from "https://esm.sh/@dimforge/rapier3d-compat";
import * as THREE from "https://esm.sh/three@0.185.1";

let World = null;
let Scene = null;
let Camera = null;
let Renderer = null;
let SkyScene = null;
let SkyCamera = null;
let Skybox = null;
let Character = null;
let SpawnLocation = null;
let Keyboard = null;
let KeyboardToggle = null;
let Mouse = null;
let Orbit = null;
let TextureLoader = null;
let MeshLoader = null;
let Textures = null;
let PhysicsMeshes = null;
let LastPhysicsTickTime = null;
let PhysicsAccumulator = null;

const PHYSICS_TPS = 1 / 60;
const UPDATE_TPS = 1 / 24;
const NETWORK_TPS = 1 / 16;

const PHYSICS_SUB_STEPS = 4;
const STUDS_PER_TILE = 4;
const GRAITY = -196.2;
const WALK_SPEED = 16;
const JUMP_POWER = 50;
const ROTATION_SPEED = 10;
const CLIMB_SPEED = 32;

export async function EngineInitialize() {
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
  KeyboardToggle = {};

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
    WalkSpeed: WALK_SPEED,
    JumpPower: JUMP_POWER,
    OnGround: false,
  };

  TextureLoader = new THREE.TextureLoader();
  MeshLoader = new FBXLoader();

  Textures = {};

  await RAPIER.init();
  World = new RAPIER.World({
    x: 0,
    y: GRAITY,
    z: 0,
  });
  World.timestep = PHYSICS_TPS;

  PhysicsMeshes = [];

  LastPhysicsTickTime = 0;
  PhysicsAccumulator = 0;
}

export async function EngineLoad() {
  document.body.appendChild(Renderer.domElement);

  await EngineLoadTextures();
  EngineLoadSkybox();
  EngineLoadCharacterModel();
  EngineInitializeInput();

  window.addEventListener("resize", EngineResize);
}

async function EngineLoadTextures() {
  const TextureList = ["Skybox", "Stud", "StudNormal"];

  for (const TextureName of TextureList) {
    const TexturePath = `/Resources/Images/${TextureName}.png`;
    const Texture = await TextureLoader.load(
      TexturePath,
      undefined,
      undefined,
      (Error) => {
        console.error(`Failed to load ${TextureName}.png:`, Error);
      },
    );
    Texture.colorSpace = THREE.SRGBColorSpace;
    Textures[TextureName] = Texture;
  }
}

function EngineLoadSkybox() {
  const Geometry = new THREE.SphereGeometry(16, 32, 32);
  const Material = new THREE.MeshBasicMaterial({
    map: Textures.Skybox,
    side: THREE.BackSide,
    depthWrite: false,
  });

  Skybox = new THREE.Mesh(Geometry, Material);
  SkyScene.add(Skybox);

  SkyCamera.position.set(0, 0, 0);
}

function EngineCreateCharacterPhysics() {
  const BodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(
      Character.Position.x,
      Character.Position.y,
      Character.Position.z,
    )
    .lockRotations()
    .setCanSleep(false);

  const Body = World.createRigidBody(BodyDesc);
  const ColliderDesc = RAPIER.ColliderDesc.cuboid(1, 2, 0.5)
    .setFriction(0.9)
    .setRestitution(0);

  World.createCollider(ColliderDesc, Body);

  Character.Physics = { Body };
}

function EngineLoadCharacterModel() {
  MeshLoader.load(
    "/Resources/Models/R6.fbx",

    (FBX) => {
      if (Character.Model) {
        Scene.remove(Character.Model);
      }

      Character.Model = FBX;
      Character.Model.position.set(0, 0, 0);
      Character.Model.updateMatrixWorld(true);

      Scene.add(Character.Model);

      Character.Position.set(0, 5, 0);
      EngineCreateCharacterPhysics();
    },

    undefined,

    (Error) => {
      console.error("Failed to load character model:", Error);
    },
  );
}

function EngineUpdateCharacter() {
  const Body = Character.Physics.Body;

  if (KeyboardToggle["ShiftLeft"]) {
    const CameraDirection = new THREE.Vector3();
    Camera.getWorldDirection(CameraDirection);
    CameraDirection.y = 0;
    CameraDirection.normalize();

    const CameraYaw = Math.atan2(-CameraDirection.x, -CameraDirection.z);

    const Rotation = new THREE.Quaternion();
    Rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), CameraYaw);

    Body.setRotation(Rotation, true);
  }
}

function EngineSyncCharacter() {
  if (!Character.Physics || !Character.Model) return;

  const Body = Character.Physics.Body;
  const Position = Body.translation();
  const Rotation = Body.rotation();

  Character.Position.set(Position.x, Position.y, Position.z);
  Character.Model.position.set(Position.x, Position.y, Position.z);
  Character.Model.quaternion.set(
    Rotation.x,
    Rotation.y,
    Rotation.z,
    Rotation.w,
  );
}

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
    if (Orbit.Button !== 2 && !KeyboardToggle["ShiftLeft"]) return;

    let DeltaX;
    let DeltaY;

    if (document.pointerLockElement) {
      DeltaX = Event.movementX;
      DeltaY = Event.movementY;
    } else {
      DeltaX = Event.clientX - Mouse.X;
      DeltaY = Event.clientY - Mouse.Y;
    }

    Mouse.X = Event.clientX;
    Mouse.Y = Event.clientY;

    Orbit.Theta -= DeltaX * Orbit.RotateSensitivity;
    Orbit.Phi -= DeltaY * Orbit.RotateSensitivity;
    Orbit.Phi = THREE.MathUtils.clamp(Orbit.Phi, Orbit.MinPhi, Orbit.MaxPhi);
  });

  window.addEventListener("keydown", (Event) => {
    Keyboard[Event.code] = true;
    KeyboardToggle[Event.code] = !KeyboardToggle[Event.code];

    if (Event.code == "ShiftLeft") {
      if (KeyboardToggle["ShiftLeft"]) {
        document.body.requestPointerLock();
      } else {
        document.exitPointerLock();
      }
    }
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

function EngineUpdateCharacterState() {
  const Body = Character.Physics.Body;
  const Position = Body.translation();

  const Ray = new RAPIER.Ray(
    { x: Position.x, y: Position.y, z: Position.z },
    { x: 0, y: -1, z: 0 },
  );

  const Hit = World.castRay(
    Ray,
    2.1,
    true,
    undefined,
    undefined,
    undefined,
    Body,
  );

  Character.OnGround = Hit !== null;
}

function EngineUpdateInput(DeltaTime) {
  if (!Character.Physics) return;

  const Body = Character.Physics.Body;
  const Velocity = Body.linvel();

  const Speed = Character.WalkSpeed;
  const TurnSpeed = ROTATION_SPEED;

  const CameraDirection = new THREE.Vector3();
  Camera.getWorldDirection(CameraDirection);
  CameraDirection.y = 0;
  CameraDirection.normalize();

  const CameraYaw = Math.atan2(-CameraDirection.x, -CameraDirection.z);

  let MoveX = 0;
  let MoveZ = 0;
  if (Keyboard["KeyW"]) MoveZ -= 1;
  if (Keyboard["KeyS"]) MoveZ += 1;
  if (Keyboard["KeyA"]) MoveX -= 1;
  if (Keyboard["KeyD"]) MoveX += 1;
  if (Keyboard["Space"] && Character.OnGround) {
    Velocity.y = JUMP_POWER;
  }

  const HasMovement = MoveX !== 0 || MoveZ !== 0;
  const Forward = new THREE.Vector3(
    -Math.sin(CameraYaw),
    0,
    -Math.cos(CameraYaw),
  );

  const Right = new THREE.Vector3(Math.cos(CameraYaw), 0, -Math.sin(CameraYaw));
  const Movement = new THREE.Vector3()
    .addScaledVector(Forward, -MoveZ)
    .addScaledVector(Right, MoveX);

  if (Movement.lengthSq() > 0) {
    Movement.normalize();
  }

  if (HasMovement) {
    const TargetYaw = Math.atan2(-Movement.x, -Movement.z);

    const BodyRotation = Body.rotation();

    const CurrentQuaternion = new THREE.Quaternion(
      BodyRotation.x,
      BodyRotation.y,
      BodyRotation.z,
      BodyRotation.w,
    );

    const CurrentYaw = new THREE.Euler().setFromQuaternion(
      CurrentQuaternion,
      "YXZ",
    ).y;

    const Difference = Math.atan2(
      Math.sin(TargetYaw - CurrentYaw),
      Math.cos(TargetYaw - CurrentYaw),
    );

    let NewYaw = CurrentYaw + Difference * Math.min(1, TurnSpeed * DeltaTime);

    const Rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      NewYaw,
    );

    Body.setRotation(Rotation, true);
  }

  Body.setLinvel(
    {
      x: Movement.x * Speed,
      y: Velocity.y,
      z: Movement.z * Speed,
    },
    true,
  );
}

function EngineRunAnimate() {
  const Now = performance.now() / 1000;
  const DeltaTime = Now - LastPhysicsTickTime;

  LastPhysicsTickTime = Now;
  PhysicsAccumulator += DeltaTime;

  EngineUpdateCharacterState();
  EngineUpdateInput(DeltaTime);
  EngineUpdateCharacter();

  while (PhysicsAccumulator >= PHYSICS_TPS) {
    World.step();
    PhysicsAccumulator -= PHYSICS_TPS;
  }

  EngineSyncPhysics();
  EngineSyncCharacter();
  EngineUpdateOrbit();

  SkyCamera.quaternion.copy(Camera.quaternion);
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

function EngineCreatePhysics(Mesh, Mass = 1) {
  const { x, y, z } = Mesh.position;

  const BodyDesc =
    Mass === 0 ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();

  const Body = World.createRigidBody(BodyDesc);
  Body.setTranslation({ x, y, z }, true);

  const Rotation = Mesh.quaternion;
  Body.setRotation(
    {
      x: Rotation.x,
      y: Rotation.y,
      z: Rotation.z,
      w: Rotation.w,
    },
    true,
  );

  const Geometry = Mesh.geometry.parameters;
  const ColliderDesc = RAPIER.ColliderDesc.cuboid(
    Geometry.width / 2,
    Geometry.height / 2,
    Geometry.depth / 2,
  );

  if (Mass > 0) {
    ColliderDesc.setMass(Mass);
  }

  const Collider = World.createCollider(ColliderDesc, Body);
  Mesh.userData.Physics = {
    Body,
    Collider,
  };

  PhysicsMeshes.push(Mesh);

  return Mesh.userData.Physics;
}

function EngineSyncPhysics() {
  for (const Mesh of PhysicsMeshes) {
    const Body = Mesh.userData.Physics.Body;

    const Position = Body.translation();
    const Rotation = Body.rotation();

    Mesh.position.set(Position.x, Position.y, Position.z);
    Mesh.quaternion.set(Rotation.x, Rotation.y, Rotation.z, Rotation.w);
  }
}

function addStud(Width, Height, Depth, Color, X, Y, Z, RX = 0, RY = 0, RZ = 0) {
  const Stud = Textures.Stud.clone();
  Stud.wrapS = THREE.RepeatWrapping;
  Stud.wrapT = THREE.RepeatWrapping;
  Stud.repeat.set(Width / STUDS_PER_TILE, Depth / STUDS_PER_TILE);

  const TopBottomMaterial = new THREE.MeshBasicMaterial({
    map: Stud,
    color: Color,
  });

  const SideMaterial = new THREE.MeshBasicMaterial({
    color: Color,
  });

  const Materials = [
    SideMaterial,
    SideMaterial,
    TopBottomMaterial,
    TopBottomMaterial,
    SideMaterial,
    SideMaterial,
  ];

  const Geometry = new THREE.BoxGeometry(Width, Height, Depth);

  const Mesh = new THREE.Mesh(Geometry, Materials);
  Mesh.position.set(X, Y, Z);
  Mesh.rotation.order = "XYZ";
  Mesh.rotation.set(RX, RY, RZ);
  Mesh.castShadow = true;
  Mesh.receiveShadow = true;

  Scene.add(Mesh);

  EngineCreatePhysics(Mesh, 0);
  PhysicsMeshes.push(Mesh);

  return Mesh;
}

window.addStud = addStud;
