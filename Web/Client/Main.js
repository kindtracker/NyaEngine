import {
  EngineInitialize,
  EngineLoad,
  EngineRun,
  EngineLoadProject,
} from "/Engine/NyaEngine.js";

EngineInitialize();
EngineLoad();

const ProjectResponse = await fetch("/Projects/Baseplate.json");
const Project = await ProjectResponse.text();
EngineLoadProject(Project);

EngineRun();
