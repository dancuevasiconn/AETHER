import type {
  Architecture,
  ArchitectureLevel,
  ApsLayer,
  EntityKind,
  FlowSegment,
} from "../domain/index.js";
import type { ValidationError } from "../validation/index.js";

export const EDGE_TYPES = [
  "BusinessCapability.process",
  "BusinessCapability.flowFamily",
  "BusinessCapability.role",
  "Element.layer",
  "Relationship.sourceElement",
  "Relationship.targetElement",
  "Layer.parentLayer",
  "Process.dataObject",
  "Process.initiatesFlow",
  "Process.usesFlow",
  "Process.role",
  "Process.element",
  "DataObject.element",
  "Flow.flowFamily",
  "Flow.dataObject",
  "Flow.startElement",
  "Flow.endElement",
  "Flow.segment",
  "FlowSegment.sourceElement",
  "FlowSegment.targetElement",
  "FlowSegment.dataObject",
  "FlowSegment.relationship",
  "Role.position",
  "Role.flow",
  "Role.flowSegment",
  "Role.dataObject",
  "Responsibility.businessCapability",
  "Responsibility.process",
  "Responsibility.role",
  "Responsibility.element",
  "BusinessRule.logicalLayer",
  "BusinessRule.process",
  "BusinessRule.dataObject",
  "BusinessRule.flow",
  "BusinessRule.flowSegment",
  "BusinessRule.responsibility",
  "BusinessRule.ownerRole",
  "RuleImplementation.businessRule",
  "RuleImplementation.executingElement",
  "RuleImplementation.executingRole",
  "RuleImplementation.actualLayer",
  "DecisionReference.affectedObject",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];
export type NodeKey = string;
export interface GraphNode {
  readonly entityType: EntityKind;
  readonly entityId: string;
  readonly key: NodeKey;
}
export interface EdgeProvenance {
  readonly entity: NodeKey;
  readonly field: string;
}
export interface GraphEdge {
  readonly source: NodeKey;
  readonly target: NodeKey;
  readonly edgeType: EdgeType;
  readonly key: string;
  readonly provenance: readonly EdgeProvenance[];
}
export type Direction = "outgoing" | "incoming" | "both";
export type PositioningRole = "DIRECT" | "LOGICAL" | "ACTUAL";
export interface EdgeOptions {
  readonly edgeTypes?: readonly EdgeType[];
}
export interface NeighborOptions extends EdgeOptions {
  readonly direction?: Direction;
}
export interface SearchOptions extends NeighborOptions {
  readonly maxDepth: number;
  readonly expansionEntityTypes?: readonly EntityKind[];
}
export interface TraversalOptions extends SearchOptions {
  readonly resultEntityTypes?: readonly EntityKind[];
  readonly includeStart?: boolean;
}
export interface ContextOptions extends TraversalOptions {
  readonly direction: Direction;
}
export interface GraphStep {
  readonly edge: GraphEdge;
  readonly from: NodeKey;
  readonly to: NodeKey;
  readonly direction: "forward" | "inverse";
}
export interface GraphVisit {
  readonly node: GraphNode;
  readonly depth: number;
}
export interface Neighborhood {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly steps: readonly GraphStep[];
}
export interface TraversalResult {
  readonly nodes: readonly GraphNode[];
  readonly visits: readonly GraphVisit[];
  readonly steps: readonly GraphStep[];
}
export type PathResult =
  | {
      readonly status: "found";
      readonly nodes: readonly GraphNode[];
      readonly edges: readonly GraphEdge[];
      readonly steps: readonly GraphStep[];
    }
  | { readonly status: "not-found" | "depth-limit-reached" };
export interface GraphContext {
  readonly focus: GraphNode;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly visits: readonly GraphVisit[];
}
export type GraphError =
  | {
      readonly code: "INVALID_ARCHITECTURE";
      readonly message: string;
      readonly errors: readonly ValidationError[];
    }
  | {
      readonly code: "NODE_NOT_FOUND" | "INVALID_PARAMETERS" | "INTERNAL_ERROR";
      readonly message: string;
    };
export type GraphResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: GraphError };
type CollectionEntity = NonNullable<
  Architecture[Exclude<
    keyof Architecture,
    "id" | "name" | "modelVersion" | "metadata" | "description"
  >]
>[number];
export type DomainEntity = Architecture | CollectionEntity;
export interface GraphEngine {
  getNode(entityType: EntityKind, entityId: string): GraphResult<GraphNode>;
  getEntity(key: NodeKey): GraphResult<DomainEntity>;
  getNodesByType(entityType: EntityKind): readonly GraphNode[];
  getNodesByLayer(layerKey: NodeKey, role: PositioningRole): GraphResult<readonly GraphNode[]>;
  getNodesByArchitectureLevel(
    level: ArchitectureLevel,
    role?: "DIRECT" | "ACTUAL",
  ): readonly GraphNode[];
  getNodesByApsLayer(apsLayer: ApsLayer, role?: PositioningRole): readonly GraphNode[];
  getLayersByApsLayer(apsLayer: ApsLayer): readonly GraphNode[];
  getOutgoing(key: NodeKey, options?: EdgeOptions): GraphResult<readonly GraphEdge[]>;
  getIncoming(key: NodeKey, options?: EdgeOptions): GraphResult<readonly GraphEdge[]>;
  getNeighbors(key: NodeKey, options?: NeighborOptions): GraphResult<Neighborhood>;
  traverse(key: NodeKey, options: TraversalOptions): GraphResult<TraversalResult>;
  findPath(source: NodeKey, target: NodeKey, options: SearchOptions): GraphResult<PathResult>;
  getContext(key: NodeKey, options: ContextOptions): GraphResult<GraphContext>;
  getFlowSegments(key: NodeKey): GraphResult<readonly FlowSegment[]>;
}
