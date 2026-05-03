/**
 * constraintEngine.js — Constraint resolution for Home3D
 *
 * Implements:
 *   1. Grid snap (configurable grid size)
 *   2. Wall-attach (doors/windows attach to nearest wall segment)
 *   3. Edge alignment (align centers & edges of nearby objects)
 *   4. Corner snap (wall endpoints connect to nearby wall endpoints)
 *   5. Angle constraint (snap rotation to 0°, 90°, 180°, 270°)
 *
 * Every constraint candidate is scored by (distance × priority_weight).
 * The engine returns the best resolved position, visual guide lines,
 * and optional attachment metadata.
 */

const DEFAULT_GRID = 20;
const SNAP_THRESHOLD = 12;
const WALL_ATTACH_THRESHOLD = 25;
const CORNER_SNAP_THRESHOLD = 15;

// ── Helpers ──────────────────────────────────────────────────────────

const snapToGrid = (value, grid = DEFAULT_GRID) =>
  Math.round(value / grid) * grid;

const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/**
 * Project a point onto a line segment and return the closest point + distance.
 */
const projectOntoSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, dist: dist(px, py, ax, ay), t: 0 };

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return { x: projX, y: projY, dist: dist(px, py, projX, projY), t };
};

// ── Constraint Types ─────────────────────────────────────────────────

/**
 * 1. GRID SNAP — snap x, y to nearest grid intersection.
 */
const gridSnap = (x, y, gridSize = DEFAULT_GRID) => ({
  x: snapToGrid(x, gridSize),
  y: snapToGrid(y, gridSize),
  guides: [],
  type: 'grid',
  priority: 1,
  distance: 0,
});

/**
 * 2. EDGE ALIGNMENT — align centers and edges to other objects.
 *    Returns an array of candidate snaps (one per axis match).
 */
const edgeAlignment = (x, y, objects, excludeId) => {
  const candidates = [];

  for (const obj of objects) {
    if (obj.id === excludeId) continue;

    let centers = [];
    if (obj.type === 'wall') {
      centers = [
        { x: obj.start[0], y: obj.start[1] },
        { x: obj.end[0], y: obj.end[1] },
        { x: (obj.start[0] + obj.end[0]) / 2, y: (obj.start[1] + obj.end[1]) / 2 },
      ];
    } else {
      const cx = obj.x || 0;
      const cy = obj.y || 0;
      const w = obj.width || 100;
      const h = obj.height || 100;
      centers = [
        { x: cx, y: cy },
        { x: cx - w / 2, y: cy },
        { x: cx + w / 2, y: cy },
        { x: cx, y: cy - h / 2 },
        { x: cx, y: cy + h / 2 },
      ];
    }

    for (const c of centers) {
      const dxAbs = Math.abs(x - c.x);
      const dyAbs = Math.abs(y - c.y);

      if (dxAbs < SNAP_THRESHOLD) {
        candidates.push({
          axis: 'x',
          value: c.x,
          distance: dxAbs,
          guide: { type: 'v', pos: c.x },
          priority: 2,
        });
      }
      if (dyAbs < SNAP_THRESHOLD) {
        candidates.push({
          axis: 'y',
          value: c.y,
          distance: dyAbs,
          guide: { type: 'h', pos: c.y },
          priority: 2,
        });
      }
    }
  }

  return candidates;
};

/**
 * 3. WALL-ATTACH — doors/windows snap onto the nearest wall segment.
 *    Returns the projected point on the wall + attachment metadata.
 */
const wallAttach = (x, y, objectType, objects) => {
  if (objectType !== 'door' && objectType !== 'window') return null;

  let best = null;
  let bestDist = WALL_ATTACH_THRESHOLD;

  for (const obj of objects) {
    if (obj.type !== 'wall') continue;

    const proj = projectOntoSegment(
      x, y,
      obj.start[0], obj.start[1],
      obj.end[0], obj.end[1],
    );

    if (proj.dist < bestDist) {
      bestDist = proj.dist;
      best = {
        x: proj.x,
        y: proj.y,
        distance: proj.dist,
        wallId: obj.id,
        t: proj.t,
        type: 'wall-attach',
        priority: 5, // highest priority
        guides: [
          { type: 'attach', x1: x, y1: y, x2: proj.x, y2: proj.y, wallId: obj.id },
        ],
      };
    }
  }

  return best;
};

/**
 * 4. CORNER SNAP — wall endpoints connect to nearby wall endpoints.
 */
