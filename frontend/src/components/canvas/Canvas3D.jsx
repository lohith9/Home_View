import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignStore } from '../../store/useDesignStore';
import { useUIStore } from '../../store/useUIStore';

const SCALE = 100;

function Sofa3D({ w, d, h, color }) {
  const seatHeight = 0.4;
  const backHeight = h / SCALE - seatHeight;

  return (
    <group>
      <mesh position={[0, seatHeight / 2, 0]} castShadow>
        <boxGeometry args={[w / SCALE, seatHeight, d / SCALE]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, seatHeight + backHeight / 2, -(d / SCALE) / 2 + 0.08]} castShadow>
        <boxGeometry args={[w / SCALE, backHeight, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Bed3D({ w, d }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[w / SCALE, 0.3, d / SCALE]} />
        <meshStandardMaterial color="#78350F" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[w / SCALE - 0.05, 0.2, d / SCALE - 0.05]} />
        <meshStandardMaterial color="#F5F5F4" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Table3D({ w, d, h, color }) {
  const tableHeight = h / SCALE;
  const legSize = 0.06;

  return (
    <group>
      <mesh position={[0, tableHeight, 0]} castShadow>
        <boxGeometry args={[w / SCALE, 0.05, d / SCALE]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], index) => (
        <mesh key={index} position={[sx * (w / SCALE / 2 - legSize), tableHeight / 2, sz * (d / SCALE / 2 - legSize)]} castShadow>
          <boxGeometry args={[legSize, tableHeight, legSize]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Chair3D({ w, d, color }) {
  const seatHeight = 0.45;
  const legSize = 0.04;

  return (
    <group>
      <mesh position={[0, seatHeight, 0]} castShadow>
        <boxGeometry args={[w / SCALE, 0.05, d / SCALE]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], index) => (
        <mesh key={index} position={[sx * (w / SCALE / 2 - legSize), seatHeight / 2, sz * (d / SCALE / 2 - legSize)]} castShadow>
          <boxGeometry args={[legSize, seatHeight, legSize]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function BoxObj3D({ w, d, h, color }) {
  return (
    <mesh position={[0, (h / SCALE) / 2, 0]} castShadow>
      <boxGeometry args={[w / SCALE, h / SCALE, d / SCALE]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
    </mesh>
  );
}

function Door3D({ w, h, color }) {
  return (
    <mesh position={[0, (h / SCALE) / 2, 0]} castShadow>
      <boxGeometry args={[w / SCALE, h / SCALE, 0.06]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function Window3D({ w, h }) {
  return (
    <mesh position={[0, (h / SCALE) / 2, 0]}>
      <boxGeometry args={[w / SCALE, h / SCALE, 0.04]} />
      <meshStandardMaterial color="#BAE6FD" transparent opacity={0.4} roughness={0.1} metalness={0.3} />
    </mesh>
  );
}

function Bathtub3D({ w, d, h }) {
  return (
    <mesh position={[0, (h / SCALE) / 2, 0]} castShadow>
      <boxGeometry args={[w / SCALE, h / SCALE, d / SCALE]} />
      <meshStandardMaterial color="#E5E7EB" roughness={0.3} metalness={0.1} />
    </mesh>
  );
}

function Toilet3D({ w, d }) {
  return (
    <mesh position={[0, 0.2, 0.05]} castShadow>
      <boxGeometry args={[w / SCALE, 0.4, d / SCALE * 0.7]} />
      <meshStandardMaterial color="#F3F4F6" roughness={0.2} />
    </mesh>
  );
}

function DraggableObject({ obj, isSelected, onClick, onGrabStart, onDragStart, onDrag, onDragEnd }) {
  const { camera, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const dragOffset = useRef(new THREE.Vector3());
  const dragHistoryStarted = useRef(false);

  if (obj.type === 'wall') {
    const [x1, y1] = obj.start;
    const [x2, y2] = obj.end;
    const length = Math.hypot(x2 - x1, y2 - y1) / SCALE;
    const angle = -Math.atan2(y2 - y1, x2 - x1);
    const midX = (x1 + x2) / 2 / SCALE;
    const midZ = (y1 + y2) / 2 / SCALE;

    return (
      <mesh position={[midX, 1.5, midZ]} rotation={[0, angle, 0]} onClick={(event) => { event.stopPropagation(); onClick(obj.id); }} castShadow>
        <boxGeometry args={[length, 3, 0.15]} />
        <meshStandardMaterial color={isSelected ? '#7C3AED' : '#E2E8F0'} roughness={0.9} />
      </mesh>
    );
  }

  const width = obj.width || 100;
  const height = obj.height || 100;
  const depth = obj.depth || 80;
  const x = (obj.x || 0) / SCALE;
  const z = (obj.y || 0) / SCALE;
  const color = obj.color || '#94A3B8';

  const getModel = () => {
    switch (obj.subType) {
      case 'sofa':
        return <Sofa3D w={width} d={height} h={depth} color={color} />;
      case 'bed':
        return <Bed3D w={width} d={height} />;
      case 'table':
        return <Table3D w={width} d={height} h={depth} color={color} />;
      case 'chair':
        return <Chair3D w={width} d={height} color={color} />;
      case 'door':
        return <Door3D w={width} h={depth} color={color} />;
      case 'window':
        return <Window3D w={width} h={depth} />;
      case 'bathtub':
        return <Bathtub3D w={width} d={height} h={depth} />;
      case 'toilet':
        return <Toilet3D w={width} d={height} />;
      default:
        return <BoxObj3D w={width} d={height} h={depth} color={color} />;
    }
  };

  const getNormalizedPointer = (event) => {
    const rect = gl.domElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  const handlePointerDown = (event) => {
    event.stopPropagation();
    onClick(obj.id);
    onGrabStart();

    const pointer = getNormalizedPointer(event);
    const intersection = new THREE.Vector3();
    raycaster.current.setFromCamera(pointer, camera);
    raycaster.current.ray.intersectPlane(floorPlane.current, intersection);
    dragOffset.current.set(intersection.x - x, 0, intersection.z - z);

    dragHistoryStarted.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;

    const pointer = getNormalizedPointer(event);
    const intersection = new THREE.Vector3();
    raycaster.current.setFromCamera(pointer, camera);
    raycaster.current.ray.intersectPlane(floorPlane.current, intersection);

    if (!dragHistoryStarted.current) {
      onDragStart();
      dragHistoryStarted.current = true;
    }

    const nextX = Math.round(((intersection.x - dragOffset.current.x) * SCALE) / 20) * 20;
    const nextY = Math.round(((intersection.z - dragOffset.current.z) * SCALE) / 20) * 20;
    onDrag(obj.id, { x: nextX, y: nextY });
  };

  const handlePointerUp = (event) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragHistoryStarted.current = false;
    onDragEnd();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, -(obj.rotation || 0) * Math.PI / 180, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {getModel()}
      {isSelected && (
        <mesh position={[0, (depth / SCALE) / 2, 0]}>
          <boxGeometry args={[width / SCALE + 0.06, depth / SCALE + 0.06, height / SCALE + 0.06]} />
          <meshBasicMaterial color="#7C3AED" wireframe transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

function SceneContent({ objects, selectedIds, selectObject, clearSelection, updateObject, startDragHistory, viewMode }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.25]} />
      <Environment preset="city" />

      <Suspense fallback={null}>
        {objects.map((obj) => (
          <DraggableObject
            key={obj.id}
            obj={obj}
            isSelected={selectedIds.includes(obj.id)}
            onClick={selectObject}
            onGrabStart={() => setIsDragging(true)}
            onDragStart={() => {
              startDragHistory();
            }}
            onDrag={updateObject}
            onDragEnd={() => setIsDragging(false)}
          />
        ))}
      </Suspense>

      {/* Ground Plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={(e) => {
          if (viewMode === '3D') {
            e.stopPropagation();
            clearSelection();
          }
        }}
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#F1F5F9" roughness={0.95} />
      </mesh>

      <Grid
        infiniteGrid
        fadeDistance={35}
        fadeStrength={1.5}
        sectionColor="#CBD5E1"
        cellColor="#E2E8F0"
        sectionSize={1}
        cellSize={0.2}
        position={[0, 0.001, 0]}
      />

      <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={60} blur={2.5} far={10} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={40}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[3, 0, 3]}
        enabled={!isDragging}
      />
    </>
  );
}

export default function Canvas3D() {
  const { viewMode } = useUIStore();
  const { objects, selectedIds, selectObject, clearSelection, updateObject, _pushHistory } = useDesignStore();

  return (
    <div className="absolute inset-0 w-full h-full" data-testid="canvas-3d">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 45 }}>
        <color attach="background" args={['#0B0F1A']} />
        <fog attach="fog" args={['#0B0F1A', 30, 60]} />
        <SceneContent
          objects={objects}
          selectedIds={selectedIds}
          selectObject={selectObject}
          clearSelection={clearSelection}
          updateObject={updateObject}
          startDragHistory={_pushHistory}
          viewMode={viewMode}
        />
      </Canvas>
    </div>
  );
}
