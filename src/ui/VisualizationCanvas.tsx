import { useEffect, useRef } from "react";
import { createSvgRenderer } from "../visualization-engine/index.js";
import type {
  ViewportState,
  VisualizationEngineEvent,
  VisualizationRenderer,
} from "../visualization-engine/index.js";
import type { EntityReference, VisualizationView } from "../visualization/index.js";

export interface VisualizationCanvasProps {
  readonly view: VisualizationView;
  readonly viewport: ViewportState;
  readonly onEvent: (event: VisualizationEngineEvent) => void;
  readonly rendererRef: { current: VisualizationRenderer | null };
  readonly locate?: EntityReference;
}
export function VisualizationCanvas({
  view,
  viewport,
  onEvent,
  rendererRef,
  locate,
}: VisualizationCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const renderer = createSvgRenderer(host.current);
    rendererRef.current = renderer;
    const unsubscribe = renderer.onEvent(onEvent);
    return () => {
      unsubscribe();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [onEvent, rendererRef]);
  useEffect(() => {
    rendererRef.current?.render(view);
  }, [rendererRef, view]);
  useEffect(() => {
    rendererRef.current?.updateViewport(viewport);
  }, [rendererRef, viewport]);
  useEffect(() => {
    if (locate) rendererRef.current?.locate(locate);
  }, [locate, rendererRef]);
  return <div ref={host} className="visualization-host" aria-label="Architecture canvas" />;
}
