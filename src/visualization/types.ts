import type { ApsLayer, ArchitectureLevel, EntityKind } from "../domain/index.js";
import type {
  ContextOptions,
  EdgeProvenance,
  EdgeType,
  GraphError,
  NodeKey,
  PositioningRole,
} from "../graph/index.js";

export type ViewType = "FULL_MAP" | "FOCUS" | "FLOW" | "FLOW_FAMILY";
export interface EntityReference {
  readonly entityType: EntityKind;
  readonly entityId: string;
}
export type Exposure = "PRIMARY" | "SECONDARY" | "HIDDEN";
export type Visibility = "VISIBLE" | "HIDDEN";
export type Emphasis = "NORMAL" | "HIGHLIGHTED" | "ATTENUATED";
export interface PositionEvidence {
  readonly property: "layer" | "apsLayer" | "architectureLevel" | "presentationLevel";
  readonly source: "DOMAIN_FIELD" | "GRAPH_APS_INHERITANCE" | "VISUAL_RULE";
  readonly entity?: NodeKey;
  readonly field?: string;
  readonly rule?: string;
}
export interface SemanticPosition {
  readonly layer?: EntityReference;
  readonly apsLayer?: ApsLayer;
  /** Only a level explicitly declared by the Domain Model. */
  readonly architectureLevel?: ArchitectureLevel;
  /** A presentation rule, never a Domain Model classification. */
  readonly presentationLevel?: ArchitectureLevel;
  readonly positioningRole?: PositioningRole;
  readonly provenance: readonly PositionEvidence[];
  readonly positioningState:
    "POSITIONED" | "PARTIALLY_POSITIONED" | "UNPOSITIONED" | "NOT_APPLICABLE";
}
export interface ViewFilters {
  readonly entityTypes?: readonly EntityKind[];
  readonly apsLayers?: readonly ApsLayer[];
  /** Matches explicitly declared domain levels, not presentationLevel. */
  readonly architectureLevels?: readonly ArchitectureLevel[];
  readonly flowFamilies?: readonly EntityReference[];
  readonly edgeTypes?: readonly EdgeType[];
  readonly positioningRoles?: readonly PositioningRole[];
  readonly layers?: readonly EntityReference[];
  readonly elementTypes?: readonly string[];
}
export interface ViewState {
  readonly viewId: string;
  readonly viewType: ViewType;
  readonly focus?: EntityReference;
  readonly selection?: EntityReference;
  readonly filters?: ViewFilters;
  readonly expansions?: readonly EntityReference[];
  /** Caller supplies previously visible entity references, not another Architecture. */
  readonly orientationBase?: readonly EntityReference[];
  readonly activeRoute?: EntityReference;
  readonly context?: Pick<
    ContextOptions,
    "maxDepth" | "direction" | "edgeTypes" | "expansionEntityTypes"
  >;
}
export interface VisualNode {
  readonly key: string;
  readonly graphNodeKey: NodeKey;
  readonly entityType: EntityKind;
  readonly entityId: string;
  readonly label?: string;
  readonly exposure: Exposure;
  readonly visibility: Visibility;
  readonly emphasis: Emphasis;
  readonly semanticPosition: SemanticPosition;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly representationRole: "ENTITY" | "CONTEXT" | "SUPPORT";
  readonly depth?: number;
}
export interface VisualEdge {
  readonly graphEdgeKey: string;
  readonly sourceVisualNodeKey: string;
  readonly targetVisualNodeKey: string;
  readonly edgeType: EdgeType;
  readonly provenance: readonly EdgeProvenance[];
  readonly exposure: Exposure;
  readonly visibility: Visibility;
  readonly emphasis: Emphasis;
}
export interface FlowRouteSegment {
  readonly reference: EntityReference;
  readonly graphNodeKey: NodeKey;
  readonly flow: EntityReference;
  readonly sequence: number;
  readonly source: EntityReference;
  readonly target: EntityReference;
  readonly dataObjects: readonly EntityReference[];
  readonly relationship?: EntityReference;
  readonly graphEdgeKeys: readonly string[];
}
export interface FlowRoute {
  readonly flow: EntityReference;
  readonly graphNodeKey: NodeKey;
  readonly segments: readonly FlowRouteSegment[];
  readonly visibility: Visibility;
}
export interface VisualizationView {
  readonly viewId: string;
  readonly viewType: ViewType;
  readonly architectureRef: EntityReference;
  readonly focus?: EntityReference;
  readonly nodes: readonly VisualNode[];
  readonly edges: readonly VisualEdge[];
  readonly routes: readonly FlowRoute[];
  readonly activeFilters: ViewFilters;
  readonly selectionContext: {
    readonly selection?: EntityReference;
    readonly selectionCleared: boolean;
  };
  readonly semanticFrame: {
    readonly apsLayers: readonly ApsLayer[];
    readonly architectureLevels: readonly ArchitectureLevel[];
  };
  readonly projectionMetadata: {
    readonly rulesVersion: string;
    readonly scope: "ARCHITECTURE" | "BOUNDED_CONTEXT" | "FLOW_COMPOSITION";
    readonly context: ViewState["context"];
    readonly orientationBase: readonly EntityReference[];
    readonly expansions: readonly EntityReference[];
    readonly activeRoute?: EntityReference;
    readonly selectionCleared: boolean;
  };
}
export interface VisualizationProjection {
  readonly view: VisualizationView;
  readonly viewState: ViewState;
}
export type VisualizationErrorCode =
  | "INVALID_VIEW_TYPE"
  | "INVALID_PARAMETERS"
  | "FOCUS_REQUIRED"
  | "INVALID_FOCUS_TYPE"
  | "FOCUS_NOT_FOUND"
  | "INVALID_SELECTION"
  | "INVALID_FILTERS"
  | "INVALID_CONTEXT"
  | "INVALID_REFERENCE"
  | "INVALID_ACTIVE_ROUTE"
  | "GRAPH_ERROR"
  | "INTERNAL_ERROR";
export interface VisualizationError {
  readonly code: VisualizationErrorCode;
  readonly message: string;
  readonly graphError?: GraphError;
}
export type VisualizationResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: VisualizationError };
export interface InformationRelation {
  readonly graphEdgeKey: string;
  readonly edgeType: EdgeType;
  readonly source: EntityReference;
  readonly target: EntityReference;
  readonly direction: "forward" | "inverse";
  readonly provenance: readonly EdgeProvenance[];
}
export interface InformationDescriptor {
  readonly reference: EntityReference;
  readonly graphNodeKey: NodeKey;
  readonly label?: string;
  readonly description?: string;
  readonly focused: boolean;
  readonly selected: boolean;
  readonly semanticPosition: SemanticPosition;
  readonly relations: readonly InformationRelation[];
  readonly specific: Readonly<Record<string, string | number>>;
  readonly decisions: readonly EntityReference[];
  readonly implementations: readonly {
    readonly reference: EntityReference;
    readonly semanticPosition: SemanticPosition;
    readonly implementationType: string;
  }[];
  readonly route?: FlowRoute;
}
