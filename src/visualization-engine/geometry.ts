import type { AnchorSide, Point, RenderAnchor, RenderNode } from "./types.js";

export function anchors(
  x: number,
  y: number,
  width: number,
  height: number,
): Readonly<Record<AnchorSide, RenderAnchor>> {
  return {
    top: { x: x + width / 2, y, side: "top" },
    right: { x: x + width, y: y + height / 2, side: "right" },
    bottom: { x: x + width / 2, y: y + height, side: "bottom" },
    left: { x, y: y + height / 2, side: "left" },
  };
}
export function connectingAnchors(
  source: RenderNode,
  target: RenderNode,
): readonly [RenderAnchor, RenderAnchor] {
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  return horizontal
    ? target.x >= source.x
      ? [source.anchors.right, target.anchors.left]
      : [source.anchors.left, target.anchors.right]
    : target.y >= source.y
      ? [source.anchors.bottom, target.anchors.top]
      : [source.anchors.top, target.anchors.bottom];
}
export function routePath(source: Point, target: Point, offset = 0): string {
  const dx = target.x - source.x,
    dy = target.y - source.y,
    length = Math.max(Math.hypot(dx, dy), 1),
    nx = -dy / length,
    ny = dx / length,
    cx = (source.x + target.x) / 2 + nx * offset,
    cy = (source.y + target.y) / 2 + ny * offset;
  return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
}
export function clampViewport(viewport: {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}) {
  return { ...viewport, zoom: Math.min(4, Math.max(0.2, viewport.zoom)) };
}
