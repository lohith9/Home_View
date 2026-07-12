import { create } from 'zustand';

const MAX_HISTORY = 50;

// Deep clone for history snapshots.
// structuredClone is preferred (faster, preserves more types than JSON round-trip);
// JSON fallback covers older environments.
// NOTE: because every mutation in this store is immutable, snapshots could share
// references instead of cloning — see docs/adr/ADR-002-snapshot-history.md for
// why we still clone defensively.
const cloneObjects = (objects) =>
  typeof structuredClone === 'function'
    ? structuredClone(objects)
    : JSON.parse(JSON.stringify(objects));

const pushToPast = (past, snapshot) => {
  const nextPast = [...past, cloneObjects(snapshot)];
  return nextPast.length > MAX_HISTORY ? nextPast.slice(-MAX_HISTORY) : nextPast;
};

// Next z-index must derive from the current maximum, not the array length:
// after any deletion, objects.length can collide with an existing zIndex.
const nextZIndex = (objects) =>
  objects.reduce((max, obj) => Math.max(max, obj.zIndex ?? 0), -1) + 1;

export const useDesignStore = create((set, get) => ({
  objects: [],
  selectedIds: [],
  currency: 'INR',
  past: [],
  future: [],

  /**
   * beginGesture — snapshot the current state into undo history.
   *
   * Call exactly once at the start of a user gesture (drag, resize, rotate),
   * before the first updateObject call, so the whole gesture undoes as one step.
   * For single atomic edits pass { history: true } to updateObject instead.
   * Do not combine both for the same edit — it would create two history entries.
   */
  beginGesture: () => {
    const { objects, past } = get();
    set({
      past: pushToPast(past, objects),
      future: [],
    });
  },

  /** @deprecated Use beginGesture(). Kept as an alias for backward compatibility. */
  _pushHistory: () => get().beginGesture(),

  addObject: (obj) => {
    get().beginGesture();
    const newObj = {
      ...obj,
      id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      zIndex: nextZIndex(get().objects),
    };

    set((state) => ({
      objects: [...state.objects, newObj],
      selectedIds: [newObj.id],
    }));

    return newObj.id;
  },

  /**
   * updateObject — patch a single object.
   *
   * @param {string} id
   * @param {object} updates
   * @param {{ history?: boolean }} [options] - pass { history: true } for atomic
   *   edits that should be undoable on their own. For continuous gestures call
   *   beginGesture() once at gesture start and leave history off here.
   */
  updateObject: (id, updates, options = {}) => {
    if (options.history) get().beginGesture();
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
    }));
  },

  /** @deprecated Use updateObject(id, updates, { history: true }). */
  updateObjectWithHistory: (id, updates) => get().updateObject(id, updates, { history: true }),

  removeObject: (id) => {
    get().beginGesture();
    set((state) => ({
      // Remove the object and detach any children that were attached to it
      objects: state.objects
        .filter((obj) => obj.id !== id)
        .map((obj) => (obj.attachedTo === id ? { ...obj, attachedTo: null } : obj)),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }));
  },

  removeObjects: (ids) => {
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return;

    get().beginGesture();
    set((state) => ({
      objects: state.objects
        .filter((obj) => !idSet.has(obj.id))
        .map((obj) => (obj.attachedTo && idSet.has(obj.attachedTo) ? { ...obj, attachedTo: null } : obj)),
      selectedIds: state.selectedIds.filter((selectedId) => !idSet.has(selectedId)),
    }));
  },

  duplicateSelected: () => {
    const { objects, selectedIds } = get();
    if (selectedIds.length === 0) return;

    get().beginGesture();

    const newIds = [];
    const newObjects = [];
    let zIndex = nextZIndex(objects);

    for (const id of selectedIds) {
      const obj = objects.find((entry) => entry.id === id);
      if (!obj) continue;

      const newId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const clone = {
        ...cloneObjects(obj),
        id: newId,
        zIndex: zIndex,
      };
      zIndex += 1;

      if (clone.type === 'wall') {
        clone.start = [clone.start[0] + 20, clone.start[1] + 20];
        clone.end = [clone.end[0] + 20, clone.end[1] + 20];
      } else {
        clone.x = (clone.x || 0) + 30;
        clone.y = (clone.y || 0) + 30;
      }

      newObjects.push(clone);
      newIds.push(newId);
    }

    set((state) => ({
      objects: [...state.objects, ...newObjects],
      selectedIds: newIds,
    }));
  },

  selectObject: (id) => set({ selectedIds: id ? [id] : [] }),

  toggleSelect: (id) =>
    set((state) => {
      const isSelected = state.selectedIds.includes(id);
      return {
        selectedIds: isSelected
          ? state.selectedIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedIds, id],
      };
    }),

  selectMultiple: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  bringForward: (id) => {
    get().beginGesture();
    set((state) => {
      const sorted = [...state.objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const index = sorted.findIndex((obj) => obj.id === id);
      if (index < 0 || index >= sorted.length - 1) return { objects: sorted };

      const current = sorted[index];
      const next = sorted[index + 1];
      sorted[index] = { ...current, zIndex: next.zIndex };
      sorted[index + 1] = { ...next, zIndex: current.zIndex };

      return { objects: sorted };
    });
  },

  sendBackward: (id) => {
    get().beginGesture();
    set((state) => {
      const sorted = [...state.objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const index = sorted.findIndex((obj) => obj.id === id);
      if (index <= 0) return { objects: sorted };

      const current = sorted[index];
      const previous = sorted[index - 1];
      sorted[index] = { ...current, zIndex: previous.zIndex };
      sorted[index - 1] = { ...previous, zIndex: current.zIndex };

      return { objects: sorted };
    });
  },

  undo: () => {
    const { objects, past, future } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    set({
      objects: cloneObjects(previous),
      past: past.slice(0, -1),
      future: [cloneObjects(objects), ...future],
      selectedIds: [],
    });
  },

  redo: () => {
    const { objects, future, past } = get();
    if (future.length === 0) return;

    const [next, ...restFuture] = future;
    set({
      objects: cloneObjects(next),
      past: pushToPast(past, objects),
      future: restFuture,
      selectedIds: [],
    });
  },

  setCurrency: (currency) => set({ currency }),

  saveDesign: () => {
    const { objects } = get();
    localStorage.setItem('home3d_design', JSON.stringify({ version: 1, objects }));
    return true;
  },

  loadDesign: () => {
    const raw = localStorage.getItem('home3d_design');
    if (!raw) return false;

    try {
      const data = JSON.parse(raw);
      set({
        objects: data.objects || [],
        selectedIds: [],
        past: [],
        future: [],
      });
      return true;
    } catch {
      return false;
    }
  },

  importDesign: (data) => {
    set({
      objects: data?.objects || [],
      selectedIds: [],
      past: [],
      future: [],
    });
  },

  setObjects: (objects) =>
    set({
      objects,
      selectedIds: [],
      past: [],
      future: [],
    }),
}));
