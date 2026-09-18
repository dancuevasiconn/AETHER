import type { GraphNode, GraphResult } from "../graph/index.js";
import type { EntityReference, VisualizationErrorCode, VisualizationResult } from "./types.js";

export const entityKinds = [
  "Architecture",
  "BusinessCapability",
  "Element",
  "Relationship",
  "Layer",
  "Process",
  "DataObject",
  "Flow",
  "FlowSegment",
  "FlowFamily",
  "Role",
  "Position",
  "Responsibility",
  "BusinessRule",
  "RuleImplementation",
  "DecisionReference",
] as const;
export const levels = ["BUSINESS", "APPLICATION", "TECHNOLOGY"] as const;
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function reference(node: GraphNode): EntityReference {
  return { entityType: node.entityType, entityId: node.entityId };
}
export function fail(code: VisualizationErrorCode, message: string): never {
  throw new ProjectionFailure({ success: false, error: { code, message } });
}
export class ProjectionFailure extends Error {
  constructor(readonly result: Extract<VisualizationResult<never>, { success: false }>) {
    super(result.error.message);
  }
}
export function read<T>(result: GraphResult<T>): T {
  if (!result.success)
    throw new ProjectionFailure({
      success: false,
      error: { code: "GRAPH_ERROR", message: result.error.message, graphError: result.error },
    });
  return result.value;
}
export function attempt<T>(operation: () => T): VisualizationResult<T> {
  try {
    return { success: true, value: operation() };
  } catch (error) {
    return error instanceof ProjectionFailure
      ? error.result
      : {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected visualization projection failure.",
          },
        };
  }
}
