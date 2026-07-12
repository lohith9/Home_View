# ADR-001: Gesture History API

## Status
Accepted (commits 871c122, 77401fe)

## Context
Undo history must snapshot once per user gesture (a drag emits dozens of
updates per second), but the store originally exposed only a private
`_pushHistory` method, which consumers (useDrag, Canvas3D) imported and called
directly. The invariant "call it exactly once before the first update of a
gesture" lived in convention, not in the API.

## Problem
- Private method used across module boundaries
- Two update methods (`updateObject` / `updateObjectWithHistory`) let call
  sites silently pick wrong history semantics

## Options considered
1. Keep `_pushHistory` public by renaming - smallest diff, keeps the hidden invariant
2. Transaction wrapper `withHistory(fn)` - explicit, but awkward across pointer events that span callbacks
3. First-class `beginGesture()` + options bag on `updateObject` - names the concept, works across event callbacks

## Decision
Option 3. `beginGesture()` is the public API for continuous interactions;
`updateObject(id, updates, { history: true })` covers atomic edits.
Old names remain as deprecated aliases so existing callers keep working.

## Consequences
- The gesture invariant is documented at the API, not in reviewers' heads
- Deprecated aliases must be removed once Canvas2D/Canvas3D migrate
- Misuse (beginGesture + history:true together) double-pushes - documented in JSDoc

## Future evolution
A gesture token (begin returns an id, updates carry it) would make misuse
impossible; not justified at current scale.
