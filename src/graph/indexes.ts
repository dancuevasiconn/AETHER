import type { Architecture, ApsLayer } from "../domain/index.js";
import { nodeKey, ordinal, type Projection } from "./projection.js";
import type { GraphEdge, GraphNode, NodeKey, PositioningRole } from "./types.js";

export interface Indexes {
  readonly projection: Projection;
  readonly nodeByKey: ReadonlyMap<NodeKey, GraphNode>;
  readonly nodesByType: ReadonlyMap<string, readonly GraphNode[]>;
  readonly edgeByKey: ReadonlyMap<string, GraphEdge>;
  readonly outgoingEdges: ReadonlyMap<NodeKey, readonly GraphEdge[]>;
  readonly incomingEdges: ReadonlyMap<NodeKey, readonly GraphEdge[]>;
  readonly nodesByLayer: ReadonlyMap<string, readonly GraphNode[]>;
  readonly nodesByArchitectureLevel: ReadonlyMap<string, readonly GraphNode[]>;
  readonly nodesByApsLayer: ReadonlyMap<string, readonly GraphNode[]>;
  readonly layersByApsLayer: ReadonlyMap<ApsLayer, readonly GraphNode[]>;
}
export function positioningKey(role: PositioningRole, value: string): string {
  return JSON.stringify([role, value]);
}

export function indexProjection(a: Architecture, projection: Projection): Indexes {
  const nodeByKey = new Map(projection.nodes.map((n) => [n.key, n]));
  const nodesByType = new Map<string, GraphNode[]>();
  const outgoingEdges = new Map<NodeKey, GraphEdge[]>();
  const incomingEdges = new Map<NodeKey, GraphEdge[]>();
  const nodesByLayer = new Map<string, GraphNode[]>();
  const nodesByArchitectureLevel = new Map<string, GraphNode[]>();
  const nodesByApsLayer = new Map<string, GraphNode[]>();
  const layersByApsLayer = new Map<ApsLayer, GraphNode[]>();
  function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const values = map.get(key) ?? [];
    values.push(value);
    map.set(key, values);
  }
  for (const node of projection.nodes) append(nodesByType, node.entityType, node);
  for (const edge of projection.edges) {
    append(outgoingEdges, edge.source, edge);
    append(incomingEdges, edge.target, edge);
  }
  const layers = new Map((a.layers ?? []).map((layer) => [layer.id as string, layer]));
  function aps(id: string): ApsLayer | undefined {
    const visited = new Set<string>();
    let layer = layers.get(id);
    while (layer) {
      if (visited.has(layer.id)) throw new Error("Unexpected Layer cycle after validation.");
      visited.add(layer.id);
      if (layer.apsLayer) return layer.apsLayer;
      layer = layer.parentLayerId === undefined ? undefined : layers.get(layer.parentLayerId);
    }
    return undefined;
  }
  for (const layer of a.layers ?? []) {
    const classification = aps(layer.id);
    const node = nodeByKey.get(nodeKey("Layer", layer.id));
    if (classification && node) append(layersByApsLayer, classification, node);
  }
  function position(key: NodeKey, role: PositioningRole, layerId?: string, level?: string): void {
    const node = nodeByKey.get(key);
    if (!node) throw new Error("Positioned entity not indexed.");
    if (layerId !== undefined) {
      append(nodesByLayer, positioningKey(role, nodeKey("Layer", layerId)), node);
      const classification = aps(layerId);
      if (classification) append(nodesByApsLayer, positioningKey(role, classification), node);
    }
    if (level !== undefined) append(nodesByArchitectureLevel, positioningKey(role, level), node);
  }
  for (const e of a.elements ?? [])
    position(nodeKey("Element", e.id), "DIRECT", e.layerId, e.architectureLevel);
  for (const e of a.businessRules ?? [])
    position(nodeKey("BusinessRule", e.id), "LOGICAL", e.logicalLayerId);
  for (const e of a.ruleImplementations ?? [])
    position(nodeKey("RuleImplementation", e.id), "ACTUAL", e.actualLayerId, e.architectureLevel);
  for (const map of [nodesByLayer, nodesByArchitectureLevel, nodesByApsLayer, layersByApsLayer])
    for (const values of map.values()) values.sort((x, y) => ordinal(x.key, y.key));
  return {
    projection,
    nodeByKey,
    nodesByType,
    edgeByKey: new Map(projection.edges.map((e) => [e.key, e])),
    outgoingEdges,
    incomingEdges,
    nodesByLayer,
    nodesByArchitectureLevel,
    nodesByApsLayer,
    layersByApsLayer,
  };
}
