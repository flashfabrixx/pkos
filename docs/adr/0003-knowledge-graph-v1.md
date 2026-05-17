# ADR-0003: Knowledge Graph v1.1

**Status:** Accepted
**Date:** 2026-05-15

## Context

PKOS v1 stores documents, people, projects, tags, action items, decisions, insights, and chunks. These are useful, but they do not yet form a traversable knowledge graph.

The desired next step is a "knowledge wave": entities and relationships that accumulate over time and can be queried, visualized, and exported into Obsidian-compatible Markdown.

## Decision

Add a native graph layer:

- `entities`: canonical nodes across documents
- `entity_mentions`: document-level evidence that an entity appeared
- `knowledge_edges`: typed relationships between entities, with evidence and confidence

Keep this deterministic in v1.1. LLM relation extraction can replace or enrich the extractor later.

Supported v1.1 entity types:

- `document`
- `person`
- `project`
- `topic`
- `decision`
- `insight`
- `question`
- `tag`

Supported v1.1 relation types:

- `document_mentions`
- `mentioned_with`
- `belongs_to_project`
- `assigned_to`
- `decided_in`
- `insight_about`
- `question_about`
- `tagged_as`

Markdown archive output should include wikilinks for people, projects, tags, decisions, insights, and open questions. Obsidian can render those links, but PKOS remains the operational graph source.

## Consequences

Positive:

- first real graph API and graph view
- evidence-backed relationships
- Obsidian-compatible archive improves manual inspection
- future LLM extraction can target a clear schema

Tradeoffs:

- deterministic edges are approximate
- relation confidence is heuristic
- graph visualization is intentionally simple in v1.1
