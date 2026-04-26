/**
 * useDrag — Hook that provides canvas-coordinate-aware drag handling.
 *
 * Uses useDesignStore as the single source of truth.
 * Converts client coordinates to canvas coordinates using pan/zoom
 * and snaps to the 20px grid, matching Canvas2D behaviour.
 */
import { useCallback, useRef } from 'react';
import { useDesignStore } from '../store/useDesignStore';
import { useUIStore } from '../store/useUIStore';

const GRID = 20;
const snap = (v) => Math.round(v / GRID) * GRID;

export const useDrag = () => {
  const updateObject = useDesignStore((s) => s.updateObject);
  const _pushHistory = useDesignStore((s) => s._pushHistory);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const pan = useUIStore((s) => s.pan);
  const zoom = useUIStore((s) => s.zoom);

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const historyPushed = useRef(false);

  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;

  /**
   * Call on pointerdown to start tracking a drag.
   * @param {PointerEvent} e
   * @param {{ x: number, y: number }} objPosition - current position of the object
   */
  const onDragStart = useCallback(
    (e, objPosition) => {
      isDragging.current = true;
      historyPushed.current = false;

      // Store offset between pointer and object centre (in canvas coords)
      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;
      dragOffset.current = {
        x: canvasX - (objPosition?.x || 0),
        y: canvasY - (objPosition?.y || 0),
      };
    },
    [pan, zoom],
  );

  /**
   * Call on pointermove to update the object position.
   * Automatically pushes undo history on first move.
   * @param {PointerEvent} e
   */
  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging.current || !selectedId) return;

      // Push history once per drag gesture
      if (!historyPushed.current) {
        _pushHistory();
        historyPushed.current = true;
      }

      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;

      updateObject(selectedId, {
        x: snap(canvasX - dragOffset.current.x),
        y: snap(canvasY - dragOffset.current.y),
      });
    },
    [selectedId, updateObject, _pushHistory, pan, zoom],
  );

  /**
   * Call on pointerup to finalize the drag.
   */
  const onDragEnd = useCallback(() => {
    isDragging.current = false;
    historyPushed.current = false;
  }, []);

  return { onDragStart, onPointerMove, onDragEnd, isDraggingRef: isDragging };
};
