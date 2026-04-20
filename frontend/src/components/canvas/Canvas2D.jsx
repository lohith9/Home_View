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
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingObjId, setDraggingObjId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [drawingWallStart, setDrawingWallStart] = useState(null);
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [rotateCenter, setRotateCenter] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);

  const dragStartRef = useRef(null);
  const dragSelectionOriginsRef = useRef({});
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

  const handleBackgroundMouseDown = (event) => {
    if (dragItem) return;

    const coords = getCanvasCoords(event.clientX, event.clientY);

    const shouldPan = event.button === 1 || event.button === 2 || event.altKey || event.metaKey;
    if (shouldPan) {
      event.preventDefault();
      setIsPanning(true);
      setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
      return;
    }

    if (event.button !== 0) return;

    if (isMeasuring) {
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
      const start = [snap(coords.x), snap(coords.y)];
      setDrawingWallStart(start);
      setCurrentMousePos(start);
      clearSelection();
      return;
    }

    setSelectionBox({
      x1: coords.x,
      y1: coords.y,
      x2: coords.x,
      y2: coords.y,
      additive: event.shiftKey,
    });
  };

  const handleMouseMove = (event) => {
    if (dragItem) return;
    const coords = getCanvasCoords(event.clientX, event.clientY);

    if (isMeasuring && measureStart) {
      setMeasureEnd({ x: snap(coords.x), y: snap(coords.y) });
      return;
    }

    if (draggingObjId) {
      const snappedLead = smartSnap(coords.x - dragOffset.x, coords.y - dragOffset.y, draggingObjId);
      const leadOrigin = dragStartRef.current || snappedLead;
      const deltaX = snappedLead.x - leadOrigin.x;
      const deltaY = snappedLead.y - leadOrigin.y;

      if (selectedIds.length > 1 && selectedIds.includes(draggingObjId)) {
        for (const id of selectedIds) {
          const origin = dragSelectionOriginsRef.current[id];
          if (!origin) continue;
          updateObject(id, {
            x: origin.x + deltaX,
            y: origin.y + deltaY,
          });
        }
      } else {
        updateObject(draggingObjId, snappedLead);
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

    if (drawingWallStart) {
      let nextX = snap(coords.x);
      let nextY = snap(coords.y);

      if (event.shiftKey) {
        const deltaX = Math.abs(nextX - drawingWallStart[0]);
        const deltaY = Math.abs(nextY - drawingWallStart[1]);
        if (deltaX > deltaY) nextY = drawingWallStart[1];
        else nextX = drawingWallStart[0];
      }

      setCurrentMousePos([nextX, nextY]);
      return;
    }

    if (isPanning) {
      setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
      return;
    }

    if (selectionBox) {
      setSelectionBox((current) => (current ? { ...current, x2: coords.x, y2: coords.y } : null));
    }
  };

  const handleMouseUp = () => {
    if (dragItem) return;

    if (drawingWallStart && currentMousePos) {
      const [x1, y1] = drawingWallStart;
      const [x2, y2] = currentMousePos;
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

      setDrawingWallStart(null);
      setCurrentMousePos(null);
      setSnapGuides([]);
      return;
    }

    if (draggingObjId) {
      setDraggingObjId(null);
      dragStartRef.current = null;
      dragSelectionOriginsRef.current = {};
      setSnapGuides([]);
      return;
    }

    if (rotating) {
      setRotating(null);
      setRotateCenter(null);
      return;
    }

    if (resizing) {
      setResizing(null);
      setResizeStart(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
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
    }
  };

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

  const handleObjectMouseDown = (event, obj) => {
    event.stopPropagation();
    if (isMeasuring || obj.type === 'wall') {
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

    const coords = getCanvasCoords(event.clientX, event.clientY);
    setDragOffset({
      x: coords.x - (obj.x || 0),
      y: coords.y - (obj.y || 0),
    });
    setDraggingObjId(obj.id);
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
      onMouseDown={handleBackgroundMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsPanning(false);
        setDrawingWallStart(null);
        setCurrentMousePos(null);
        setDraggingObjId(null);
        setRotating(null);
        setResizing(null);
        setSelectionBox(null);
        setSnapGuides([]);
        dragStartRef.current = null;
        dragSelectionOriginsRef.current = {};
      }}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor }}
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

            return (
              <div key={obj.id}>
                <div
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (event.shiftKey) toggleSelect(obj.id);
                    else selectObject(obj.id);
                  }}
                  className="absolute origin-left cursor-pointer"
                  style={{
                    left: `${x1}px`,
                    top: `${y1 - (obj.thickness || 10) / 2}px`,
                    width: `${length}px`,
                    height: `${obj.thickness || 10}px`,
                    transform: `rotate(${angle}deg)`,
                    background: isSelected ? '#7C3AED' : '#94A3B8',
                    boxShadow: isSelected ? '0 0 16px rgba(124,58,237,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
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

          return (
            <div key={obj.id}>
              <div
                onMouseDown={(event) => handleObjectMouseDown(event, obj)}
                className="absolute cursor-pointer"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  background: isSelected
                    ? `linear-gradient(135deg, ${itemColor}dd, ${itemColor}99)`
                    : `linear-gradient(135deg, ${itemColor}aa, ${itemColor}66)`,
                  border: isSelected ? '2px solid #7C3AED' : `1.5px solid ${itemColor}88`,
                  borderRadius: '6px',
                  boxShadow: isSelected
                    ? '0 0 0 1px rgba(124,58,237,0.3), 0 0 20px rgba(124,58,237,0.25), 0 4px 12px rgba(0,0,0,0.3)'
                    : '0 2px 8px rgba(0,0,0,0.25)',
                  zIndex: (obj.zIndex || 0) + 1,
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
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
                      onMouseDown={(event) => handleResizeDown(event, obj, corner)}
                      className="absolute"
                      style={{
                        left: `${cx - HANDLE_SIZE / 2}px`,
                        top: `${cy - HANDLE_SIZE / 2}px`,
                        width: `${HANDLE_SIZE}px`,
                        height: `${HANDLE_SIZE}px`,
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
                    onMouseDown={(event) => handleRotateDown(event, obj)}
                    className="absolute"
                    style={{
                      left: `${x - 5}px`,
                      top: `${y - height / 2 - ROTATION_HANDLE_OFFSET - 5}px`,
                      width: '10px',
                      height: '10px',
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
