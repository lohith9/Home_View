/**
 * useSceneStore - Thin compatibility layer over useDesignStore.
 *
 * The single source of truth for all objects is useDesignStore.
 * This module re-exports a subset of its API under simplified names
 * so that new code written against useSceneStore automatically
 * shares the same state.
 */
import { useDesignStore } from './useDesignStore';

const defaultSceneSelector = (state) => ({
  objects: state.objects,
  selectedId: state.selectedIds.length > 0 ? state.selectedIds[0] : null,
  addObject: state.addObject,
  selectObject: state.selectObject,
  updateObject: state.updateObject,
});

export const useSceneStore = (selector) => useDesignStore(selector ?? defaultSceneSelector);
