import type { EntityKind } from "../domain/index.js";
import type { EntityReference, Exposure, VisualizationView } from "../visualization/index.js";

export interface ViewportState {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}
export interface EngineColumn {
  readonly id: string;
  readonly label: string;
}
export interface EngineLevel {
  readonly id: string;
  readonly label: string;
}
export interface RendererConfiguration {
  readonly columns?: readonly EngineColumn[];
  readonly levels?: readonly EngineLevel[];
  readonly cellWidth?: number;
  readonly nodeWidth?: number;
  readonly rowGap?: number;
}
export type AnchorSide = "top" | "right" | "bottom" | "left";
export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface RenderAnchor extends Point {
  readonly side: AnchorSide;
}
export type RenderRegionKind = "CELL" | "LEVEL_BAND" | "COLUMN_BAND" | "UNPOSITIONED" | "SUPPORT";
export interface RenderRegion {
  readonly key: string;
  readonly kind: RenderRegionKind;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly column?: string;
  readonly level?: string;
}
export interface RenderNode {
  readonly key: string;
  readonly entityType: EntityKind;
  readonly entityId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly anchors: Readonly<Record<AnchorSide, RenderAnchor>>;
  readonly regionKey: string;
  readonly kind: "node" | "chip" | "marker" | "ghost";
  readonly exposure: Exposure;
  readonly focused: boolean;
  readonly selected: boolean;
  readonly attenuated: boolean;
  readonly degraded: boolean;
}
export interface RenderEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly edgeType: string;
  readonly path: string;
  readonly markerEnd: "edge-arrow";
  readonly emphasis: string;
  readonly multiedgeIndex: number;
  readonly multiedgeCount: number;
}
export interface RenderRouteSegment {
  readonly key: string;
  readonly flow: EntityReference;
  readonly segment: EntityReference;
  readonly sequence: number;
  readonly source: EntityReference;
  readonly target: EntityReference;
  readonly path?: string;
  readonly status: "COMPLETE" | "INCOMPLETE";
  readonly dataObjects: readonly EntityReference[];
}
export interface RenderRoute {
  readonly key: string;
  readonly flow: EntityReference;
  readonly segments: readonly RenderRouteSegment[];
}
export interface RenderScene {
  readonly width: number;
  readonly height: number;
  readonly columns: readonly EngineColumn[];
  readonly levels: readonly EngineLevel[];
  readonly regions: readonly RenderRegion[];
  readonly nodes: readonly RenderNode[];
  readonly edges: readonly RenderEdge[];
  readonly routes: readonly RenderRoute[];
}
export type VisualizationEngineEvent =
  | { readonly type: "selectionRequested"; readonly reference: EntityReference }
  | { readonly type: "selectionCleared" }
  | { readonly type: "focusRequested"; readonly reference: EntityReference }
  | { readonly type: "expansionRequested"; readonly reference: EntityReference }
  | { readonly type: "viewportChanged"; readonly viewport: ViewportState }
  | { readonly type: "flowSelected"; readonly reference: EntityReference }
  | { readonly type: "flowSegmentSelected"; readonly reference: EntityReference }
  | { readonly type: "edgeInspected"; readonly graphEdgeKey: string };
export type EngineEventHandler = (event: VisualizationEngineEvent) => void;
export interface VisualizationRenderer {
  render(view: VisualizationView): void;
  updateViewport(viewport: ViewportState): void;
  getViewport(): ViewportState;
  getScene(): RenderScene | undefined;
  fitToView(): ViewportState;
  locate(reference: EntityReference): ViewportState | undefined;
  onEvent(handler: EngineEventHandler): () => void;
  destroy(): void;
}
