import type { InformationDescriptor } from "../visualization/index.js";

export function InformationCard({ descriptor }: { readonly descriptor?: InformationDescriptor }) {
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
