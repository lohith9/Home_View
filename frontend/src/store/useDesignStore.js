import { create } from 'zustand';

const MAX_HISTORY = 50;

const cloneObjects = (objects) => JSON.parse(JSON.stringify(objects));

const pushToPast = (past, snapshot) => {
  const nextPast = [...past, cloneObjects(snapshot)];
  return nextPast.length > MAX_HISTORY ? nextPast.slice(-MAX_HISTORY) : nextPast;
};

export const useDesignStore = create((set, get) => ({
  objects: [],
  selectedIds: [],
  currency: 'INR',
  past: [],
  future: [],

  _pushHistory: () => {
    const { objects, past } = get();
    set({
      past: pushToPast(past, objects),
      future: [],
    });
  },

  addObject: (obj) => {
    get()._pushHistory();
    const newObj = {
      ...obj,
      id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      zIndex: get().objects.length,
    };

    set((state) => ({
      objects: [...state.objects, newObj],
      selectedIds: [newObj.id],
    }));

    return newObj.id;
  },

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
    })),

  updateObjectWithHistory: (id, updates) => {
    get()._pushHistory();
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
    }));
  },

  removeObject: (id) => {
    get()._pushHistory();
    set((state) => ({
      // Remove the object and detach any children that were attached to it
      objects: state.objects
        .filter((obj) => obj.id !== id)
        .map((obj) => (obj.attachedTo === id ? { ...obj, attachedTo: null } : obj)),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }));
  },

  duplicateSelected: () => {
    const { objects, selectedIds } = get();
    if (selectedIds.length === 0) return;

    get()._pushHistory();

    const newIds = [];
    const newObjects = [];

    for (const id of selectedIds) {
      const obj = objects.find((entry) => entry.id === id);
      if (!obj) continue;

      const newId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const clone = {
        ...JSON.parse(JSON.stringify(obj)),
        id: newId,
        zIndex: objects.length + newObjects.length,
      };

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
    get()._pushHistory();
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
    get()._pushHistory();
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
