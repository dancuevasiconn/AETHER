import type { EntityKind } from "../domain/index.js";
import { EDGE_TYPES } from "../graph/index.js";
import type { ContextOptions, EdgeType } from "../graph/index.js";
import type { Exposure, ViewType } from "./types.js";

export const VISUALIZATION_RULES_VERSION = "0.1";
const focusExpansion: readonly EntityKind[] = [
  "BusinessCapability",
  "Element",
  "Relationship",
  "Process",
  "Flow",
  "FlowSegment",
  "Role",
  "Responsibility",
  "BusinessRule",
  "RuleImplementation",
];
export const familyEdges: readonly EdgeType[] = [
  "Flow.flowFamily",
  "Flow.segment",
  "Flow.dataObject",
  "Flow.startElement",
  "Flow.endElement",
  "FlowSegment.sourceElement",
  "FlowSegment.targetElement",
  "FlowSegment.dataObject",
  "FlowSegment.relationship",
  "BusinessCapability.flowFamily",
  "BusinessCapability.process",
  "BusinessCapability.role",
  "Responsibility.businessCapability",
  "Process.initiatesFlow",
  "Process.usesFlow",
  "Role.flow",
  "Role.flowSegment",
  "BusinessRule.flow",
  "BusinessRule.flowSegment",
];
export function defaultContext(type: ViewType): ContextOptions {
  return type === "FLOW_FAMILY"
    ? {
        maxDepth: 3,
        direction: "both",
        edgeTypes: familyEdges,
        expansionEntityTypes: ["Flow", "FlowSegment", "BusinessCapability"],
      }
    : {
        maxDepth: 2,
        direction: "both",
        edgeTypes: EDGE_TYPES,
        expansionEntityTypes: focusExpansion,
      };
}
export const primaryKinds: Readonly<Record<ViewType, readonly EntityKind[]>> = {
  FULL_MAP: ["Element", "BusinessCapability", "Process"],
  FOCUS: ["Element", "BusinessCapability", "Process", "Role", "BusinessRule", "Flow"],
  FLOW: ["Flow", "Element", "FlowSegment"],
  FLOW_FAMILY: ["Element", "BusinessCapability", "Process", "Role", "BusinessRule", "Flow"],
};
export const primaryEdges: readonly EdgeType[] = [
  "BusinessCapability.process",
  "BusinessCapability.role",
  "Process.role",
  "Process.element",
  "Process.dataObject",
  "Process.initiatesFlow",
  "Process.usesFlow",
  "BusinessRule.process",
  "BusinessRule.ownerRole",
  "Flow.segment",
  "Flow.dataObject",
  "Flow.startElement",
  "Flow.endElement",
  "FlowSegment.sourceElement",
  "FlowSegment.targetElement",
  "FlowSegment.dataObject",
  "Relationship.sourceElement",
  "Relationship.targetElement",
];
export function baseExposure(type: ViewType, kind: EntityKind): Exposure {
  if (kind === "Architecture" || kind === "FlowFamily") return "PRIMARY";
  if (kind === "Layer") return "HIDDEN";
  return primaryKinds[type].includes(kind) ? "PRIMARY" : "SECONDARY";
}
