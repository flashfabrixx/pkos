# ADR-0001: Separate PKOS Repository

**Status:** Accepted
**Date:** 2026-05-15

## Context

PKOS started as a personal knowledge and operations system. PKOS has a different operating context: business transcripts, employee and colleague conversations, structured action tracking, stronger authentication requirements, and stricter data classification.

Keeping PKOS inside PKOS would couple two systems with different privacy boundaries, deployment concerns, and product surfaces.

## Decision

PKOS is a standalone repository.

PKOS may be used as a reference implementation for capture, indexing, search, and markdown-based storage, but PKOS owns its own application structure, schemas, auth, deployment, and data model.

## Consequences

Positive:

- clearer mental model
- cleaner security and data boundaries
- independent deployment and CI/CD
- easier path toward a product-like web application

Tradeoff:

- some early duplication with PKOS is acceptable
- shared packages should be extracted later, only after the boundaries are proven
