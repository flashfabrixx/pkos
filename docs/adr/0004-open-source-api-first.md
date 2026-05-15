# ADR 0004: Open Source And API-First Direction

## Status

Accepted

## Context

BKOS should become useful as an open-source project before its architecture is fully mature. That means code and documentation need to be understandable to outside readers, not only to the original operator.

The system should also be usable by other tools over time. Examples include browser-visible API documentation, Codex skills, MCP servers, and integrations with document systems such as Paperarchive.

## Decision

BKOS will keep the v1 implementation simple, but the project structure should preserve clear public boundaries:

- server routes are treated as future public API surfaces
- request and response shapes should stay typed and documentable
- workflows remain modular: capture, extraction, archive, retrieval, graph, actions
- database changes use explicit SQL migrations
- decisions that affect contributors or integrations are captured as ADRs
- secrets never appear in repository docs or examples

Nuxt remains the single fullstack runtime for now. A separate API service is not introduced until real integration pressure requires it.

## Consequences

Future work should add generated OpenAPI or comparable route documentation. Until then, route handlers should stay small, explicit, and easy to document.

Agentic integrations should talk to BKOS through stable HTTP APIs first. Direct database access should be reserved for local development and migrations.
