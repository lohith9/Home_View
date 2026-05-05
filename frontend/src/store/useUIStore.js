import { create } from 'zustand';

export const useUIStore = create((set) => ({
  viewMode: '2D',
  setViewMode: (mode) => set({ viewMode: mode }),

  vastuMode: false,
  toggleVastuMode: () => set((state) => ({ vastuMode: !state.vastuMode })),

  activeTab: 'walls',
  setActiveTab: (tab) => set({ activeTab: tab }),

  projectName: 'Untitled Project',
  setProjectName: (name) => set({ projectName: name }),

  pan: { x: 0, y: 0 },
  setPan: (pan) => set({ pan }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  dragItem: null,
  setDragItem: (item) => set({ dragItem: item }),
  beginPaletteDrag: (item) =>
    set({
      dragItem: item,
      isDrawingWall: false,
      isMeasuring: false,
      measurePoints: [],
      snapGuides: [],
    }),
  clearPaletteDrag: () => set({ dragItem: null }),

  isDrawingWall: false,
  setIsDrawingWall: (val) =>
    set((state) => ({
      isDrawingWall: val,
      dragItem: val ? null : state.dragItem,
      isMeasuring: val ? false : state.isMeasuring,
      measurePoints: val ? [] : state.measurePoints,
      snapGuides: val ? [] : state.snapGuides,
    })),
  toggleWallDrawing: () =>
    set((state) => ({
      isDrawingWall: !state.isDrawingWall,
      dragItem: null,
      isMeasuring: false,
      measurePoints: [],
      snapGuides: [],
    })),

  // Measurement tool
  isMeasuring: false,
  setIsMeasuring: (val) =>
    set((state) => ({
      isMeasuring: val,
      isDrawingWall: val ? false : state.isDrawingWall,
      dragItem: val ? null : state.dragItem,
      measurePoints: val ? state.measurePoints : [],
      snapGuides: val ? state.snapGuides : [],
    })),
  measurePoints: [],  // [{x,y}, {x,y}]
  setMeasurePoints: (pts) => set({ measurePoints: pts }),

  // Snap guides for visual feedback
  snapGuides: [],  // [{type:'v'|'h', pos: number}]
  setSnapGuides: (guides) => set({ snapGuides: guides }),

  // Active interaction mode
  interactionMode: 'select', // 'select' | 'resize' | 'rotate'
  setInteractionMode: (mode) => set({ interactionMode: mode }),

  // Active floor level
  activeFloor: 1,
  setActiveFloor: (floor) => set({ activeFloor: floor }),

  measurementUnit: 'metric',
  setMeasurementUnit: (measurementUnit) => set({ measurementUnit }),

  cancelActiveTool: () =>
    set({
      dragItem: null,
      isDrawingWall: false,
      isMeasuring: false,
      measurePoints: [],
      snapGuides: [],
      interactionMode: 'select',
    }),
}));
