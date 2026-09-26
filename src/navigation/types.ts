import type { EntityKind } from "../domain/index.js";
import type { EdgeType, GraphEngine, NodeKey } from "../graph/index.js";
import type {
  EntityReference,
  ViewState,
  ViewType,
  VisualizationProjection,
} from "../visualization/index.js";

export type NavigationContextRequest = NonNullable<ViewState["context"]>;
export type FilterPolicy = "PRESERVE" | "CLEAR_ALL";

export interface NavigationTarget {
  readonly reference: EntityReference;
  readonly nodeKey?: NodeKey;
  readonly perspective?: ViewType;
  readonly context?: NavigationContextRequest;
}

export type NavigationIntent =
  | { readonly type: "INSPECT_ENTITY"; readonly target?: NavigationTarget }
  | {
      readonly type: "FOCUS_ENTITY";
      readonly target: NavigationTarget;
      readonly filterPolicy?: FilterPolicy;
    }
  | {
      readonly type: "OPEN_CONTEXT";
      readonly target: NavigationTarget;
      readonly context: NavigationContextRequest;
      readonly filterPolicy?: FilterPolicy;
    }
  | {
      readonly type: "OPEN_RELATED";
      readonly from: EntityReference;
      readonly target: NavigationTarget;
      readonly viaEdgeKey: string;
      readonly filterPolicy?: FilterPolicy;
    }
  | {
      readonly type: "OPEN_FLOW";
      readonly target: NavigationTarget;
      readonly filterPolicy?: FilterPolicy;
    }
  | {
      readonly type: "OPEN_FLOW_FAMILY";
      readonly target: NavigationTarget;
      readonly filterPolicy?: FilterPolicy;
    }
  | { readonly type: "SELECT_FLOW_SEGMENT"; readonly target: NavigationTarget }
  | { readonly type: "NEXT_FLOW_SEGMENT" }
  | { readonly type: "PREVIOUS_FLOW_SEGMENT" }
  | { readonly type: "OPEN_SEGMENT_SOURCE"; readonly filterPolicy?: FilterPolicy }
  | { readonly type: "OPEN_SEGMENT_TARGET"; readonly filterPolicy?: FilterPolicy }
  | { readonly type: "GO_TO_ENTRY"; readonly entryId: string }
  | { readonly type: "BACK" }
  | { readonly type: "FORWARD" }
  | { readonly type: "HOME" };

export interface NavigationEntry {
  readonly id: string;
  readonly intentType: NavigationIntent["type"] | "INITIAL";
  readonly target?: NavigationTarget;
  readonly viewState: ViewState;
  readonly transition?: {
    readonly from?: EntityReference;
    readonly edgeKey?: string;
    readonly edgeType?: EdgeType;
    readonly direction?: "forward" | "inverse";
  };
  readonly label?: string;
}

export interface NavigationState {
  readonly home: NavigationEntry;
  readonly past: readonly NavigationEntry[];
  readonly current: NavigationEntry;
  readonly future: readonly NavigationEntry[];
}

export interface NavigationTransition {
  readonly navigationState: NavigationState;
  readonly viewState: ViewState;
  readonly entry: NavigationEntry;
}

export type NavigationWarning = { readonly code: "TARGET_FILTERED"; readonly message: string };
export type NavigationNoOpReason =
  | "ALREADY_CURRENT"
  | "HISTORY_START"
  | "HISTORY_END"
  | "FIRST_FLOW_SEGMENT"
  | "LAST_FLOW_SEGMENT"
  | "SELECTION_UNCHANGED";
export type NavigationErrorCode =
  | "TARGET_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "RELATION_NOT_FOUND"
  | "INVALID_TARGET_TYPE"
  | "INVALID_PERSPECTIVE"
  | "INVALID_CONTEXT"
  | "FLOW_NOT_AVAILABLE"
  | "FLOW_SEGMENT_NOT_FOUND"
  | "PROJECTION_UNAVAILABLE"
  | "HISTORY_EMPTY"
  | "GRAPH_ERROR";
export interface NavigationError {
  readonly code: NavigationErrorCode;
  readonly message: string;
}
export type NavigationResult =
  | {
      readonly status: "success";
      readonly transition: NavigationTransition;
      readonly warnings: readonly NavigationWarning[];
    }
  | {
      readonly status: "no-op";
      readonly reason: NavigationNoOpReason;
      readonly state: NavigationState;
    }
  | {
      readonly status: "failure";
      readonly error: NavigationError;
      readonly state: NavigationState;
    };

export interface NavigationOption {
  readonly target: NavigationTarget;
  readonly edgeKey: string;
  readonly edgeType: EdgeType;
  readonly direction: "forward" | "inverse";
}
export type NavigationOptionsResult =
  | { readonly success: true; readonly options: readonly NavigationOption[] }
  | { readonly success: false; readonly error: NavigationError };
export interface NavigationAvailability {
  readonly available: boolean;
  readonly result: NavigationResult;
}
export interface NavigationBreadcrumb {
  readonly entryId: string;
  readonly label: string;
  readonly current: boolean;
}

export interface NavigationProjectionAssessment {
  readonly result: NavigationResult;
  readonly projection?: VisualizationProjection;
}

export type NavigationGraph = Pick<
  GraphEngine,
  "getNode" | "getNeighbors" | "getOutgoing" | "getIncoming" | "getFlowSegments"
>;
export interface EntityTypeReference {
  readonly entityType: EntityKind;
  readonly entityId: string;
}