const cornerSnap = (x, y, objects, excludeId) => {
  let best = null;
  let bestDist = CORNER_SNAP_THRESHOLD;

  for (const obj of objects) {
    if (obj.id === excludeId || obj.type !== 'wall') continue;

    for (const endpoint of [obj.start, obj.end]) {
      const d = dist(x, y, endpoint[0], endpoint[1]);
      if (d < bestDist) {
        bestDist = d;
        best = {
          x: endpoint[0],
          y: endpoint[1],
          distance: d,
          wallId: obj.id,
          type: 'corner',
          priority: 4,
          guides: [
            { type: 'v', pos: endpoint[0] },
            { type: 'h', pos: endpoint[1] },
          ],
        };
      }
    }
  }

  return best;
};

/**
 * 5. ANGLE CONSTRAINT — snap rotation to nearest allowed angle.
 */
export const constrainAngle = (degrees, step = 15) =>
  Math.round(degrees / step) * step;

// ── Main Resolver ────────────────────────────────────────────────────

/**
 * resolveConstraints — Given a raw position and context, return the
 * best constrained position, visual guides, and attachment info.
 *
 * @param {number} rawX - unconstrained X
 * @param {number} rawY - unconstrained Y
 * @param {object} options
 * @param {string} options.excludeId - ID of the object being moved
 * @param {string} options.objectType - type of the object ('door', 'window', 'furniture', 'wall')
 * @param {Array}  options.objects - all objects in the scene
 * @param {number} [options.gridSize] - grid cell size
 * @returns {{ x: number, y: number, guides: Array, attachment: object|null }}
 */
export const resolveConstraints = (rawX, rawY, options = {}) => {
  const {
    excludeId = null,
    objectType = 'furniture',
    objects = [],
    gridSize = DEFAULT_GRID,
  } = options;

  // Use a fine grid (1px) for non-wall objects so users can place furniture exactly where they want.
  // Walls remain on the coarse grid (20px) to keep structural geometry clean.
  const activeGrid = objectType === 'wall' ? gridSize : 1;

  // Start with grid snap as baseline
  const base = gridSnap(rawX, rawY, activeGrid);
  let resolvedX = base.x;
  let resolvedY = base.y;
  const guides = [];
  let attachment = null;

  // 1. Check wall-attach for doors/windows (highest priority)
  const attach = wallAttach(rawX, rawY, objectType, objects);
  if (attach) {
    resolvedX = attach.x;
    resolvedY = attach.y;
    attachment = {
      wallId: attach.wallId,
      t: attach.t,
      type: attach.type,
    };
    guides.push(...attach.guides);
    return { x: resolvedX, y: resolvedY, guides, attachment };
  }

  // 2. Edge alignment — collect per-axis candidates
  const edgeCandidates = edgeAlignment(rawX, rawY, objects, excludeId);

  // Pick best X-axis snap
  const xCandidates = edgeCandidates
    .filter((c) => c.axis === 'x')
    .sort((a, b) => a.distance - b.distance);
  if (xCandidates.length > 0) {
    resolvedX = xCandidates[0].value;
    guides.push(xCandidates[0].guide);
  }

  // Pick best Y-axis snap
  const yCandidates = edgeCandidates
    .filter((c) => c.axis === 'y')
    .sort((a, b) => a.distance - b.distance);
  if (yCandidates.length > 0) {
    resolvedY = yCandidates[0].value;
    guides.push(yCandidates[0].guide);
  }

  // 3. Corner snap (walls only)
  if (objectType === 'wall') {
    const corner = cornerSnap(resolvedX, resolvedY, objects, excludeId);
    if (corner) {
      resolvedX = corner.x;
      resolvedY = corner.y;
      guides.push(...corner.guides);
      return { x: resolvedX, y: resolvedY, guides, attachment };
    }
  };

  return { x: resolvedX, y: resolvedY, guides, attachment };
};

/**
 * resolveWallEndpoint — Specialized constraint for wall endpoints.
 * Applies corner-snap (connect to other wall endpoints) + grid snap.
 *
 * @param {number} rawX
 * @param {number} rawY
 * @param {Array}  objects
 * @param {string} excludeId
 * @param {number} [gridSize]
 * @returns {{ x: number, y: number, guides: Array, connectedTo: object|null }}
 */
export const resolveWallEndpoint = (rawX, rawY, objects, excludeId, gridSize = DEFAULT_GRID) => {
  const corner = cornerSnap(rawX, rawY, objects, excludeId);

  if (corner) {
    return {
      x: corner.x,
      y: corner.y,
      guides: corner.guides,
      connectedTo: { wallId: corner.wallId },
    };
  }

  // Fall back to grid + edge alignment
  const result = resolveConstraints(rawX, rawY, {
    excludeId,
    objectType: 'wall',
    objects,
    gridSize,
  });

  return { ...result, connectedTo: null };
};

export default {
  resolveConstraints,
  resolveWallEndpoint,
  constrainAngle,
};
