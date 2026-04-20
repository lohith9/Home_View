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

  isDrawingWall: false,
  setIsDrawingWall: (val) => set({ isDrawingWall: val }),

  // Measurement tool
  isMeasuring: false,
  setIsMeasuring: (val) => set({ isMeasuring: val }),
  measurePoints: [],  // [{x,y}, {x,y}]
  setMeasurePoints: (pts) => set({ measurePoints: pts }),

  // Snap guides for visual feedback
  snapGuides: [],  // [{type:'v'|'h', pos: number}]
  setSnapGuides: (guides) => set({ snapGuides: guides }),

  // Active interaction mode
  interactionMode: 'select', // 'select' | 'resize' | 'rotate'
  setInteractionMode: (mode) => set({ interactionMode: mode }),
}));
