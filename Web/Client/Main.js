import {
  EngineInitialize,
  EngineLoad,
  EngineRun,
  EngineLoadProject,
} from "/Engine/NyaEngine.js";

EngineInitialize();
EngineLoad();

const ProjectResponse = await fetch("/Projects/SFOTH.json");
const Project = await ProjectResponse.text();
EngineLoadProject(Project);

EngineRun();
