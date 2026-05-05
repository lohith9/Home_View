import React from 'react';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Move,
  RotateCw,
  Maximize2,
  Palette,
  DollarSign,
  Box,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';

const formatItemCost = (amount, currency) =>
  currency === 'INR' ? `Rs ${amount.toLocaleString('en-IN')}` : `$${Math.round(amount / 80)}`;

export default function PropertiesPanel() {
  const {
    objects,
    selectedIds,
    updateObjectWithHistory,
    removeObject,
    removeObjects,
    currency,
    bringForward,
    sendBackward,
    duplicateSelected,
  } = useDesignStore();

  const selectedObjects = objects.filter((obj) => selectedIds.includes(obj.id));

  if (selectedObjects.length === 0) {
    return (
      <div
        className="properties-panel"
        style={{
          background: 'var(--panel-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          <div className="empty-state-icon" style={{ margin: '0 auto 16px' }}>
            <Box size={22} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No Selection</div>
          <div style={{ fontSize: '0.72rem' }}>Click an object to inspect properties</div>
        </div>
      </div>
    );
  }

  if (selectedObjects.length > 1) {
    const totalPrice = selectedObjects.reduce((sum, obj) => sum + (obj.price || 0), 0);

    return (
      <div className="properties-panel animate-fade-in" style={{ background: 'var(--panel-bg)' }}>
        <h3 className="panel-title" style={{ marginBottom: '1.25rem' }}>
          {selectedObjects.length} Objects Selected
        </h3>
        <div className="prop-section">
          <div className="prop-label">Total Cost</div>
          <div className="prop-value-large">{formatItemCost(totalPrice, currency)}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
          <button className="btn btn-primary" style={{ flex: 1, borderRadius: 'var(--radius-md)' }} onClick={duplicateSelected}>
            <Copy size={14} /> Duplicate
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1, borderRadius: 'var(--radius-md)' }}
            onClick={() => removeObjects(selectedIds)}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    );
  }

  const selectedObj = selectedObjects[0];
  const isWall = selectedObj.type === 'wall';

  const handleNumberChange = (field, value) => {
    updateObjectWithHistory(selectedObj.id, {
      [field]: Number.isFinite(Number(value)) ? Number(value) : 0,
    });
  };

  return (
    <div className="properties-panel animate-fade-in" style={{ background: 'var(--panel-bg)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '0.25rem',
        }}
      >
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            {selectedObj.name || selectedObj.type}
          </h3>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px', display: 'block' }}>
            {selectedObj.type}
            {selectedObj.subType ? ` | ${selectedObj.subType}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button className="btn-icon tooltip-container" data-tooltip="Duplicate" onClick={duplicateSelected}>
            <Copy size={14} />
          </button>
          <button className="btn-icon tooltip-container" data-tooltip="Bring Forward" onClick={() => bringForward(selectedObj.id)}>
            <ChevronUp size={14} />
          </button>
          <button className="btn-icon tooltip-container" data-tooltip="Send Backward" onClick={() => sendBackward(selectedObj.id)}>
            <ChevronDown size={14} />
          </button>
          <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeObject(selectedObj.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {!isWall && (
          <div className="prop-section">
            <div className="prop-section-header">
              <div className="prop-section-icon">
                <Maximize2 size={13} />
              </div>
              <div className="prop-label" style={{ marginBottom: 0 }}>
                Dimensions
              </div>
            </div>
            <div className="prop-grid-3">
              <div>
                <label className="prop-sub-label">Width</label>
                <input type="number" className="prop-input" value={selectedObj.width || 0} onChange={(event) => handleNumberChange('width', event.target.value)} />
              </div>
              <div>
                <label className="prop-sub-label">Height</label>
                <input type="number" className="prop-input" value={selectedObj.height || 0} onChange={(event) => handleNumberChange('height', event.target.value)} />
              </div>
              <div>
                <label className="prop-sub-label">Depth</label>
                <input type="number" className="prop-input" value={selectedObj.depth || 0} onChange={(event) => handleNumberChange('depth', event.target.value)} />
              </div>
            </div>
          </div>
        )}

        {!isWall && selectedObj.attachedTo && (
          <div className="prop-section">
            <div className="prop-section-header">
              <div className="prop-section-icon" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10B981' }}>
                <Box size={13} />
              </div>
              <div className="prop-label" style={{ marginBottom: 0 }}>
                Constraints
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px' }} aria-hidden="true">LINK</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10B981' }}>Attached to wall</span>
              </div>
              <button
                className="btn-icon"
                style={{ padding: '4px', color: 'var(--text-muted)', fontSize: '0.65rem' }}
                onClick={() => updateObjectWithHistory(selectedObj.id, { attachedTo: null })}
                title="Detach from wall"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="prop-section">
          <div className="prop-section-header">
            <div className="prop-section-icon">
              <Move size={13} />
            </div>
            <div className="prop-label" style={{ marginBottom: 0 }}>
              Position
            </div>
          </div>
          <div className="prop-grid-3">
            {isWall ? (
              <>
                <div>
                  <label className="prop-sub-label">X1</label>
                  <input type="number" className="prop-input" value={selectedObj.start?.[0] || 0} readOnly />
                </div>
                <div>
                  <label className="prop-sub-label">Y1</label>
                  <input type="number" className="prop-input" value={selectedObj.start?.[1] || 0} readOnly />
                </div>
                <div>
                  <label className="prop-sub-label">Length</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={
                      selectedObj.start && selectedObj.end
                        ? Math.round(
                            Math.hypot(
                              selectedObj.end[0] - selectedObj.start[0],
                              selectedObj.end[1] - selectedObj.start[1],
                            ),
                          )
                        : 0
                    }
                    readOnly
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="prop-sub-label">X</label>
                  <input type="number" className="prop-input" value={Math.round(selectedObj.x || 0)} onChange={(event) => handleNumberChange('x', event.target.value)} />
                </div>
                <div>
                  <label className="prop-sub-label">Y</label>
                  <input type="number" className="prop-input" value={Math.round(selectedObj.y || 0)} onChange={(event) => handleNumberChange('y', event.target.value)} />
                </div>
                <div>
                  <label className="prop-sub-label">Z</label>
                  <input type="number" className="prop-input" value={0} readOnly />
                </div>
              </>
            )}
          </div>
        </div>

        {!isWall && (
          <div className="prop-section">
            <div className="prop-section-header">
              <div className="prop-section-icon">
                <RotateCw size={13} />
              </div>
              <div className="prop-label" style={{ marginBottom: 0 }}>
                Rotation
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0"
                max="360"
                step="15"
                className="prop-slider"
                value={selectedObj.rotation || 0}
                onChange={(event) => handleNumberChange('rotation', event.target.value)}
                style={{ flex: 1 }}
              />
              <div
                style={{
                  minWidth: '48px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--primary-light)',
                  background: 'rgba(124,58,237,0.08)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {selectedObj.rotation || 0} deg
              </div>
            </div>
          </div>
        )}

        {!isWall && (
          <div className="prop-section">
            <div className="prop-section-header">
              <div className="prop-section-icon">
                <Palette size={13} />
              </div>
              <div className="prop-label" style={{ marginBottom: 0 }}>
                Material
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['#ffffff', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'].map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{
                    backgroundColor: color,
                    boxShadow:
                      selectedObj.color === color
                        ? `0 0 0 2px var(--primary), 0 0 12px ${color}44`
                        : 'var(--shadow-xs)',
                    transform: selectedObj.color === color ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onClick={() => updateObjectWithHistory(selectedObj.id, { color })}
                />
              ))}
            </div>
          </div>
        )}

        <div className="prop-section" style={{ borderBottom: 'none' }}>
          <div className="prop-section-header">
            <div className="prop-section-icon">
              <DollarSign size={13} />
            </div>
            <div className="prop-label" style={{ marginBottom: 0 }}>
              Cost
            </div>
          </div>
          <div className="cost-card">
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
              Estimated Cost
            </div>
            <div className="prop-value-large">{formatItemCost(selectedObj.price || 0, currency)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
