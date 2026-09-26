import type { NavigationOption } from "../navigation/index.js";
import type { EntityReference, InformationDescriptor } from "../visualization/index.js";

export interface InformationCardProps {
  readonly descriptor?: InformationDescriptor;
  readonly navigationOptions?: readonly NavigationOption[];
  readonly onOpen?: (reference: EntityReference) => void;
  readonly onFocus?: (reference: EntityReference) => void;
  readonly onOpenContext?: (reference: EntityReference) => void;
  readonly onOpenRelated?: (option: NavigationOption) => void;
}
export function InformationCard({
  descriptor,
  navigationOptions = [],
  onOpen,
  onFocus,
  onOpenContext,
  onOpenRelated,
}: InformationCardProps) {
  if (!descriptor)
    return (
      <section className="information-card" aria-label="Information">
        <h2>Information</h2>
        <p>Select an entity to inspect it.</p>
      </section>
    );
  return (
    <section className="information-card" aria-label="Information">
      <h2>{descriptor.label ?? descriptor.reference.entityId}</h2>
      <p className="entity-type">{descriptor.reference.entityType}</p>
      {descriptor.description && <p>{descriptor.description}</p>}
      <div className="information-actions">
        <button onClick={() => onOpen?.(descriptor.reference)}>Open</button>
        <button onClick={() => onFocus?.(descriptor.reference)}>Focus</button>
        <button onClick={() => onOpenContext?.(descriptor.reference)}>Show context</button>
      </div>
      <dl>
        <dt>Position</dt>
        <dd>
          {descriptor.semanticPosition.apsLayer ?? "APS not specified"} /{" "}
          {descriptor.semanticPosition.architectureLevel ??
            descriptor.semanticPosition.presentationLevel ??
            "level not specified"}
        </dd>
        <dt>Relations</dt>
        <dd>{descriptor.relations.length}</dd>
        <dt>Decisions</dt>
        <dd>{descriptor.decisions.length}</dd>
      </dl>
      {navigationOptions.length > 0 && (
        <details>
          <summary>Related destinations</summary>
          <ul className="related-list">
            {navigationOptions.map((option) => (
              <li
                key={`${option.edgeKey}:${option.target.reference.entityType}:${option.target.reference.entityId}`}
              >
                <button onClick={() => onOpenRelated?.(option)}>
                  {option.direction === "inverse" ? "←" : "→"} {option.target.reference.entityType}:{" "}
                  {option.target.reference.entityId}
                </button>
                <small>{option.edgeType}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
      {descriptor.route && (
        <details>
          <summary>Flow route</summary>
          <ol>
            {descriptor.route.segments.map((segment) => (
              <li key={segment.graphNodeKey}>
                Segment {segment.sequence}: {segment.source.entityId} → {segment.target.entityId}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
