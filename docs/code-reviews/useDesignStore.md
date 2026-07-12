# Code Review Record — useDesignStore.js

Status: **APPROVED** (after fixes in 871c122, 77401fe)

## Purpose

Single source of truth for spatial design data: objects, selection, undo/redo history, and persistence. Both the 2D canvas and 3D scene are projections of this store.

## Responsibilities

- CRUD on design objects (walls, furniture, doors, windows)
- Selection state (single, toggle, multi)
- Z-ordering (bring forward / send backward)
- Snapshot-based undo/redo, bounded at 50 entries
- localStorage save/load and design import

## Architecture

- Zustand store, no component imports (dependencies point inward only)
- All mutations are immutable (map + spread); history entries are defensive deep clones
- Gesture concept: `beginGesture()` snapshots once at the start of a continuous
  interaction (drag/resize), so the whole gesture undoes as one step. Atomic edits
  pass `{ history: true }` to `updateObject` instead.

## Why this design exists

Snapshot history was chosen over a command pattern for simplicity: at floor-plan
scale (hundreds of objects), cloning the object array is measurably cheap, and
snapshot code is much harder to get wrong than per-action inverse commands.
See ADR-002.

## Trade-offs

- Deep clone per history push is O(total object size); acceptable now, becomes the
  ceiling at thousands of objects. Escape hatch: structural sharing (e.g. Immer patches).
- `updateObject` without history is the hot path for drags; history semantics are
  explicit at call sites via the options bag.

## Known limitations

- `undo()`/`redo()` clear the current selection (UX decision pending)
- IDs are timestamp+random, not `crypto.randomUUID()`
- `loadDesign` does not validate object shapes; corrupted storage can produce
  invalid objects downstream
- `saveDesign` does not handle localStorage quota errors
- No unit tests yet (engine + store are the first vitest targets)

## Future improvements

- Snapshot selection with history entries
- Versioned migration on load (`version` field is written but not yet checked)
- Structural sharing for history if profiling shows clone cost matters

## Interview discussion

- Why snapshots over command pattern, and where the crossover point is
- How the gesture API prevents 60 history entries per second during a drag
- Why UI state (pan/zoom/tools) lives in a separate store
- How you would evolve this to multiplayer (CRDT per object, history per client)

## Lessons learned

- Deriving z-index from array length collides after deletions — derive from max
- A private method (`_pushHistory`) used across module boundaries is API design
  debt; making the gesture concept first-class removed the hidden invariant
