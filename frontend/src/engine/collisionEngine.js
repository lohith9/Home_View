/**
 * collisionEngine.js — Collision detection and boundary enforcement for Home3D
 *
 * Implements:
 *   1. AABB overlap detection between furniture objects
 *   2. Wall boundary enforcement (furniture stays outside walls)
 *   3. Object-to-object clearance (minimum gap)
 *   4. Collision query (check if a position is valid)
 *
 * Architecture:
 *   checkCollision(candidatePos, candidateSize, objects, excludeId)
 *     → { collides: boolean, correctedPos, collidingIds }
 */

const MIN_CLEARANCE = 2; // minimum pixel gap between objects

// ── AABB helpers ─────────────────────────────────────────────────────

/**
 * Get the axis-aligned bounding box of an object.
 * For walls, returns a thin rect along the wall line.
 * For furniture, returns center-based rect.
 */
const getAABB = (obj) => {
  if (obj.type === 'wall') {
    const [x1, y1] = obj.start;
    const [x2, y2] = obj.end;
    const thickness = (obj.thickness || 10) / 2 + 2;
    return {
      left: Math.min(x1, x2) - thickness,
      top: Math.min(y1, y2) - thickness,
      right: Math.max(x1, x2) + thickness,
      bottom: Math.max(y1, y2) + thickness,
    };
  }

  const x = obj.x || 0;
  const y = obj.y || 0;
  const w = obj.width || 100;
  const h = obj.height || 100;
  const hw = w / 2;
  const hh = h / 2;

  return {
    left: x - hw,
    top: y - hh,
    right: x + hw,
    bottom: y + hh,
  };
};

/**
 * Check if two AABBs overlap.
 */
const aabbOverlap = (a, b) =>
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom &&
  a.bottom > b.top;

/**
 * Calculate overlap penetration between two AABBs.
 * Returns the minimal displacement vector to resolve the collision.
 */
const getOverlapResolution = (moving, stationary) => {
  const overlapLeft = moving.right - stationary.left;
  const overlapRight = stationary.right - moving.left;
  const overlapTop = moving.bottom - stationary.top;
  const overlapBottom = stationary.bottom - moving.top;

  const minOverlapX = overlapLeft < overlapRight
    ? -overlapLeft - MIN_CLEARANCE
    : overlapRight + MIN_CLEARANCE;
  const minOverlapY = overlapTop < overlapBottom
    ? -overlapTop - MIN_CLEARANCE
    : overlapBottom + MIN_CLEARANCE;

  // Push in the axis with the smallest overlap
  if (Math.abs(minOverlapX) < Math.abs(minOverlapY)) {
    return { dx: minOverlapX, dy: 0 };
  }
  return { dx: 0, dy: minOverlapY };
};

// ── Main API ─────────────────────────────────────────────────────────

/**
 * checkCollision — Given a candidate position for an object, check if it
 * collides with any other objects and return a corrected position.
 *
 * @param {number} x - candidate center X
 * @param {number} y - candidate center Y
 * @param {object} movingObj - the object being moved (needs width, height, type)
 * @param {Array} objects - all objects in the scene
 * @param {string} excludeId - ID of the object being moved (exclude from checks)
 * @returns {{ collides: boolean, x: number, y: number, collidingIds: string[] }}
 */
export const checkCollision = (x, y, movingObj, objects, excludeId) => {
  // Doors and windows are allowed to overlap walls (they attach to walls)
  const isDoorOrWindow = movingObj.type === 'door' || movingObj.type === 'window';

  const candidateAABB = {
    left: x - (movingObj.width || 100) / 2,
    top: y - (movingObj.height || 100) / 2,
    right: x + (movingObj.width || 100) / 2,
    bottom: y + (movingObj.height || 100) / 2,
  };

  const collidingIds = [];
  let correctedX = x;
  let correctedY = y;
  let hasCollision = false;

  for (const obj of objects) {
    if (obj.id === excludeId) continue;

    // Doors/windows can overlap walls (they live on walls)
    if (isDoorOrWindow && obj.type === 'wall') continue;

    // Walls don't collide with walls (they can cross for T/L junctions)
    if (movingObj.type === 'wall' && obj.type === 'wall') continue;

    const objAABB = getAABB(obj);

    if (aabbOverlap(candidateAABB, objAABB)) {
      hasCollision = true;
      collidingIds.push(obj.id);

      // Calculate push-out vector
      const resolution = getOverlapResolution(candidateAABB, objAABB);
      correctedX += resolution.dx;
      correctedY += resolution.dy;

      // Update candidate AABB for chain resolution
      candidateAABB.left += resolution.dx;
      candidateAABB.right += resolution.dx;
      candidateAABB.top += resolution.dy;
      candidateAABB.bottom += resolution.dy;
    }
  }

  return {
    collides: hasCollision,
    x: correctedX,
    y: correctedY,
    collidingIds,
  };
};

/**
 * isPositionValid — Quick boolean check (no correction).
 */
export const isPositionValid = (x, y, movingObj, objects, excludeId) => {
  const result = checkCollision(x, y, movingObj, objects, excludeId);
  return !result.collides;
};

/**
 * getObjectBounds — Return the AABB of an object for debug visualization.
 */
export const getObjectBounds = getAABB;

export default {
  checkCollision,
  isPositionValid,
  getObjectBounds,
};
