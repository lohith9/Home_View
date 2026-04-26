import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import { useUIStore } from '../../store/useUIStore';

const GRID = 20;
const SNAP_THRESHOLD = 10;
const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 30;

const snap = (value) => Math.round(value / GRID) * GRID;
const snapAngle = (degrees) => Math.round(degrees / 15) * 15;

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

  const smartSnap = useCallback(
    (x, y, excludeId) => {
      let snappedX = snap(x);
      let snappedY = snap(y);
      const guides = [];

      for (const obj of objects) {
        if (obj.id === excludeId) continue;

        if (obj.type === 'wall') {
          for (const edgeX of [obj.start[0], obj.end[0]]) {
            if (Math.abs(x - edgeX) < SNAP_THRESHOLD) {
              snappedX = edgeX;
              guides.push({ type: 'v', pos: edgeX });
            }
          }

          for (const edgeY of [obj.start[1], obj.end[1]]) {
            if (Math.abs(y - edgeY) < SNAP_THRESHOLD) {
              snappedY = edgeY;
              guides.push({ type: 'h', pos: edgeY });
            }
          }

          continue;
        }

        const centerX = obj.x || 0;
        const centerY = obj.y || 0;
        const width = obj.width || 100;
        const height = obj.height || 100;

        for (const candidateX of [centerX, centerX - width / 2, centerX + width / 2]) {
          if (Math.abs(x - candidateX) < SNAP_THRESHOLD) {
            snappedX = candidateX;
            guides.push({ type: 'v', pos: candidateX });
          }
        }

        for (const candidateY of [centerY, centerY - height / 2, centerY + height / 2]) {
          if (Math.abs(y - candidateY) < SNAP_THRESHOLD) {
            snappedY = candidateY;
            guides.push({ type: 'h', pos: candidateY });
          }
        }
      }

      setSnapGuides(guides);
      return { x: snappedX, y: snappedY };
    },
    [objects, setSnapGuides],
  );

  const handleBackgroundPointerDown = (event) => {
    if (dragItem) return;

    const coords = getCanvasCoords(event.clientX, event.clientY);
    const shouldPan = event.button === 1 || event.button === 2 || event.altKey || event.metaKey;
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
      const nextPoint = [snap(coords.x), snap(coords.y)];
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
        const wallOrigin = wallDragOriginRef.current;
        if (wallOrigin) {
          const rawX = coords.x - dragOffsetRef.current.x;
          const rawY = coords.y - dragOffsetRef.current.y;
          const snapped = smartSnap(rawX, rawY, activeDraggingObjId);
          const deltaX = snapped.x - wallOrigin.midX;
          const deltaY = snapped.y - wallOrigin.midY;
          updateObject(activeDraggingObjId, {
            start: [wallOrigin.start[0] + deltaX, wallOrigin.start[1] + deltaY],
            end: [wallOrigin.end[0] + deltaX, wallOrigin.end[1] + deltaY],
          });
          return;
        }

        const snappedLead = smartSnap(
          coords.x - dragOffsetRef.current.x,
          coords.y - dragOffsetRef.current.y,
          activeDraggingObjId,
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
          updateObject(activeDraggingObjId, snappedLead);
        }

        return;
      }

      if (rotating) {
        const angle = Math.atan2(coords.y - rotateCenter.y, coords.x - rotateCenter.x) * (180 / Math.PI) + 90;
        updateObject(rotating, { rotation: snapAngle(angle) });
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
        let nextX = snap(coords.x);
        let nextY = snap(coords.y);

        if (event.shiftKey) {
          const deltaX = Math.abs(nextX - wallStart[0]);
          const deltaY = Math.abs(nextY - wallStart[1]);
          if (deltaX > deltaY) nextY = wallStart[1];
          else nextX = wallStart[0];
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
    ],
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (dragItem) return;
      if (activePointerIdRef.current != null && event.pointerId != null && event.pointerId !== activePointerIdRef.current) return;

      const wallStart = drawingWallStartRef.current;
      const wallEnd = currentMousePosRef.current;

      if (wallStart && wallEnd) {
        const [x1, y1] = wallStart;
        const [x2, y2] = wallEnd;
        if (Math.hypot(x2 - x1, y2 - y1) > 5) {
          addObject({
            type: 'wall',
            name: 'Wall',
            start: [x1, y1],
            end: [x2, y2],
            thickness: 10,
            price: 5000,
          });
        }

        releasePointer(event.pointerId);
        if (Math.hypot(x2 - x1, y2 - y1) > 5) {
          setDrawingWallStart(null);
          drawingWallStartRef.current = null;
          setCurrentMousePos(null);
          currentMousePosRef.current = null;
          setSnapGuides([]);
        }
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
      addObject,
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

  const handleWheel = (event) => {
    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(Math.max(0.2, zoom * zoomFactor), 5);
    const nextPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const nextPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);
    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

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

  const currency = useDesignStore((state) => state.currency);

  let cursor = 'default';
  if (dragItem) cursor = 'copy';
  else if (isPanning) cursor = 'grabbing';
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
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor, touchAction: 'none' }}
    >
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
        {isDrawingWall ? 'Click and drag to draw a wall' : 'Middle click or Alt + drag to pan'}
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
            🏠
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
                {currency === 'INR' ? `${(length / 100).toFixed(2)}m` : `${((length / 100) * 3.281).toFixed(2)}ft`}
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
                {currency === 'INR' ? `${(length / 100).toFixed(2)}m` : `${((length / 100) * 3.281).toFixed(2)}ft`}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
