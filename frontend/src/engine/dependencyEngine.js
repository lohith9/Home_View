/**
 * dependencyEngine.js — Parametric dependency graph for Home3D
 *
 * Implements:
 *   1. Dependency tracking (child → parent relationships)
 *   2. Update propagation (move parent → children follow)
 *   3. Detach logic (move child away → break dependency)
 *
 * Architecture:
 *   - Objects store `attachedTo: wallId` when attached to a wall
 *   - When a wall moves, all objects with `attachedTo === wallId` are updated
 *   - The child's position is recalculated based on its offset along the wall
 */

/**
 * getAttachedChildren — Find all objects attached to a given wall.
 *
 * @param {string} wallId - ID of the parent wall
 * @param {Array} objects - all objects in the scene
 * @returns {Array} objects that have attachedTo === wallId
 */
export const getAttachedChildren = (wallId, objects) =>
  objects.filter((obj) => obj.attachedTo === wallId);

/**
 * Calculate the position along a wall segment at parameter t ∈ [0,1].
 */
const interpolateWall = (wall, t) => ({
  x: wall.start[0] + (wall.end[0] - wall.start[0]) * t,
  y: wall.start[1] + (wall.end[1] - wall.start[1]) * t,
});

/**
 * Calculate the parameter t for a point on a wall segment (closest projection).
 */
const projectTOnWall = (x, y, wall) => {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, ((x - wall.start[0]) * dx + (y - wall.start[1]) * dy) / lenSq));
};

/**
 * propagateWallMove — When a wall is moved, compute updated positions
 * for all attached children (doors, windows, etc).
 *
 * Returns an array of { id, updates } to apply.
 *
 * @param {string} wallId - the wall that moved
 * @param {object} oldWall - wall state before move (start, end)
 * @param {object} newWall - wall state after move (start, end)
 * @param {Array} objects - all scene objects
 * @returns {Array<{id: string, updates: object}>}
 */
export const propagateWallMove = (wallId, oldWall, newWall, objects) => {
  const children = getAttachedChildren(wallId, objects);
  if (children.length === 0) return [];

  const updates = [];

  for (const child of children) {
    // Find the child's parametric position on the OLD wall
    const t = projectTOnWall(child.x || 0, child.y || 0, oldWall);

    // Compute new position on the NEW wall at the same t
    const newPos = interpolateWall(newWall, t);

    updates.push({
      id: child.id,
      updates: {
        x: Math.round(newPos.x),
        y: Math.round(newPos.y),
      },
    });
  }

  return updates;
};

/**
 * buildDependencyGraph — Construct a parent→children map for the entire scene.
 * Useful for visualization and debugging.
 *
 * @param {Array} objects
 * @returns {Map<string, string[]>} parentId → [childId, ...]
 */
export const buildDependencyGraph = (objects) => {
  const graph = new Map();

  for (const obj of objects) {
    if (obj.attachedTo) {
      if (!graph.has(obj.attachedTo)) {
        graph.set(obj.attachedTo, []);
      }
      graph.get(obj.attachedTo).push(obj.id);
    }
  }

  return graph;
};

/**
 * shouldDetach — Check if a child has been moved far enough from its
 * parent wall to break the dependency.
 *
 * @param {object} child - the child object
 * @param {Array} objects - all objects
 * @param {number} [threshold=30] - distance to trigger detach
 * @returns {boolean}
 */
export const shouldDetach = (child, objects, threshold = 30) => {
  if (!child.attachedTo) return false;

  const wall = objects.find((o) => o.id === child.attachedTo);
  if (!wall || wall.type !== 'wall') return true; // wall deleted

  // Project child onto wall and check distance
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return true;

  const t = Math.max(0, Math.min(1, (((child.x || 0) - wall.start[0]) * dx + ((child.y || 0) - wall.start[1]) * dy) / lenSq));
  const projX = wall.start[0] + t * dx;
  const projY = wall.start[1] + t * dy;
  const dist = Math.hypot((child.x || 0) - projX, (child.y || 0) - projY);

  return dist > threshold;
};

export default {
  getAttachedChildren,
  propagateWallMove,
  buildDependencyGraph,
  shouldDetach,
};
