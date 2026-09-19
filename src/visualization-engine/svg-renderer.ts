import type { EntityReference, VisualizationView } from "../visualization/index.js";
import { clampViewport } from "./geometry.js";
import { layoutVisualization } from "./layout.js";
import type {
  EngineEventHandler,
  RendererConfiguration,
  RenderNode,
  RenderScene,
  ViewportState,
  VisualizationEngineEvent,
  VisualizationRenderer,
} from "./types.js";

const NS = "http://www.w3.org/2000/svg";
const sameReference = (node: RenderNode, reference: EntityReference) =>
  node.entityType === reference.entityType && node.entityId === reference.entityId;
export function createSvgRenderer(
  container: HTMLElement,
  configuration: RendererConfiguration = {},
): VisualizationRenderer {
  const document = container.ownerDocument,
    svg = document.createElementNS(NS, "svg"),
    viewportGroup = document.createElementNS(NS, "g");
  svg.setAttribute("class", "aether-svg");
  svg.setAttribute("role", "application");
  svg.setAttribute("aria-label", "AETHER architecture visualization");
  svg.setAttribute("tabindex", "0");
  viewportGroup.setAttribute("data-layer", "viewport");
  svg.append(viewportGroup);
  container.replaceChildren(svg);
  const handlers = new Set<EngineEventHandler>(),
    listeners: Array<readonly [EventTarget, string, EventListenerOrEventListenerObject]> = [];
  let viewport: ViewportState = { panX: 0, panY: 0, zoom: 1 },
    scene: RenderScene | undefined,
    dragging: undefined | { x: number; y: number; panX: number; panY: number };
  const emit = (event: VisualizationEngineEvent) => {
    for (const handler of handlers) handler(event);
  };
  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    target.addEventListener(type, listener);
    listeners.push([target, type, listener]);
  };
  const element = <K extends keyof SVGElementTagNameMap>(
    name: K,
    attributes: Readonly<Record<string, string>> = {},
  ): SVGElementTagNameMap[K] => {
    const result = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value);
    return result;
  };
  const applyViewport = () =>
    viewportGroup.setAttribute(
      "transform",
      `translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`,
    );
  function bindNode(group: SVGGElement, node: RenderNode): void {
    const reference: EntityReference = { entityType: node.entityType, entityId: node.entityId };
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute(
      "aria-label",
      `${node.entityType}: ${node.label}. Enter selects, F focuses, E expands.`,
    );
    listen(group, "click", () => emit({ type: "selectionRequested", reference }));
    listen(group, "keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        emit({ type: "selectionRequested", reference });
      } else if (key.toLowerCase() === "f") emit({ type: "focusRequested", reference });
      else if (key.toLowerCase() === "e") emit({ type: "expansionRequested", reference });
    });
    listen(group, "pointerenter", () => group.classList.add("is-hovered"));
    listen(group, "pointerleave", () => group.classList.remove("is-hovered"));
  }
  function clearRenderListeners(): void {
    for (let i = listeners.length - 1; i >= 0; i -= 1) {
      const registration = listeners[i]!;
      if (registration[0] === svg) continue;
      registration[0].removeEventListener(registration[1], registration[2]);
      listeners.splice(i, 1);
    }
  }
  function draw(view: VisualizationView): void {
    clearRenderListeners();
    scene = layoutVisualization(view, configuration);
    viewportGroup.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`);
    const defs = element("defs");
    for (const [id, cssClass] of [
      ["edge-arrow", "aether-edge-arrow"],
      ["flow-arrow", "aether-flow-arrow"],
    ] as const) {
      const marker = element("marker", {
        id,
        markerWidth: "8",
        markerHeight: "8",
        refX: "7",
        refY: "4",
        orient: "auto",
        markerUnits: "strokeWidth",
      });
      marker.append(element("path", { d: "M 0 0 L 8 4 L 0 8 z", class: cssClass }));
      defs.append(marker);
    }
    viewportGroup.append(defs);
    const background = element("g", { "data-layer": "regions" });
    for (const region of scene.regions) {
      const group = element("g", {
        "data-region-key": region.key,
        class: `aether-region aether-region--${region.kind.toLowerCase()}`,
      });
      group.append(
        element("rect", {
          x: String(region.x),
          y: String(region.y),
          width: String(region.width),
          height: String(region.height),
          rx: "4",
        }),
      );
      const text = element("text", { x: String(region.x + 8), y: String(region.y + 20) });
      text.textContent = region.label;
      group.append(text);
      background.append(group);
    }
    for (let i = 0; i < scene.columns.length; i += 1) {
      const width = configuration.cellWidth ?? 240,
        text = element("text", {
          x: String(140 + i * width + width / 2),
          y: "34",
          class: "aether-column-label",
          "text-anchor": "middle",
        });
      text.textContent = scene.columns[i]!.label;
      background.append(text);
    }
    viewportGroup.append(background);
    const edgeLayer = element("g", { "data-layer": "edges" });
    for (const edge of scene.edges) {
      const path = element("path", {
        d: edge.path,
        class: `aether-edge is-${edge.emphasis.toLowerCase()}`,
        "data-edge-key": edge.key,
        "data-edge-type": edge.edgeType,
        "marker-end": `url(#${edge.markerEnd})`,
        tabindex: "0",
        role: "button",
        "aria-label": `${edge.edgeType} directed edge`,
      });
      listen(path, "click", () => emit({ type: "edgeInspected", graphEdgeKey: edge.key }));
      edgeLayer.append(path);
    }
    viewportGroup.append(edgeLayer);
    const routeLayer = element("g", { "data-layer": "routes" });
    for (const [routeIndex, route] of scene.routes.entries()) {
      const routeControl = element("text", {
        x: "16",
        y: String(30 + routeIndex * 18),
        class: "aether-route-label",
        "data-flow-key": route.key,
        tabindex: "0",
        role: "button",
        "aria-label": "Select flow",
      });
      routeControl.textContent = `Flow ${route.flow.entityId}`;
      listen(routeControl, "click", () => emit({ type: "flowSelected", reference: route.flow }));
      listen(routeControl, "keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") emit({ type: "flowSelected", reference: route.flow });
      });
      routeLayer.append(routeControl);
      for (const segment of route.segments) {
        const group = element("g", {
          "data-flow-key": route.key,
          "data-segment-key": segment.key,
          class: `aether-route-segment is-${segment.status.toLowerCase()}`,
          tabindex: "0",
          role: "button",
          "aria-label": `Flow segment ${segment.sequence}, ${segment.status.toLowerCase()}`,
        });
        if (segment.path)
          group.append(element("path", { d: segment.path, "marker-end": "url(#flow-arrow)" }));
        else {
          const warning = element("text", {
            x: "16",
            y: String(48 + segment.sequence * 18),
            class: "aether-route-warning",
          });
          warning.textContent = `Segment ${segment.sequence}: incomplete visual evidence`;
          group.append(warning);
        }
        listen(group, "click", () =>
          emit({ type: "flowSegmentSelected", reference: segment.segment }),
        );
        routeLayer.append(group);
      }
    }
    viewportGroup.append(routeLayer);
    const nodeLayer = element("g", { "data-layer": "nodes" });
    for (const node of scene.nodes) {
      const classes = [
          "aether-node",
          `aether-node--${node.kind}`,
          `is-${node.exposure.toLowerCase()}`,
          node.focused ? "is-focused" : "",
          node.selected ? "is-selected" : "",
          node.attenuated ? "is-attenuated" : "",
          node.degraded ? "is-degraded" : "",
        ]
          .filter(Boolean)
          .join(" "),
        group = element("g", {
          transform: `translate(${node.x} ${node.y})`,
          class: classes,
          "data-node-key": node.key,
          "data-entity-type": node.entityType,
          "data-entity-id": node.entityId,
        });
      const title = element("title");
      title.textContent = node.label;
      group.append(title);
      group.append(
        element("rect", {
          width: String(node.width),
          height: String(node.height),
          rx: node.kind === "chip" ? "18" : "7",
        }),
      );
      const type = element("text", { x: "10", y: "17", class: "aether-node-type" });
      type.textContent = node.entityType;
      group.append(type);
      const words = node.label.split(/\s+/),
        lines = [""];
      for (const word of words) {
        const last = lines.length - 1,
          candidate = `${lines[last]} ${word}`.trim();
        if (candidate.length > 25 && lines[last] && lines.length < 2) lines.push(word);
        else lines[last] = candidate;
      }
      if (lines[1] && lines[1].length > 25) lines[1] = `${lines[1].slice(0, 22)}...`;
      const text = element("text", { x: "10", y: "38", class: "aether-node-label" });
      for (const [index, line] of lines.entries()) {
        const span = element("tspan", { x: "10", dy: index === 0 ? "0" : "13" });
        span.textContent = line;
        text.append(span);
      }
      group.append(text);
      if (node.focused) {
        const badge = element("text", {
          x: String(node.width - 9),
          y: "16",
          class: "aether-state-badge",
          "text-anchor": "end",
        });
        badge.textContent = "FOCUS";
        group.append(badge);
      }
      if (node.selected) {
        const badge = element("text", {
          x: String(node.width - 9),
          y: String(node.height - 8),
          class: "aether-state-badge",
          "text-anchor": "end",
        });
        badge.textContent = "SELECTED";
        group.append(badge);
      }
      for (const anchor of Object.values(node.anchors))
        group.append(
          element("circle", {
            cx: String(anchor.x - node.x),
            cy: String(anchor.y - node.y),
            r: "2",
            class: "aether-anchor",
            "data-anchor": anchor.side,
          }),
        );
      bindNode(group, node);
      nodeLayer.append(group);
    }
    viewportGroup.append(nodeLayer);
    applyViewport();
  }
  function changeViewport(next: ViewportState, notify: boolean): ViewportState {
    viewport = clampViewport(next);
    applyViewport();
    if (notify) emit({ type: "viewportChanged", viewport });
    return viewport;
  }
  listen(svg, "wheel", (event) => {
    const wheel = event as WheelEvent;
    wheel.preventDefault();
    changeViewport({ ...viewport, zoom: viewport.zoom * (wheel.deltaY < 0 ? 1.1 : 0.9) }, true);
  });
  listen(svg, "pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button === 0)
      dragging = {
        x: pointer.clientX,
        y: pointer.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      };
  });
  listen(svg, "pointermove", (event) => {
    if (!dragging) return;
    const pointer = event as PointerEvent;
    changeViewport(
      {
        ...viewport,
        panX: dragging.panX + pointer.clientX - dragging.x,
        panY: dragging.panY + pointer.clientY - dragging.y,
      },
      true,
    );
  });
  listen(svg, "pointerup", () => {
    dragging = undefined;
  });
  listen(svg, "pointercancel", () => {
    dragging = undefined;
  });
  listen(svg, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") emit({ type: "selectionCleared" });
  });
  return {
    render: draw,
    updateViewport: (next) => {
      changeViewport(next, false);
    },
    getViewport: () => ({ ...viewport }),
    getScene: () => scene,
    fitToView: () => {
      if (!scene) return viewport;
      const width = Math.max(container.clientWidth, 1),
        height = Math.max(container.clientHeight, 1),
        zoom = Math.min(width / scene.width, height / scene.height, 1) * 0.94;
      return changeViewport(
        { panX: (width - scene.width * zoom) / 2, panY: (height - scene.height * zoom) / 2, zoom },
        true,
      );
    },
    locate: (reference) => {
      if (!scene) return undefined;
      const node = scene.nodes.find((candidate) => sameReference(candidate, reference));
      if (!node) return undefined;
      const width = Math.max(container.clientWidth, 1),
        height = Math.max(container.clientHeight, 1);
      return changeViewport(
        {
          panX: width / 2 - (node.x + node.width / 2) * viewport.zoom,
          panY: height / 2 - (node.y + node.height / 2) * viewport.zoom,
          zoom: viewport.zoom,
        },
        true,
      );
    },
    onEvent: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    destroy: () => {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
      handlers.clear();
      dragging = undefined;
      scene = undefined;
      container.replaceChildren();
    },
  };
}
