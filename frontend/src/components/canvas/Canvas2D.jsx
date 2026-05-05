import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { useUIStore } from '../../store/useUIStore';
import { resolveConstraints, resolveWallEndpoint, constrainAngle } from '../../engine/constraintEngine';
import { checkCollision } from '../../engine/collisionEngine';
import { propagateWallMove, shouldDetach } from '../../engine/dependencyEngine';

const GRID = 20;
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 30;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15; // for button clicks

const snap = (value) => Math.round(value / GRID) * GRID;

export default function Canvas2D() {
  const {
    objects,
    addObject,
    selectObject,
    toggleSelect,
    selectMultiple,
    updateObject,
    selectedIds,
    clearSelection,
    _pushHistory,
  } = useDesignStore();
  const {
    pan,
    setPan,
    zoom,
    setZoom,
    isDrawingWall,
    snapGuides,
    setSnapGuides,
    isMeasuring,
    measurePoints,
    setMeasurePoints,
    dragItem,
  } = useUIStore();

  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingObjId, setDraggingObjId] = useState(null);
  const [drawingWallStart, setDrawingWallStart] = useState(null);
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [rotateCenter, setRotateCenter] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);
  const [hoveredObjId, setHoveredObjId] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const localGuidesRef = useRef([]);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingObjIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const drawingWallStartRef = useRef(null);
  const currentMousePosRef = useRef(null);
  const dragStartRef = useRef(null);
  const dragSelectionOriginsRef = useRef({});
  const wallDragOriginRef = useRef(null);
  const activePointerIdRef = useRef(null);
  const spaceHeldRef = useRef(false);

  const capturePointer = useCallback((event) => {
    if (!containerRef.current || event.pointerId == null) return;
    activePointerIdRef.current = event.pointerId;
    if (!containerRef.current.hasPointerCapture(event.pointerId)) {
      containerRef.current.setPointerCapture(event.pointerId);
    }
  }, []);

  const releasePointer = useCallback((pointerId = activePointerIdRef.current) => {
    if (!containerRef.current || pointerId == null) return;
    if (containerRef.current.hasPointerCapture(pointerId)) {
      containerRef.current.releasePointerCapture(pointerId);
    }
    if (activePointerIdRef.current === pointerId) {
      activePointerIdRef.current = null;
    }
  }, []);

  const resetTransientInteraction = useCallback(() => {
    setIsPanning(false);
    isPanningRef.current = false;
    setDrawingWallStart(null);
    drawingWallStartRef.current = null;
    setCurrentMousePos(null);
    currentMousePosRef.current = null;
    setDraggingObjId(null);
    draggingObjIdRef.current = null;
    setRotating(null);
    setRotateCenter(null);
    setResizing(null);
    setResizeStart(null);
    setMeasureStart(null);
    setMeasureEnd(null);
    setSelectionBox(null);
    setSnapGuides([]);
    dragStartRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    panStartRef.current = { x: 0, y: 0 };
    dragSelectionOriginsRef.current = {};
    wallDragOriginRef.current = null;
    releasePointer();
  }, [releasePointer, setSnapGuides]);

  const getCanvasCoords = useCallback(
    (clientX, clientY) => {
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  /**
   * smartSnap — wraps the constraint engine for drag operations.
   * Uses a local ref for guides during drag (perf: avoids store churn)
   * and flushes to the UI store so other components can read guides.
   */
  const smartSnap = useCallback(
    (x, y, excludeId, objectType = 'furniture') => {
      const result = resolveConstraints(x, y, {
        excludeId,
        objectType,
        objects,
        gridSize: GRID,
      });

      // Convert constraint-engine guides to the format the renderer expects
      const guides = result.guides
        .filter((g) => g.type === 'v' || g.type === 'h')
        .map((g) => ({ type: g.type, pos: g.pos }));

      localGuidesRef.current = guides;
      setSnapGuides(guides);
      return { x: result.x, y: result.y, attachment: result.attachment };
    },
    [objects, setSnapGuides],
  );

  useEffect(() => {
    if (!isDrawingWall && drawingWallStartRef.current) {
      setDrawingWallStart(null);
      drawingWallStartRef.current = null;
      setCurrentMousePos(null);
      currentMousePosRef.current = null;
      setSnapGuides([]);
    }
    if (!isMeasuring && measureStart) {
      setMeasureStart(null);
      setMeasureEnd(null);
    }
  }, [isDrawingWall, isMeasuring, measureStart, setSnapGuides]);

  const handleBackgroundPointerDown = (event) => {
    if (dragItem) return;

    const coords = getCanvasCoords(event.clientX, event.clientY);
    // Pan via: middle mouse, right mouse, Alt+drag, Meta+drag, or Space+drag
    const shouldPan = event.button === 1 || event.button === 2 || event.altKey || event.metaKey || spaceHeldRef.current;
    if (shouldPan) {
      event.preventDefault();
      capturePointer(event);
      setIsPanning(true);
      isPanningRef.current = true;
      const nextPanStart = { x: event.clientX - pan.x, y: event.clientY - pan.y };
      panStartRef.current = nextPanStart;
      return;
    }

    if (event.button !== 0) return;

    if (isMeasuring) {
      capturePointer(event);
      const snappedPoint = { x: snap(coords.x), y: snap(coords.y) };
      if (!measureStart) {
        setMeasureStart(snappedPoint);
        setMeasureEnd(snappedPoint);
      } else {
        setMeasureEnd(snappedPoint);
        setMeasurePoints([measureStart, snappedPoint]);
        setMeasureStart(null);
        setMeasureEnd(null);
      }
      return;
    }

    if (isDrawingWall) {
      capturePointer(event);
      // Use constraint engine for wall endpoints (corner-snap + grid)
      const wallEndpoint = resolveWallEndpoint(coords.x, coords.y, objects, null, GRID);
      const nextPoint = [wallEndpoint.x, wallEndpoint.y];
      if (wallEndpoint.guides.length > 0) {
        setSnapGuides(wallEndpoint.guides.map((g) => ({ type: g.type, pos: g.pos })));
      }
      const existingStart = drawingWallStartRef.current;

      if (existingStart) {
        const [x1, y1] = existingStart;
        const [x2, y2] = nextPoint;
        if (Math.hypot(x2 - x1, y2 - y1) > 5) {
          addObject({
            type: 'wall',
            name: 'Wall',
            start: existingStart,
            end: nextPoint,
            thickness: 10,
            price: 5000,
          });
          drawingWallStartRef.current = null;
          currentMousePosRef.current = null;
          setDrawingWallStart(null);
          setCurrentMousePos(null);
          setSnapGuides([]);
          clearSelection();
          return;
        }
      }

      const start = nextPoint;
      drawingWallStartRef.current = start;
      currentMousePosRef.current = start;
      setDrawingWallStart(start);
      setCurrentMousePos(start);
      clearSelection();
      return;
    }

    capturePointer(event);
    setSelectionBox({
      x1: coords.x,
      y1: coords.y,
      x2: coords.x,
      y2: coords.y,
      additive: event.shiftKey,
    });
  };

  const handlePointerMove = useCallback(
    (event) => {
      if (dragItem) return;
      if (activePointerIdRef.current != null && event.pointerId != null && event.pointerId !== activePointerIdRef.current) return;
      const coords = getCanvasCoords(event.clientX, event.clientY);

      if (isMeasuring && measureStart) {
        setMeasureEnd({ x: snap(coords.x), y: snap(coords.y) });
        return;
      }

      const activeDraggingObjId = draggingObjIdRef.current;

      if (activeDraggingObjId) {
        // Determine the object type for constraint-aware snapping
        const draggedObj = objects.find((o) => o.id === activeDraggingObjId);
        const objType = draggedObj?.type || 'furniture';

        const wallOrigin = wallDragOriginRef.current;
        if (wallOrigin) {
          const rawX = coords.x - dragOffsetRef.current.x;
          const rawY = coords.y - dragOffsetRef.current.y;
          const snapped = smartSnap(rawX, rawY, activeDraggingObjId, 'wall');
          const deltaX = snapped.x - wallOrigin.midX;
          const deltaY = snapped.y - wallOrigin.midY;

          // Build old/new wall state for dependency propagation
          const oldWall = { start: wallOrigin.start, end: wallOrigin.end };
          const newWall = {
            start: [wallOrigin.start[0] + deltaX, wallOrigin.start[1] + deltaY],
            end: [wallOrigin.end[0] + deltaX, wallOrigin.end[1] + deltaY],
          };

          updateObject(activeDraggingObjId, {
            start: newWall.start,
            end: newWall.end,
          });

          // Parametric: propagate move to attached children (doors, windows)
          const childUpdates = propagateWallMove(activeDraggingObjId, oldWall, newWall, objects);
          for (const cu of childUpdates) {
            updateObject(cu.id, cu.updates);
          }

          return;
        }

        const snappedLead = smartSnap(
          coords.x - dragOffsetRef.current.x,
          coords.y - dragOffsetRef.current.y,
          activeDraggingObjId,
          objType,
        );
        const leadOrigin = dragStartRef.current || snappedLead;
        const deltaX = snappedLead.x - leadOrigin.x;
        const deltaY = snappedLead.y - leadOrigin.y;

        if (selectedIds.length > 1 && selectedIds.includes(activeDraggingObjId)) {
          for (const id of selectedIds) {
            const origin = dragSelectionOriginsRef.current[id];
            if (!origin) continue;
            updateObject(id, {
              x: origin.x + deltaX,
              y: origin.y + deltaY,
            });
          }
        } else {
          // Apply collision detection for non-wall objects
          let finalX = snappedLead.x;
          let finalY = snappedLead.y;

          if (draggedObj && objType !== 'wall') {
            const collision = checkCollision(snappedLead.x, snappedLead.y, draggedObj, objects, activeDraggingObjId);
            if (collision.collides) {
              finalX = collision.x;
              finalY = collision.y;
            }
          }

          const update = { x: finalX, y: finalY };

          // For door/window: wall-attach or detach logic
          if (snappedLead.attachment) {
            update.attachedTo = snappedLead.attachment.wallId;
          } else if (draggedObj?.attachedTo) {
            // Check if we should detach (dragged too far from parent wall)
            const testObj = { ...draggedObj, x: finalX, y: finalY };
            if (shouldDetach(testObj, objects)) {
              update.attachedTo = null;
            }
          }

          updateObject(activeDraggingObjId, update);
        }

        return;
      }

      if (rotating) {
        const angle = Math.atan2(coords.y - rotateCenter.y, coords.x - rotateCenter.x) * (180 / Math.PI) + 90;
        updateObject(rotating, { rotation: constrainAngle(angle) });
        return;
      }

      if (resizing) {
        const { objId, corner, origX, origY, origW, origH } = resizing;
        const dx = coords.x - resizeStart.x;
        const dy = coords.y - resizeStart.y;

        let newWidth = origW;
        let newHeight = origH;
        let newX = origX;
        let newY = origY;

        if (corner.includes('r')) newWidth = snap(Math.max(GRID, origW + dx));
        if (corner.includes('l')) {
          newWidth = snap(Math.max(GRID, origW - dx));
          newX = origX + (origW - newWidth) / 2;
        }
        if (corner.includes('b')) newHeight = snap(Math.max(GRID, origH + dy));
        if (corner.includes('t')) {
          newHeight = snap(Math.max(GRID, origH - dy));
          newY = origY + (origH - newHeight) / 2;
        }

        updateObject(objId, {
          width: newWidth,
          height: newHeight,
          x: snap(newX),
          y: snap(newY),
        });
        return;
      }

      const wallStart = drawingWallStartRef.current;
      if (wallStart) {
        // Use constraint engine for corner-snap preview while drawing
        const wallEndpoint = resolveWallEndpoint(coords.x, coords.y, objects, null, GRID);
        let nextX = wallEndpoint.x;
        let nextY = wallEndpoint.y;

        if (event.shiftKey) {
          const deltaX = Math.abs(nextX - wallStart[0]);
          const deltaY = Math.abs(nextY - wallStart[1]);
          if (deltaX > deltaY) nextY = wallStart[1];
          else nextX = wallStart[0];
        }

        // Show corner-snap guides during preview
        if (wallEndpoint.guides.length > 0) {
          setSnapGuides(wallEndpoint.guides.map((g) => ({ type: g.type, pos: g.pos })));
        } else {
          setSnapGuides([]);
        }

        currentMousePosRef.current = [nextX, nextY];
        setCurrentMousePos([nextX, nextY]);
        return;
      }

      if (isPanningRef.current) {
        setPan({ x: event.clientX - panStartRef.current.x, y: event.clientY - panStartRef.current.y });
        return;
      }

      if (selectionBox) {
        setSelectionBox((current) => (current ? { ...current, x2: coords.x, y2: coords.y } : null));
      }
    },
    [
      dragItem,
      getCanvasCoords,
      isMeasuring,
      measureStart,
      smartSnap,
      selectedIds,
      updateObject,
      rotating,
      rotateCenter,
      resizing,
      resizeStart,
      selectionBox,
      setPan,
      objects,
      setSnapGuides,
    ],
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (dragItem) return;
      if (activePointerIdRef.current != null && event.pointerId != null && event.pointerId !== activePointerIdRef.current) return;

      // Wall drawing is click-based (click-start → click-end), NOT drag-based.
      // Do NOT commit wall on pointerUp — let handleBackgroundPointerDown handle it.
      // Just keep the preview alive while the user moves toward the second click.
      if (drawingWallStartRef.current) {
        releasePointer(event.pointerId);
        return;
      }

      if (draggingObjIdRef.current) {
        setDraggingObjId(null);
        draggingObjIdRef.current = null;
        dragStartRef.current = null;
        dragOffsetRef.current = { x: 0, y: 0 };
        dragSelectionOriginsRef.current = {};
        wallDragOriginRef.current = null;
        setSnapGuides([]);
        releasePointer(event.pointerId);
        return;
      }

      if (rotating) {
        setRotating(null);
        setRotateCenter(null);
        releasePointer(event.pointerId);
        return;
      }

      if (resizing) {
        setResizing(null);
        setResizeStart(null);
        releasePointer(event.pointerId);
        return;
      }

      if (isPanningRef.current) {
        setIsPanning(false);
        isPanningRef.current = false;
        releasePointer(event.pointerId);
        return;
      }

      if (selectionBox) {
        const x1 = Math.min(selectionBox.x1, selectionBox.x2);
        const y1 = Math.min(selectionBox.y1, selectionBox.y2);
        const x2 = Math.max(selectionBox.x1, selectionBox.x2);
        const y2 = Math.max(selectionBox.y1, selectionBox.y2);
        const width = x2 - x1;
        const height = y2 - y1;

        if (width < 5 && height < 5) {
          if (!selectionBox.additive) clearSelection();
        } else {
          const ids = objects
            .filter((obj) => {
              if (obj.type === 'wall') {
                const midX = (obj.start[0] + obj.end[0]) / 2;
                const midY = (obj.start[1] + obj.end[1]) / 2;
                return midX >= x1 && midX <= x2 && midY >= y1 && midY <= y2;
              }

              const objX = obj.x || 0;
              const objY = obj.y || 0;
              return objX >= x1 && objX <= x2 && objY >= y1 && objY <= y2;
            })
            .map((obj) => obj.id);

          if (selectionBox.additive) {
            selectMultiple(Array.from(new Set([...selectedIds, ...ids])));
          } else {
            selectMultiple(ids);
          }
        }

        setSelectionBox(null);
        releasePointer(event.pointerId);
      }

      releasePointer(event.pointerId);
    },
    [
      dragItem,
      setSnapGuides,
      releasePointer,
      rotating,
      resizing,
      selectionBox,
      clearSelection,
      objects,
      selectMultiple,
      selectedIds,
    ],
  );

  const hasActiveInteraction = Boolean(
    isPanning ||
      draggingObjId ||
      drawingWallStart ||
      resizing ||
      rotating ||
      selectionBox ||
      measureStart,
  );

  React.useEffect(() => {
    if (dragItem || !hasActiveInteraction) return undefined;

    const handleWindowMove = (event) => handlePointerMove(event);
    const handleWindowUp = (event) => handlePointerUp(event);

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
    };
  }, [dragItem, hasActiveInteraction, handlePointerMove, handlePointerUp]);

  /**
   * Cursor-centered zoom with trackpad normalization.
   * Supports both discrete mouse wheel and continuous trackpad gestures.
   * Uses the Figma formula: zoom toward cursor position.
   */
  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      if (!containerRef.current) return;

      // If ctrlKey/metaKey is held, perform ZOOM
      if (event.ctrlKey || event.metaKey) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Trackpad pinch-zoom sends ctrlKey + deltaY; normalize for smooth feel
        const isTrackpad = Math.abs(event.deltaY) < 50;
        const sensitivity = isTrackpad ? 0.008 : 0.0025;
        const delta = -event.deltaY * sensitivity;
        const factor = Math.pow(2, delta);

        const nextZoom = Math.min(Math.max(MIN_ZOOM, zoom * factor), MAX_ZOOM);
        if (nextZoom === zoom) return;

        // Pan correction: keep the world point under cursor stable
        const scale = nextZoom / zoom;
        const nextPanX = mouseX - (mouseX - pan.x) * scale;
        const nextPanY = mouseY - (mouseY - pan.y) * scale;

        setZoom(nextZoom);
        setPan({ x: nextPanX, y: nextPanY });
      } else {
        // If no modifier is held, perform PAN (Figma default for scroll wheels / trackpad)
        // Shift + Wheel already translates to deltaX in modern browsers/trackpads
        setPan({
          x: pan.x - event.deltaX,
          y: pan.y - event.deltaY,
        });
      }
    },
    [zoom, pan, setZoom, setPan],
  );

  /**
   * Zoom in/out by a fixed step, centered on the canvas viewport center.
   * Used by toolbar buttons and keyboard shortcuts.
   */
  const zoomByStep = useCallback(
    (direction) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const factor = direction > 0 ? (1 + ZOOM_STEP) : (1 / (1 + ZOOM_STEP));
      const nextZoom = Math.min(Math.max(MIN_ZOOM, zoom * factor), MAX_ZOOM);
      if (nextZoom === zoom) return;

      const scale = nextZoom / zoom;
      const nextPanX = centerX - (centerX - pan.x) * scale;
      const nextPanY = centerY - (centerY - pan.y) * scale;
      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    },
    [zoom, pan, setZoom, setPan],
  );

  /**
   * Reset view: zoom=1, pan=0 with smooth transition.
   */
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [setZoom, setPan]);

  /**
   * Fit all objects into the viewport with padding.
   */
  const fitToView = useCallback(() => {
    if (!containerRef.current || objects.length === 0) {
      resetView();
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const obj of objects) {
      if (obj.type === 'wall') {
        minX = Math.min(minX, obj.start[0], obj.end[0]);
        minY = Math.min(minY, obj.start[1], obj.end[1]);
        maxX = Math.max(maxX, obj.start[0], obj.end[0]);
        maxY = Math.max(maxY, obj.start[1], obj.end[1]);
      } else {
        const x = obj.x || 0;
        const y = obj.y || 0;
        const w = obj.width || 100;
        const h = obj.height || 100;
        minX = Math.min(minX, x - w / 2);
        minY = Math.min(minY, y - h / 2);
        maxX = Math.max(maxX, x + w / 2);
        maxY = Math.max(maxY, y + h / 2);
      }
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) { resetView(); return; }

    const padding = 80;
    const scaleX = (rect.width - padding * 2) / contentW;
    const scaleY = (rect.height - padding * 2) / contentH;
    const fitZoom = Math.min(Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)), MAX_ZOOM);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const fitPanX = rect.width / 2 - centerX * fitZoom;
    const fitPanY = rect.height / 2 - centerY * fitZoom;

    setZoom(fitZoom);
    setPan({ x: fitPanX, y: fitPanY });
  }, [objects, setZoom, setPan, resetView]);

  const handleObjectPointerDown = (event, obj) => {
    event.stopPropagation();
    if (event.button !== 0) return;

    if (isMeasuring) {
      capturePointer(event);
      if (event.shiftKey) toggleSelect(obj.id);
      else selectObject(obj.id);
      return;
    }

    if (event.shiftKey) {
      toggleSelect(obj.id);
      return;
    }

    const nextSelection = selectedIds.includes(obj.id) ? selectedIds : [obj.id];

    if (!selectedIds.includes(obj.id)) selectObject(obj.id);

    _pushHistory();
    capturePointer(event);

    const coords = getCanvasCoords(event.clientX, event.clientY);

    // Wall drag: track the midpoint and original start/end
    if (obj.type === 'wall') {
      const midX = (obj.start[0] + obj.end[0]) / 2;
      const midY = (obj.start[1] + obj.end[1]) / 2;
      const nextOffset = {
        x: coords.x - midX,
        y: coords.y - midY,
      };
      dragOffsetRef.current = nextOffset;
      setDraggingObjId(obj.id);
      draggingObjIdRef.current = obj.id;
      wallDragOriginRef.current = {
        midX,
        midY,
        start: [...obj.start],
        end: [...obj.end],
      };
      return;
    }

    const nextOffset = {
      x: coords.x - (obj.x || 0),
      y: coords.y - (obj.y || 0),
    };
    dragOffsetRef.current = nextOffset;
    setDraggingObjId(obj.id);
    draggingObjIdRef.current = obj.id;
    dragStartRef.current = { x: obj.x || 0, y: obj.y || 0 };

    const origins = {};
    for (const id of nextSelection) {
      const selectedObj = objects.find((entry) => entry.id === id);
      if (!selectedObj || selectedObj.type === 'wall') continue;
      origins[id] = { x: selectedObj.x || 0, y: selectedObj.y || 0 };
    }
    dragSelectionOriginsRef.current = origins;
  };

  const handleResizeDown = (event, obj, corner) => {
    event.stopPropagation();
    capturePointer(event);
    _pushHistory();
    setResizing({
      objId: obj.id,
      corner,
      origW: obj.width || 100,
      origH: obj.height || 100,
      origX: obj.x || 0,
      origY: obj.y || 0,
    });
    setResizeStart(getCanvasCoords(event.clientX, event.clientY));
  };

  const handleRotateDown = (event, obj) => {
    event.stopPropagation();
    capturePointer(event);
    _pushHistory();
    setRotating(obj.id);
    setRotateCenter({ x: obj.x || 0, y: obj.y || 0 });
  };

  const sortedObjects = useMemo(
    () => [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [objects],
  );

  const measurementUnit = useUIStore((state) => state.measurementUnit);
  const zoomPercent = Math.round(zoom * 100);
  const formatDistance = useCallback(
    (length) => {
      const meters = length / 100;
      return measurementUnit === 'imperial'
        ? `${(meters * 3.281).toFixed(2)}ft`
        : `${meters.toFixed(2)}m`;
    },
    [measurementUnit],
  );

  // Spacebar hold for panning + keyboard zoom shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === ' ' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }
      // Ctrl/Cmd + = / + to zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomByStep(1);
      }
      // Ctrl/Cmd + - to zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomByStep(-1);
      }
      // Ctrl/Cmd + 0 to reset view
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetView();
      }
      // Ctrl/Cmd + 1 to fit to view
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        fitToView();
      }
    };
    const onKeyUp = (e) => {
      if (e.key === ' ') {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [zoomByStep, resetView, fitToView]);

  // Passive-false wheel listener for smooth zoom (React onWheel can't preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  let cursor = 'default';
  if (dragItem) cursor = 'copy';
  else if (isPanning) cursor = 'grabbing';
  else if (spaceHeld) cursor = 'grab';
  else if (isDrawingWall || isMeasuring) cursor = 'crosshair';
  else if (resizing) cursor = 'nwse-resize';
  else if (rotating) cursor = 'grab';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none"
      data-testid="canvas-2d"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetTransientInteraction}
      onPointerLeave={() => setHoveredObjId(null)}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor, touchAction: 'none' }}
    >
      {/* ── Context hint ── */}
      <div
        style={{
          position: 'absolute',
          right: '14px',
          top: '14px',
          zIndex: 30,
          padding: '8px 10px',
          borderRadius: '10px',
          background: isDrawingWall ? 'rgba(124, 58, 237, 0.16)' : 'rgba(11, 15, 26, 0.66)',
          border: isDrawingWall ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid rgba(148, 163, 184, 0.12)',
          color: 'var(--text-primary)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'var(--shadow-sm)',
          fontSize: '0.74rem',
          fontWeight: 600,
        }}
      >
        {isDrawingWall
          ? 'Click to set start, click again to place wall'
          : spaceHeld
            ? '⎵ Drag to pan'
            : 'Scroll to zoom • Space + drag to pan'}
      </div>

      {/* ── Zoom Controls Overlay ── */}
      <div className="canvas-zoom-controls" data-testid="zoom-controls">
        <button
          className="zoom-ctrl-btn"
          data-testid="zoom-in-btn"
          onClick={() => zoomByStep(1)}
          title="Zoom in (Ctrl +)"
        >
          <ZoomIn size={15} strokeWidth={2} />
        </button>

        <button
          className="zoom-ctrl-percent"
          onClick={resetView}
          title="Reset to 100% (Ctrl 0)"
        >
          {zoomPercent}%
        </button>

        <button
          className="zoom-ctrl-btn"
          data-testid="zoom-out-btn"
          onClick={() => zoomByStep(-1)}
          title="Zoom out (Ctrl −)"
        >
          <ZoomOut size={15} strokeWidth={2} />
        </button>

        <div className="zoom-ctrl-divider" />

        <button
          className="zoom-ctrl-btn"
          data-testid="fit-view-btn"
          onClick={fitToView}
          title="Fit to view (Ctrl 1)"
        >
          <Maximize size={14} strokeWidth={2} />
        </button>

        <button
          className="zoom-ctrl-btn"
          data-testid="reset-view-btn"
          onClick={resetView}
          title="Reset view (Ctrl 0)"
        >
          <RotateCcw size={14} strokeWidth={2} />
        </button>
      </div>

      {objects.length === 0 && !isDrawingWall && !dragItem && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 25,
            textAlign: 'center',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(99, 102, 241, 0.06))',
              border: '1px solid rgba(124, 58, 237, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}
          >
            HOME
          </div>
          <div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '6px',
              }}
            >
              Start Designing
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                maxWidth: '280px',
              }}
            >
              Draw walls from the sidebar, then drag & drop furniture to build your floor plan
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>1</span>
              Draw Walls
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>2</span>
              Add Furniture
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>3</span>
              View in 3D
            </div>
          </div>
        </div>
      )}

      <div
        id="canvas-bg"
        className="w-full h-full absolute"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning || draggingObjId || resizing || rotating ? 'none' : 'transform 0.12s ease-out',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            left: '-5000px',
            top: '-5000px',
            width: '10000px',
            height: '10000px',
            backgroundImage: `
              linear-gradient(to right, rgba(148,163,184,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148,163,184,0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            left: '-5000px',
            top: '-5000px',
            width: '10000px',
            height: '10000px',
            backgroundImage: `
              linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID * 5}px ${GRID * 5}px`,
          }}
        />

        {snapGuides.map((guide, index) => (
          <div
            key={`${guide.type}-${guide.pos}-${index}`}
            className="absolute pointer-events-none"
            style={
              guide.type === 'v'
                ? { left: `${guide.pos}px`, top: '-5000px', width: '1px', height: '10000px', background: 'rgba(124,58,237,0.45)' }
                : { top: `${guide.pos}px`, left: '-5000px', height: '1px', width: '10000px', background: 'rgba(124,58,237,0.45)' }
            }
          />
        ))}

        <div
          className="absolute rounded-full"
          style={{
            left: '-4px',
            top: '-4px',
            width: '8px',
            height: '8px',
            background: 'var(--primary)',
            boxShadow: '0 0 8px var(--primary-glow)',
          }}
        />

        {sortedObjects.map((obj) => {
          const isSelected = selectedIds.includes(obj.id);

          if (obj.type === 'wall') {
            const [x1, y1] = obj.start;
            const [x2, y2] = obj.end;
            const length = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

            const isHovered = hoveredObjId === obj.id;

            return (
              <div key={obj.id}>
                <div
                  data-testid="canvas-object-wall"
                  data-object-id={obj.id}
                  data-selected={isSelected ? 'true' : 'false'}
                  onPointerDown={(event) => handleObjectPointerDown(event, obj)}
                  onPointerEnter={() => setHoveredObjId(obj.id)}
                  onPointerLeave={() => setHoveredObjId(null)}
                  className="absolute origin-left cursor-pointer"
                  aria-label={`${obj.name} wall`}
                  style={{
                    left: `${x1}px`,
                    top: `${y1 - (obj.thickness || 10) / 2}px`,
                    width: `${length}px`,
                    height: `${obj.thickness || 10}px`,
                    pointerEvents: isDrawingWall ? 'none' : 'auto',
                    transform: `rotate(${angle}deg)`,
                    background: isSelected ? '#7C3AED' : isHovered ? '#A78BFA' : '#94A3B8',
                    boxShadow: isSelected
                      ? '0 0 16px rgba(124,58,237,0.5)'
                      : isHovered
                        ? '0 0 12px rgba(167,139,250,0.35), 0 2px 6px rgba(0,0,0,0.3)'
                        : '0 1px 4px rgba(0,0,0,0.3)',
                    borderRadius: '2px',
                    transition: 'box-shadow 0.2s ease, background 0.2s ease',
                  }}
                >
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '9px',
                      color: '#64748B',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {(length / 100).toFixed(1)}m
                  </div>
                </div>
              </div>
            );
          }

          const width = obj.width || 100;
          const height = obj.height || 100;
          const x = obj.x || 0;
          const y = obj.y || 0;
          const rotation = obj.rotation || 0;
          const itemColor = obj.color || '#94A3B8';

          const isHovered = hoveredObjId === obj.id;

          return (
            <div key={obj.id}>
              <div
                data-testid={`canvas-object-${obj.subType || obj.type}`}
                data-object-id={obj.id}
                data-selected={isSelected ? 'true' : 'false'}
                onPointerDown={(event) => handleObjectPointerDown(event, obj)}
                onPointerEnter={() => setHoveredObjId(obj.id)}
                onPointerLeave={() => setHoveredObjId(null)}
                className="absolute cursor-pointer"
                aria-label={`${obj.name} object`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  pointerEvents: isDrawingWall ? 'none' : 'auto',
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)${isHovered && !isSelected ? ' scale(1.03)' : ''}`,
                  background: isSelected
                    ? `linear-gradient(135deg, ${itemColor}dd, ${itemColor}99)`
                    : `linear-gradient(135deg, ${itemColor}aa, ${itemColor}66)`,
                  border: isSelected
                    ? '2px solid #7C3AED'
                    : isHovered
                      ? `2px solid ${itemColor}cc`
                      : `1.5px solid ${itemColor}88`,
                  borderRadius: '6px',
                  boxShadow: isSelected
                    ? '0 0 0 1px rgba(124,58,237,0.3), 0 0 20px rgba(124,58,237,0.25), 0 4px 12px rgba(0,0,0,0.3)'
                    : isHovered
                      ? `0 0 0 1px ${itemColor}44, 0 0 16px ${itemColor}22, 0 4px 12px rgba(0,0,0,0.3)`
                      : '0 2px 8px rgba(0,0,0,0.25)',
                  zIndex: (obj.zIndex || 0) + 1,
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  overflow: 'hidden',
                }}
              >
                <span
                  className="pointer-events-none select-none"
                  style={{
                    fontSize: Math.min(width, height) > 60 ? '0.9rem' : '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'white',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    lineHeight: 1,
                  }}
                >
                  {obj.icon || 'OBJ'}
                </span>
                {width > 50 && height > 40 && (
                  <span
                    className="pointer-events-none select-none"
                    style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      color: 'white',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      maxWidth: `${width - 8}px`,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                  >
                    {obj.name}
                  </span>
                )}
              </div>

              {obj.attachedTo && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${x + width / 2 - 12}px`,
                    top: `${y + height / 2 - 12}px`,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    color: 'white',
                    fontWeight: 700,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    zIndex: 900,
                  }}
                  title="Attached to wall">
                  LINK
                </div>
              )}

              {isSelected && selectedIds.length === 1 && (
                <>
                  {[
                    { corner: 'tl', cx: x - width / 2, cy: y - height / 2 },
                    { corner: 'tr', cx: x + width / 2, cy: y - height / 2 },
                    { corner: 'bl', cx: x - width / 2, cy: y + height / 2 },
                    { corner: 'br', cx: x + width / 2, cy: y + height / 2 },
                  ].map(({ corner, cx, cy }) => (
                    <div
                      key={corner}
                      onPointerDown={(event) => handleResizeDown(event, obj, corner)}
                      className="absolute"
                      style={{
                        left: `${cx - HANDLE_SIZE / 2}px`,
                        top: `${cy - HANDLE_SIZE / 2}px`,
                        width: `${HANDLE_SIZE}px`,
                        height: `${HANDLE_SIZE}px`,
                        pointerEvents: isDrawingWall ? 'none' : 'auto',
                        borderRadius: '50%',
                        background: 'white',
                        border: '2px solid #7C3AED',
                        cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                        zIndex: 999,
                        boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
                      }}
                    />
                  ))}
                  <div
                    onPointerDown={(event) => handleRotateDown(event, obj)}
                    className="absolute"
                    style={{
                      left: `${x - 5}px`,
                      top: `${y - height / 2 - ROTATION_HANDLE_OFFSET - 5}px`,
                      width: '10px',
                      height: '10px',
                      pointerEvents: isDrawingWall ? 'none' : 'auto',
                      borderRadius: '50%',
                      background: '#7C3AED',
                      border: '2px solid white',
                      cursor: 'grab',
                      zIndex: 999,
                      boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
                    }}
                  />
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${x}px`,
                      top: `${y - height / 2 - ROTATION_HANDLE_OFFSET}px`,
                      width: '1px',
                      height: `${ROTATION_HANDLE_OFFSET}px`,
                      background: '#7C3AED',
                      opacity: 0.4,
                      zIndex: 998,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}

        {drawingWallStart && currentMousePos && (() => {
          const [x1, y1] = drawingWallStart;
          const [x2, y2] = currentMousePos;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

          return (
            <div
              className="absolute origin-left pointer-events-none"
              style={{
                left: `${x1}px`,
                top: `${y1 - 5}px`,
                width: `${length}px`,
                height: '10px',
                transform: `rotate(${angle}deg)`,
                background: 'rgba(124,58,237,0.4)',
                borderRadius: '2px',
              }}
            >
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '-18px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '9px',
                  color: 'var(--primary-light)',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {(length / 100).toFixed(1)}m
              </div>
            </div>
          );
        })()}

        {selectionBox && Math.abs(selectionBox.x2 - selectionBox.x1) > 3 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${Math.min(selectionBox.x1, selectionBox.x2)}px`,
              top: `${Math.min(selectionBox.y1, selectionBox.y2)}px`,
              width: `${Math.abs(selectionBox.x2 - selectionBox.x1)}px`,
              height: `${Math.abs(selectionBox.y2 - selectionBox.y1)}px`,
              border: '1px dashed var(--primary)',
              background: 'rgba(124,58,237,0.06)',
              borderRadius: '4px',
            }}
          />
        )}

        {measureStart && measureEnd && (() => {
          const dx = measureEnd.x - measureStart.x;
          const dy = measureEnd.y - measureStart.y;
          const length = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <>
              <div
                className="absolute origin-left pointer-events-none"
                style={{
                  left: `${measureStart.x}px`,
                  top: `${measureStart.y}px`,
                  width: `${length}px`,
                  height: '2px',
                  transform: `rotate(${angle}deg)`,
                  background: '#10B981',
                }}
              />
              <div className="absolute rounded-full pointer-events-none" style={{ left: `${measureStart.x - 4}px`, top: `${measureStart.y - 4}px`, width: '8px', height: '8px', background: '#10B981' }} />
              <div className="absolute rounded-full pointer-events-none" style={{ left: `${measureEnd.x - 4}px`, top: `${measureEnd.y - 4}px`, width: '8px', height: '8px', background: '#10B981' }} />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${(measureStart.x + measureEnd.x) / 2}px`,
                  top: `${(measureStart.y + measureEnd.y) / 2 - 20}px`,
                  transform: 'translateX(-50%)',
                  background: 'rgba(16,185,129,0.9)',
                  color: 'white',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDistance(length)}
              </div>
            </>
          );
        })()}

        {measurePoints.length === 2 && (() => {
          const [pointA, pointB] = measurePoints;
          const dx = pointB.x - pointA.x;
          const dy = pointB.y - pointA.y;
          const length = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <>
              <div
                className="absolute origin-left pointer-events-none"
                style={{
                  left: `${pointA.x}px`,
                  top: `${pointA.y}px`,
                  width: `${length}px`,
                  height: '2px',
                  transform: `rotate(${angle}deg)`,
                  background: '#f59e0b',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${(pointA.x + pointB.x) / 2}px`,
                  top: `${(pointA.y + pointB.y) / 2 - 20}px`,
                  transform: 'translateX(-50%)',
                  background: 'rgba(245,158,11,0.9)',
                  color: 'white',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDistance(length)}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
