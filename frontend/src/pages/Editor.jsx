import React from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import PropertiesPanel from '../components/layout/PropertiesPanel';
import BottomBar from '../components/layout/BottomBar';
import Canvas2D from '../components/canvas/Canvas2D';
import Canvas3D from '../components/canvas/Canvas3D';
import { useUIStore } from '../store/useUIStore';
import { useDesignStore } from '../store/useDesignStore';
import { resolveConstraints } from '../engine/constraintEngine';

export default function Editor() {
  const { viewMode, dragItem, clearPaletteDrag, pan, zoom, isDrawingWall, cancelActiveTool } = useUIStore();
  const { addObject, undo, redo, removeObjects, selectedIds, duplicateSelected } = useDesignStore();
  const [mousePos, setMousePos] = React.useState({
    x: dragItem?.offsetX || 0,
    y: dragItem?.offsetY || 0,
  });

  React.useEffect(() => {
    if (!dragItem) return;

    const handleMouseMove = (event) => {
      setMousePos({ x: event.clientX, y: event.clientY });
    };

    const handleMouseUp = (event) => {
      const canvasEl = document.getElementById('canvas-container-inner');
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const isInsideCanvas =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (isInsideCanvas) {
          let x = (event.clientX - rect.left - pan.x) / zoom;
          let y = (event.clientY - rect.top - pan.y) / zoom;
          
          if (dragItem.type === 'wall') {
            // Walls snap strictly to 20px grid
            x = Math.round(x / 20) * 20;
            y = Math.round(y / 20) * 20;
            addObject({ ...dragItem, start: [x - 100, y], end: [x + 100, y] });
          } else {
            // Other items use the constraint engine to auto-attach if dropped on a wall
            const snap = resolveConstraints(x, y, {
              objectType: dragItem.type,
              objects: useDesignStore.getState().objects,
              gridSize: 20
            });
            
            addObject({ 
              ...dragItem, 
              x: snap.x, 
              y: snap.y, 
              rotation: 0,
              attachedTo: snap.attachment ? snap.attachment.wallId : null
            });
          }
        }
      }

      clearPaletteDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragItem, pan, zoom, addObject, clearPaletteDrag]);

  const previewMousePos = dragItem
    ? {
        x: mousePos.x || dragItem.offsetX || 0,
        y: mousePos.y || dragItem.offsetY || 0,
      }
    : mousePos;

  React.useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        redo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
      }

      if (event.key === 'Escape') {
        cancelActiveTool();
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeElement = document.activeElement;
        const isTypingTarget =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'SELECT' ||
          activeElement?.isContentEditable;
        if (isTypingTarget) return;
        removeObjects(selectedIds);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedIds, removeObjects, duplicateSelected, cancelActiveTool]);

  return (
    <>
      <div className="app-container">
        <TopBar />

        <div className="main-content">
          <Sidebar />

          <div className="canvas-container relative" id="canvas-container-inner">
            {viewMode === '3D' && isDrawingWall && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 30,
                  padding: '10px 14px',
                  borderRadius: '999px',
                  background: 'rgba(124, 58, 237, 0.16)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  color: 'white',
                  backdropFilter: 'blur(14px)',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                Wall drawing happens in 2D plan view
              </div>
            )}

            {viewMode === '2D' ? <Canvas2D /> : <Canvas3D />}

            <BottomBar />
          </div>

          <PropertiesPanel />
        </div>
      </div>

      {dragItem && (
        <div
          className="ghost-preview"
          style={{
            left: previewMousePos.x,
            top: previewMousePos.y,
            width: `${Math.max(56, (dragItem.width || 100) * 0.45)}px`,
            height: `${Math.max(36, (dragItem.height || 100) * 0.45)}px`,
            background: `${dragItem.color || '#7C3AED'}15`,
            borderColor: `${dragItem.color || '#7C3AED'}88`,
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, letterSpacing: '0.08em' }}>
            {dragItem.icon || 'OBJ'}
          </span>
          <span style={{ fontSize: '8px', color: 'white', fontWeight: 700, letterSpacing: '0.03em' }}>
            {dragItem.name}
          </span>
        </div>
      )}
    </>
  );
}
