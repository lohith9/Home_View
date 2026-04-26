import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useDesignStore } from '../../store/useDesignStore';
import { Search, Square, DoorOpen, BedDouble, ChefHat, Bath, Palette } from 'lucide-react';

const categories = [
  { id: 'walls', icon: Square, label: 'Walls' },
  { id: 'doors', icon: DoorOpen, label: 'Doors & Windows' },
  { id: 'furniture', icon: BedDouble, label: 'Furniture' },
  { id: 'kitchen', icon: ChefHat, label: 'Kitchen' },
  { id: 'bathroom', icon: Bath, label: 'Bathroom' },
  { id: 'materials', icon: Palette, label: 'Materials' },
];

const catalogItems = {
  furniture: [
    { name: 'Sofa', price: 45000, type: 'furniture', subType: 'sofa', width: 200, height: 80, depth: 85, color: '#6366F1', icon: 'SOFA' },
    { name: 'Queen Bed', price: 35000, type: 'furniture', subType: 'bed', width: 160, height: 200, depth: 50, color: '#8B5CF6', icon: 'BED' },
    { name: 'Dining Table', price: 25000, type: 'furniture', subType: 'table', width: 160, height: 90, depth: 75, color: '#A16207', icon: 'TBL' },
    { name: 'Wardrobe', price: 28000, type: 'furniture', subType: 'wardrobe', width: 180, height: 60, depth: 200, color: '#7C3AED', icon: 'WRD' },
    { name: 'TV Unit', price: 18000, type: 'furniture', subType: 'tvunit', width: 180, height: 40, depth: 55, color: '#374151', icon: 'TV' },
    { name: 'Study Desk', price: 15000, type: 'furniture', subType: 'desk', width: 120, height: 60, depth: 75, color: '#92400E', icon: 'DSK' },
    { name: 'Chair', price: 8000, type: 'furniture', subType: 'chair', width: 50, height: 50, depth: 90, color: '#0D9488', icon: 'CHR' },
    { name: 'Bookshelf', price: 12000, type: 'furniture', subType: 'bookshelf', width: 120, height: 35, depth: 180, color: '#78350F', icon: 'BKS' },
  ],
  doors: [
    { name: 'Single Door', price: 15000, type: 'door', subType: 'door', width: 90, height: 15, depth: 210, color: '#92400E', icon: 'DR' },
    { name: 'Double Door', price: 22000, type: 'door', subType: 'door', width: 160, height: 15, depth: 210, color: '#78350F', icon: 'DDR' },
    { name: 'Window', price: 12000, type: 'window', subType: 'window', width: 120, height: 10, depth: 120, color: '#0EA5E9', icon: 'WIN' },
    { name: 'Sliding Window', price: 18000, type: 'window', subType: 'window', width: 180, height: 10, depth: 150, color: '#0284C7', icon: 'SLD' },
  ],
  kitchen: [
    { name: 'Counter Top', price: 35000, type: 'furniture', subType: 'counter', width: 240, height: 60, depth: 90, color: '#57534E', icon: 'CTR' },
    { name: 'Refrigerator', price: 45000, type: 'furniture', subType: 'fridge', width: 70, height: 70, depth: 180, color: '#E5E7EB', icon: 'FRG' },
    { name: 'Stove', price: 20000, type: 'furniture', subType: 'stove', width: 60, height: 60, depth: 90, color: '#1F2937', icon: 'STV' },
    { name: 'Sink', price: 10000, type: 'furniture', subType: 'sink', width: 60, height: 50, depth: 85, color: '#9CA3AF', icon: 'SNK' },
  ],
  bathroom: [
    { name: 'Bathtub', price: 25000, type: 'furniture', subType: 'bathtub', width: 170, height: 75, depth: 60, color: '#E0F2FE', icon: 'BTH' },
    { name: 'Toilet', price: 8000, type: 'furniture', subType: 'toilet', width: 40, height: 65, depth: 40, color: '#F3F4F6', icon: 'WC' },
    { name: 'Wash Basin', price: 12000, type: 'furniture', subType: 'basin', width: 55, height: 45, depth: 85, color: '#DBEAFE', icon: 'BSN' },
    { name: 'Shower', price: 15000, type: 'furniture', subType: 'shower', width: 90, height: 90, depth: 210, color: '#BAE6FD', icon: 'SHR' },
  ],
  materials: [
    { name: 'Marble Floor', price: 8000, type: 'furniture', subType: 'floor', width: 200, height: 200, depth: 5, color: '#E2E8F0', icon: '◻️' },
    { name: 'Wood Floor', price: 6000, type: 'furniture', subType: 'floor', width: 200, height: 200, depth: 5, color: '#92400E', icon: '🪵' },
    { name: 'Ceramic Tiles', price: 3500, type: 'furniture', subType: 'floor', width: 200, height: 200, depth: 5, color: '#CBD5E1', icon: '🔲' },
    { name: 'Carpet', price: 4500, type: 'furniture', subType: 'floor', width: 200, height: 200, depth: 3, color: '#7C3AED', icon: '🟪' },
    { name: 'Granite Slab', price: 12000, type: 'furniture', subType: 'counter', width: 180, height: 60, depth: 5, color: '#1E293B', icon: '⬛' },
    { name: 'Planter Box', price: 5000, type: 'furniture', subType: 'planter', width: 60, height: 60, depth: 80, color: '#166534', icon: '🌿' },
  ],
};

