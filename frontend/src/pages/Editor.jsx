import React from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import PropertiesPanel from '../components/layout/PropertiesPanel';
import BottomBar from '../components/layout/BottomBar';
import Canvas2D from '../components/canvas/Canvas2D';
import Canvas3D from '../components/canvas/Canvas3D';
import { useUIStore } from '../store/useUIStore';
import { useDesignStore } from '../store/useDesignStore';

export default function Editor() {
  const { viewMode, dragItem, setDragItem, pan, zoom, isDrawingWall } = useUIStore();
  const { addObject, undo, redo, removeObject, selectedIds, duplicateSelected } = useDesignStore();
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
          x = Math.round(x / 20) * 20;
          y = Math.round(y / 20) * 20;
          
          if (dragItem.type === 'wall') {
            addObject({ ...dragItem, start: [x - 100, y], end: [x + 100, y] });
          } else {
            addObject({ ...dragItem, x, y, rotation: 0 });
          }
        }
      }

      setDragItem(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragItem, pan, zoom, addObject, setDragItem]);

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

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT') return;
        selectedIds.forEach((id) => removeObject(id));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedIds, removeObject, duplicateSelected]);

  return (
    <>
      <div className="app-container">
        <TopBar />

        <div className="main-content">
          <Sidebar />

          <div className="canvas-container relative" id="canvas-container-inner">
            {viewMode === '2D' && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '14px',
                  zIndex: 30,
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'rgba(11, 15, 26, 0.78)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                  color: 'var(--text-primary)',
                  backdropFilter: 'blur(14px)',
                  boxShadow: 'var(--shadow-md)',
                  maxWidth: '280px',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary-light)', marginBottom: '4px' }}>
                  2D Plan Editor
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Use 2D to draw walls, place furniture precisely, and align the layout. Switch back to 3D to inspect the room.
                </div>
              </div>
            )}

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

            <div
              className="absolute inset-0"
              style={{
                opacity: viewMode === '2D' ? 1 : 0,
                pointerEvents: viewMode === '2D' ? 'auto' : 'none',
                transition: 'opacity 0.45s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Canvas2D />
            </div>

            <div
              className="absolute inset-0"
              style={{
                opacity: viewMode === '3D' ? 1 : 0,
                pointerEvents: viewMode === '3D' ? 'auto' : 'none',
                transition: 'opacity 0.45s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Canvas3D />
            </div>

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
