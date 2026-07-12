# Performance

Budgets, hot paths, and the optimization roadmap. Estimates are from code
review; items marked (measure) need profiling before action. Rule: we do not
optimize what we have not measured.

## Hot paths

| Path | Frequency | Cost today | Ceiling | Fix when measured |
|---|---|---|---|---|
| Constraint resolve | per pointer move (~60Hz during drag) | O(n) scan of all objects | ~10K-50K objects | quadtree behind same engine API |
| Collision check | per drag event | O(n) AABB sweep | same | shared spatial index |
| History push | once per gesture (ADR-001) | O(scene) structuredClone | ~5K objects x 50 deep | Immer patches (ADR-002 exit) |
| 3D render | per frame | 1 draw call per object, no instancing | ~2K-5K objects | InstancedMesh per furniture type |
| Store subscription | per mutation | whole-store destructuring in Canvas3D re-renders all objects | felt at ~1K objects | selector subscriptions + React.memo |

## Cold paths (fine as-is)

- Save/load (user-initiated, small payloads)
- Z-order changes, duplication, selection

## Bundle

- three + drei + fiber: roughly 600-700 KB gz before app code (measure with rollup-plugin-visualizer)
- Biggest single win: lazy-load the 3D view; most sessions start in 2D
- Second win: manual vendor chunk so app iteration does not re-download three

## Choosing a spatial index (education record)

Why quadtree is the recommendation when the O(n) sweep expires:

| Structure | Query | Update | Memory | Best for | Used by |
|---|---|---|---|---|---|
| Uniform grid / spatial hash | O(1) avg | O(1) | high for sparse scenes | uniform object sizes, physics broadphase | many 2D game engines |
| Quadtree | O(log n) | O(log n) | proportional to occupancy | 2D, mixed sizes, mixed density - our case | maps, 2D editors |
| BVH | O(log n) | costly rebuilds | compact | static 3D meshes, raycasting | three.js raycast acceleration, renderers |
| KD-tree | O(log n) | poor under mutation | compact | static point data, nearest-neighbor | photogrammetry, ML |
| R-tree | O(log n) | good with bulk loads | moderate | disk-backed rectangles | PostGIS, spatial databases |

Reasoning: our workload is 2D rectangles, dynamic (constant drags), mixed
density. KD/BVH degrade under mutation; R-tree shines on disk, not in a
browser heap; spatial hash wastes memory on floor plans that are mostly empty.
Quadtree matches the access pattern and stays debuggable. Figma-style editors
solve this with tiles + GPU-side culling; CAD systems use R-trees because
drawings do not fit in memory; game engines use grids/BVH per frame budget.
Different constraints, different winners - the lesson is matching structure
to workload, not memorizing a favorite.

## Budgets (to enforce in CI later)

- Initial JS (2D route): < 300 KB gz
- Pointer-move handler: < 4 ms at 1K objects
- 3D view: 60 fps at 500 objects on integrated graphics
- Undo latency: < 16 ms at 2K objects