const formatPrice = (price, currency) =>
  currency === 'INR' ? `Rs ${price.toLocaleString('en-IN')}` : `$${Math.round(price / 80)}`;

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    beginPaletteDrag,
    viewMode,
    setViewMode,
    isDrawingWall,
    toggleWallDrawing,
    setIsMeasuring,
  } = useUIStore();
  const { currency } = useDesignStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleMouseDown = (event, item) => {
    event.preventDefault();
    if (viewMode !== '2D') setViewMode('2D');
    beginPaletteDrag({ ...item, offsetX: event.clientX, offsetY: event.clientY });
  };

  const allItems = catalogItems[activeTab] || [];
  const currentItems = searchQuery
    ? allItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allItems;

  return (
    <div className="sidebar">
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: '10px',
          }}
        >
          Components
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
            size={14}
          />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 10px 9px 32px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              fontWeight: 500,
            }}
            onFocus={(event) => {
              event.target.style.borderColor = 'var(--primary)';
              event.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
            }}
            onBlur={(event) => {
              event.target.style.borderColor = 'var(--border-color)';
              event.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: '52px',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: '2px',
            background: 'var(--bg-color)',
          }}
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeTab === category.id;

            return (
              <button
                key={category.id}
                data-testid={`sidebar-category-${category.id}`}
                onClick={() => {
                  setActiveTab(category.id);
                  setSearchQuery('');
                }}
                className="tooltip-container"
                data-tooltip={category.label}
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'rgba(124, 58, 237, 0.12)' : 'transparent',
                  color: isActive ? 'var(--primary-light)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '0',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '16px',
                      borderRadius: '0 3px 3px 0',
                      background: 'var(--primary-gradient)',
                    }}
                  />
                )}
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              </button>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {activeTab === 'walls' && (
            <div
              className="drag-item select-none"
              data-testid="wall-tool-toggle"
              onClick={() => {
                if (viewMode !== '2D') setViewMode('2D');
                toggleWallDrawing();
                setIsMeasuring(false);
              }}
              style={{
                cursor: 'pointer',
                borderColor: isDrawingWall ? 'rgba(124, 58, 237, 0.3)' : undefined,
                background: isDrawingWall ? 'rgba(124,58,237,0.08)' : undefined,
                boxShadow: isDrawingWall
                  ? '0 0 0 1px rgba(124,58,237,0.2), 0 4px 12px rgba(124,58,237,0.1)'
                  : undefined,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '56px',
                  background: isDrawingWall ? 'rgba(124,58,237,0.06)' : 'var(--bg-color)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Square
                  size={24}
                  style={{
                    color: isDrawingWall ? 'var(--primary-light)' : 'var(--text-muted)',
                    transition: 'color 0.2s',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: isDrawingWall ? 'var(--primary-light)' : 'var(--text-primary)',
                  transition: 'color 0.2s',
                }}
              >
                {isDrawingWall ? '✓ Drawing Mode Active' : 'Draw Wall'}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                {isDrawingWall ? 'Click on canvas to draw. Click here to exit.' : 'Click to enter wall drawing mode'}
              </span>
            </div>
          )}

          {currentItems.map((item, index) => (
            <div
              key={item.name}
              className="drag-item select-none animate-fade-in"
              data-testid={`catalog-item-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              style={{ animationDelay: `${index * 30}ms` }}
              onMouseDown={(event) => {
                event.stopPropagation();
                handleMouseDown(event, item);
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '56px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: `linear-gradient(135deg, ${item.color}0A, ${item.color}15)`,
                  position: 'relative',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', pointerEvents: 'none' }}>
                  {item.icon}
                </span>
                <div
                  style={{
                    position: 'absolute',
                    right: '8px',
                    bottom: '6px',
                    width: `${Math.min(36, item.width / 5)}px`,
                    height: `${Math.min(26, item.height / 5)}px`,
                    background: item.color,
                    borderRadius: '2px',
                    opacity: 0.15,
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  padding: '0 2px',
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    background: 'var(--primary-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {formatPrice(item.price, currency)}
                </span>
              </div>
            </div>
          ))}

          {currentItems.length === 0 && activeTab !== 'walls' && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                marginTop: '3rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div className="empty-state-icon">
                <Search size={20} />
              </div>
              {searchQuery ? 'No items found' : 'Coming soon'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
