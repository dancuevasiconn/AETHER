import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGraph } from "../graph/index.js";
import { loadArchitectureFromJson } from "../loading/index.js";
import { App } from "./App.js";
import { neutralDemoDocument } from "./neutral-demo.js";
import "./styles.css";

const host = document.getElementById("root");
if (!host) throw new Error("Root element missing.");
const loaded = loadArchitectureFromJson(JSON.stringify(neutralDemoDocument));
if (!loaded.success) throw new Error("Neutral demonstration failed to load.");
const graph = createGraph(loaded.architecture);
if (!graph.success) throw new Error("Neutral demonstration graph failed.");
createRoot(host).render(
  <StrictMode>
    <App graph={graph.value} />
  </StrictMode>,
);
