import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { Compass, Ruler, Layers, RotateCcw } from 'lucide-react';

export default function BottomBar() {
  const {
    vastuMode, toggleVastuMode,
    isMeasuring, setIsMeasuring, setMeasurePoints,
    setPan, setZoom,
  } = useUIStore();

  const handleMeasureToggle = () => {
    if (isMeasuring) {
      setMeasurePoints([]);
    }
    setIsMeasuring(!isMeasuring);
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <div className="bottom-bar glass">
      <button
        className={`bottom-btn ${vastuMode ? 'active-green' : ''}`}
        onClick={toggleVastuMode}
      >
        <Compass size={16} /> Vastu {vastuMode ? 'ON' : 'OFF'}
      </button>

      <div className="bottom-divider" />

      <button
        className={`bottom-btn ${isMeasuring ? 'active-primary' : ''}`}
        onClick={handleMeasureToggle}
        data-tooltip="Measurement Tool"
      >
        <Ruler size={16} /> Measure
      </button>

      <div className="bottom-divider" />

      <button className="bottom-btn" onClick={handleResetView}>
        <RotateCcw size={16} /> Reset View
      </button>

      <div className="bottom-divider" />

      <div className="floor-selector">
        <Layers size={16} style={{ color: 'var(--text-secondary)' }} />
        <select className="floor-select">
          <option value="1">Ground Floor</option>
          <option value="2">First Floor</option>
          <option value="3">Roof</option>
        </select>
      </div>
    </div>
  );
}
