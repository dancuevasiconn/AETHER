import type { RendererConfiguration } from "./types.js";

export const SVG_RENDERER_VERSION = "0.1";
export const APS_LABELS: Readonly<Record<string, string>> = {
  EXPERIENCE_CUSTOMER_INTERACTION: "Experience / Customer",
  GOVERNANCE_POLICIES_DECISIONS: "Governance / Policies",
  INTEGRATION_ORCHESTRATION: "Integration / Orchestration",
  CORE: "Core",
  SATELLITES: "Satellites",
  SECURITY: "Security",
  OBSERVABILITY_CONTROL: "Observability / Control",
  DATA_ANALYTICS: "Data & Analytics",
};
export const LEVEL_LABELS: Readonly<Record<string, string>> = {
  BUSINESS: "Business",
  APPLICATION: "Application",
  TECHNOLOGY: "Technology",
};
export const DEFAULT_RENDERER_CONFIGURATION = {
  cellWidth: 240,
  nodeWidth: 176,
  rowGap: 20,
  columns: Object.entries(APS_LABELS).map(([id, label]) => ({ id, label })),
  levels: Object.entries(LEVEL_LABELS).map(([id, label]) => ({ id, label })),
} satisfies RendererConfiguration;
