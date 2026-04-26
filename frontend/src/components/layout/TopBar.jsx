import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useDesignStore } from '../../store/useDesignStore';
import { Undo, Redo, Download, Save, Wand2, FolderOpen, Sparkles } from 'lucide-react';

const formatTotalCost = (amount, currency) =>
  currency === 'INR'
    ? `Rs ${amount.toLocaleString('en-IN')}`
    : `$${(amount / 80).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function TopBar() {
  const { projectName, setProjectName, viewMode, setViewMode } = useUIStore();
  const { currency, setCurrency, objects, undo, redo, importDesign, past, future } = useDesignStore();
  const fileInputRef = React.useRef(null);
  const [statusText, setStatusText] = React.useState('');

  const totalCost = objects.reduce((sum, obj) => sum + (obj.price || 0), 0);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  React.useEffect(() => {
    if (!statusText) return undefined;
    const timeout = window.setTimeout(() => setStatusText(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [statusText]);

  const handleSave = () => {
    const payload = {
      version: 1,
      projectName,
      savedAt: new Date().toISOString(),
      objects,
    };

    localStorage.setItem('home3d_design', JSON.stringify(payload));
    const button = document.getElementById('save-btn');
    if (button) {
      button.style.color = '#10B981';
      setTimeout(() => {
        button.style.color = '';
      }, 800);
    }
    setStatusText('Project saved locally');
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const data = JSON.parse(raw);
      importDesign(data);
      if (data.projectName) setProjectName(data.projectName);
      setStatusText('Project loaded');
    } catch {
      setStatusText('Invalid project file');
    } finally {
      event.target.value = '';
    }
  };

  const handleExport = () => {
    const payload = {
      version: 1,
      projectName,
      exportedAt: new Date().toISOString(),
      objects,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = projectName.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'home3d-project';

    link.href = url;
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatusText('Project exported');
  };

  return (
    <div className="topbar glass">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleOpenFile}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px var(--primary-glow)',
            }}
          >
            <Sparkles size={14} color="white" />
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: '1rem',
              letterSpacing: '-0.03em',
              background: 'var(--primary-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Home3D
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        <input
          type="text"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          className="project-name-input"
        />
      </div>

      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === '2D' ? 'active' : ''}`}
          onClick={() => setViewMode('2D')}
          data-testid="view-toggle-2d"
        >
          2D Plan
        </button>
        <button
          className={`view-toggle-btn ${viewMode === '3D' ? 'active' : ''}`}
          onClick={() => setViewMode('3D')}
          data-testid="view-toggle-3d"
        >
          3D View
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          className="btn-icon tooltip-container"
          data-tooltip="Undo"
          onClick={undo}
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.25, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo size={15} />
        </button>
        <button
          className="btn-icon tooltip-container"
          data-tooltip="Redo"
          onClick={redo}
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.25, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo size={15} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

        <div className="cost-badge">
          <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
            {formatTotalCost(totalCost, currency)}
          </span>
          <button className="currency-toggle" onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}>
            {currency}
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

        <button
          id="save-btn"
          className="btn-icon tooltip-container"
          data-tooltip="Save"
          onClick={handleSave}
          data-testid="save-project"
        >
          <Save size={15} />
        </button>
        <button className="btn-icon tooltip-container" data-tooltip="Open Project File" onClick={handleOpenClick}>
          <FolderOpen size={15} />
        </button>
        <button className="btn-icon tooltip-container" data-tooltip="Export JSON" onClick={handleExport}>
          <Download size={15} />
        </button>

        <button
          className="btn btn-primary btn-glow"
          style={{
            padding: '7px 16px',
            fontSize: '0.73rem',
            marginLeft: '6px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--primary-gradient)',
            letterSpacing: '0.01em',
          }}
        >
          <Wand2 size={13} /> AI Suggest
        </button>
      </div>

      {statusText && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '-42px',
            transform: 'translateX(-50%)',
            background: 'rgba(11, 15, 26, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.12)',
            borderRadius: '999px',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: '0.74rem',
            fontWeight: 600,
            boxShadow: 'var(--shadow-md)',
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 40,
          }}
        >
          {statusText}
        </div>
      )}
    </div>
  );
}
