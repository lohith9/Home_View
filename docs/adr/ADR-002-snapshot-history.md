# ADR-002: Snapshot-Based Undo History

## Status
Accepted (reaffirmed during store review, commit 871c122)

## Context
Undo/redo must work across two views (2D canvas, 3D scene) that share one
design store. History depth is bounded at 50 entries.

## Problem
Choose a history representation: full-state snapshots, command pattern
(inverse operations), or structural sharing (patches).

## Options considered
1. Snapshots (deep clone of the objects array per entry) - simple, impossible to desync, O(scene size) memory per entry
2. Command pattern - O(1) per action, but every action needs a correct inverse; bugs corrupt history silently
3. Immer patches / structural sharing - compact and fast, adds a dependency and indirection

## Decision
Snapshots, with two refinements from review:
- `structuredClone` (native) replaces the JSON round-trip: faster, and fails
  loudly on non-cloneable values instead of silently mangling them
- Snapshots are taken per gesture (see ADR-001), not per pointer event

At floor-plan scale (hundreds of objects, ~100 bytes each) a 50-deep history
costs well under 1 MB - simplicity wins.

## Consequences
- Every mutation path stays immutable; the clone is defense-in-depth
- Clone cost is the known scalability ceiling, measured against scene size
- Undo currently clears selection; snapshotting selection is future work

## Future evolution
If profiling at larger scenes shows clone cost, migrate to Immer patches -
the gesture API boundary (ADR-001) is exactly where patch capture would slot in.
