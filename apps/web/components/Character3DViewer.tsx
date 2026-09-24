I89'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Grid, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models/2.0/CesiumMan/glTF-Binary/CesiumMan.glb';

const GOLD = '#e8c468';

type PartCategory = 'head' | 'hand' | 'back';

interface PartDef {
  id: string;
  label: string;
  category: PartCategory;
  build: () => THREE.Object3D;
}

const PART_DEFS: PartDef[] = [
  {
    id: 'helmet',
    label: 'Helmet',
    category: 'head',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.4, roughness: 0.4 })
      );
      mesh.position.set(0, 0.14, 0);
      return mesh;
    },
  },
  {
    id: 'crown',
    label: 'Crown',
    category: 'head',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.02, 8, 16),
        new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.2 })
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, 0.12, 0);
      return mesh;
    },
  },
  {
    id: 'visor',
    label: 'Visor',
    category: 'head',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.04, 0.06),
        new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.3 })
      );
      mesh.position.set(0, 0.02, 0.1);
      return mesh;
    },
  },
  {
    id: 'sword',
    label: 'Sword',
    category: 'hand',
    build: () => {
      const group = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.4, 0.01),
        new THREE.MeshStandardMaterial({ color: '#cfd6dd', metalness: 0.8, roughness: 0.2 })
      );
      blade.position.set(0, 0.24, 0);
      const hilt = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.03, 0.03),
        new THREE.MeshStandardMaterial({ color: GOLD })
      );
      group.add(blade, hilt);
      return group;
    },
  },
  {
    id: 'shield',
    label: 'Shield',
    category: 'hand',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.4, roughness: 0.5 })
      );
      mesh.rotation.z = Math.PI / 2;
      return mesh;
    },
  },
  {
    id: 'staff',
    label: 'Staff',
    category: 'hand',
    build: () => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: '#5a4632' })
      );
      pole.position.set(0, 0.25, 0);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.3 })
      );
      orb.position.set(0, 0.52, 0);
      group.add(pole, orb);
      return group;
    },
  },
  {
    id: 'backpack',
    label: 'Backpack',
    category: 'back',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.28, 0.12),
        new THREE.MeshStandardMaterial({ color: '#4a3f2a', roughness: 0.7 })
      );
      mesh.position.set(0, -0.05, -0.1);
      return mesh;
    },
  },
  {
    id: 'cape',
    label: 'Cape',
    category: 'back',
    build: () => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.45),
        new THREE.MeshStandardMaterial({ color: '#7a1f1f', side: THREE.DoubleSide, roughness: 0.8 })
      );
      mesh.position.set(0, -0.2, -0.08);
      return mesh;
    },
  },
];

interface BoneRig {
  arms: THREE.Bone[];
  legs: THREE.Bone[];
}

function matchBones(root: THREE.Object3D): BoneRig {
  const rig: BoneRig = { arms: [], legs: [] };
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Bone)) return;
    const n = obj.name.toLowerCase();
    if (n.includes('arm')) rig.arms.push(obj);
    else if (n.includes('leg') || n.includes('thigh') || n.includes('shin') || n.includes('calf')) {
      rig.legs.push(obj);
    }
  });
  return rig;
}

interface AttachPoints {
  head: THREE.Bone | null;
  hand: THREE.Bone | null;
  back: THREE.Bone | null;
}

function extractNum(name: string): number {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function pickDistal(bones: THREE.Bone[]): THREE.Bone | null {
  if (bones.length === 0) return null;
  let best = bones[0];
  let bestNum = extractNum(best.name);
  for (const b of bones) {
    const num = extractNum(b.name);
    if (num > bestNum) {
      best = b;
      bestNum = num;
    }
  }
  return best;
}

function findAttachPoints(root: THREE.Object3D): AttachPoints {
  const necks: THREE.Bone[] = [];
  const torsos: THREE.Bone[] = [];
  const rightArms: THREE.Bone[] = [];
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Bone)) return;
    const n = obj.name.toLowerCase();
    if (n.includes('neck')) necks.push(obj);
    else if (n.includes('torso')) torsos.push(obj);
    else if (n.includes('arm') && /_r(_|$)/.test(n)) rightArms.push(obj);
  });
  return {
    head: pickDistal(necks),
    back: pickDistal(torsos),
    hand: pickDistal(rightArms),
  };
}

interface RigSummary {
  names: string[];
  armCount: number;
  legCount: number;
  attachPoints: { head: string | null; hand: string | null; back: string | null };
}

type PartSelection = Record<PartCategory, string | null>;

interface ModelProps {
  heightScale: number;
  buildScale: number;
  armScale: number;
  legScale: number;
  selectedParts: PartSelection;
  onRigDetected: (summary: RigSummary) => void;
}

function Model({ heightScale, buildScale, armScale, legScale, selectedParts, onRigDetected }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const rigRef = useRef<BoneRig | null>(null);
  const attachPointsRef = useRef<AttachPoints | null>(null);
  const attachedRef = useRef<Record<PartCategory, THREE.Object3D | null>>({
    head: null,
    hand: null,
    back: null,
  });

  useEffect(() => {
    const firstAction = Object.values(actions)[0];
    firstAction?.reset().play();
    return () => {
      firstAction?.stop();
    };
  }, [actions]);

  useEffect(() => {
    const rig = matchBones(scene);
    rigRef.current = rig;
    const attachPoints = findAttachPoints(scene);
    attachPointsRef.current = attachPoints;
    const names: string[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Bone) names.push(obj.name);
    });
    onRigDetected({
      names,
      armCount: rig.arms.length,
      legCount: rig.legs.length,
      attachPoints: {
        head: attachPoints.head?.name ?? null,
        hand: attachPoints.hand?.name ?? null,
        back: attachPoints.back?.name ?? null,
      },
    });
  }, [scene, onRigDetected]);

  useEffect(() => {
    if (group.current) {
      group.current.scale.set(buildScale, heightScale, buildScale);
    }
  }, [heightScale, buildScale]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    for (const bone of rig.arms) {
      bone.scale.y = armScale;
    }
  }, [armScale]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    for (const bone of rig.legs) {
      bone.scale.y = legScale;
    }
  }, [legScale]);

  useEffect(() => {
    const bone = attachPointsRef.current?.head;
    if (!bone) return;
    const prev = attachedRef.current.head;
    if (prev) {
      bone.remove(prev);
      attachedRef.current.head = null;
    }
    const def = PART_DEFS.find((p) => p.category === 'head' && p.id === selectedParts.head);
    if (def) {
      const obj = def.build();
      bone.add(obj);
      attachedRef.current.head = obj;
    }
  }, [selectedParts.head]);

  useEffect(() => {
    const bone = attachPointsRef.current?.hand;
    if (!bone) return;
    const prev = attachedRef.current.hand;
    if (prev) {
      bone.remove(prev);
      attachedRef.current.hand = null;
    }
    const def = PART_DEFS.find((p) => p.category === 'hand' && p.id === selectedParts.hand);
    if (def) {
      const obj = def.build();
      bone.add(obj);
      attachedRef.current.hand = obj;
    }
  }, [selectedParts.hand]);

  useEffect(() => {
    const bone = attachPointsRef.current?.back;
    if (!bone) return;
    const prev = attachedRef.current.back;
    if (prev) {
      bone.remove(prev);
      attachedRef.current.back = null;
    }
    const def = PART_DEFS.find((p) => p.category === 'back' && p.id === selectedParts.back);
    if (def) {
      const obj = def.build();
      bone.add(obj);
      attachedRef.current.back = obj;
    }
  }, [selectedParts.back]);

  return (
    <group ref={group} position={[0, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
}
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial color="#e8c468" wireframe />
    </mesh>
  );
}

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={0.7}
        max={1.4}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#e8c468] disabled:opacity-30"
      />
      <span className="w-10 text-right opacity-70">{value.toFixed(2)}</span>
    </div>
  );
}

const PART_CATEGORIES: { key: PartCategory; label: string }[] = [
  { key: 'head', label: 'Head' },
  { key: 'hand', label: 'Hand' },
  { key: 'back', label: 'Back' },
];

function PartsPanel({
  selected,
  onSelect,
}: {
  selected: PartSelection;
  onSelect: (category: PartCategory, id: string | null) => void;
}) {
  return (
    <div className="eden-panel p-2 flex flex-col gap-2">
      <span className="text-xs text-eden-gold-light font-semibold">Parts</span>
      {PART_CATEGORIES.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[10px] opacity-60 uppercase">{label}</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onSelect(key, null)}
              className={`eden-btn px-2 text-xs ${selected[key] === null ? 'text-eden-gold-light' : ''}`}
            >
              None
            </button>
            {PART_DEFS.filter((p) => p.category === key).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(key, p.id)}
                className={`eden-btn px-2 text-xs ${selected[key] === p.id ? 'text-eden-gold-light' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Character3DViewer() {
  const [heightScale, setHeightScale] = useState(1);
  const [buildScale, setBuildScale] = useState(1);
  const [armScale, setArmScale] = useState(1);
  const [legScale, setLegScale] = useState(1);
  const [selectedParts, setSelectedParts] = useState<PartSelection>({
    head: null,
    hand: null,
    back: null,
  });
  const [boneNames, setBoneNames] = useState<string[]>([]);
  const [armCount, setArmCount] = useState(0);
  const [legCount, setLegCount] = useState(0);
  const [attachPoints, setAttachPoints] = useState<{
    head: string | null;
    hand: string | null;
    back: string | null;
  }>({ head: null, hand: null, back: null });
  const [showBones, setShowBones] = useState(false);

  const handleRigDetected = useCallback((summary: RigSummary) => {
    setBoneNames(summary.names);
    setArmCount(summary.armCount);
    setLegCount(summary.legCount);
    setAttachPoints(summary.attachPoints);
  }, []);

  const handleSelectPart = useCallback((category: PartCategory, id: string | null) => {
    setSelectedParts((prev) => ({ ...prev, [category]: id }));
  }, []);

  function resetAll() {
    setHeightScale(1);
    setBuildScale(1);
    setArmScale(1);
    setLegScale(1);
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative w-full h-[55vh] min-h-[320px] rounded-lg overflow-hidden border border-eden-gold/30 bg-[#101014]">
        <Canvas camera={{ position: [2, 1.4, 3], fov: 45 }} shadows>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
          <Suspense fallback={<LoadingFallback />}>
            <Model
              heightScale={heightScale}
              buildScale={buildScale}
              armScale={armScale}
              legScale={legScale}
              selectedParts={selectedParts}
              onRigDetected={handleRigDetected}
            />
            <Environment preset="city" />
          </Suspense>
          <Grid
            infiniteGrid
            fadeDistance={20}
            cellColor="#333333"
            sectionColor="#555555"
            position={[0, 0, 0]}
          />
          <OrbitControls enablePan={false} minDistance={1} maxDistance={8} target={[0, 1, 0]} />
        </Canvas>
      </div>

      <div className="eden-panel p-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-eden-gold-light font-semibold">Body</span>
          <button type="button" onClick={resetAll} className="eden-btn px-2 text-xs">
            Reset
          </button>
        </div>
        <Slider label="Height" value={heightScale} onChange={setHeightScale} />
        <Slider label="Build" value={buildScale} onChange={setBuildScale} />
        <Slider label="Arm length" value={armScale} onChange={setArmScale} disabled={armCount === 0} />
        <Slider label="Leg length" value={legScale} onChange={setLegScale} disabled={legCount === 0} />
        <p className="text-[10px] opacity-50">
          Matched {armCount} arm bone(s), {legCount} leg bone(s) out of {boneNames.length} total.
        </p>
      </div>

      <PartsPanel selected={selectedParts} onSelect={handleSelectPart} />

      <div className="eden-panel p-2 text-xs">
        <p className="opacity-60 mb-1">
          Attach points — head: {attachPoints.head ?? 'none'}, hand: {attachPoints.hand ?? 'none'}, back:{' '}
          {attachPoints.back ?? 'none'}
        </p>
        <button
          type="button"
          onClick={() => setShowBones((s) => !s)}
          className="eden-btn w-full text-left px-2"
        >
          Detected bones ({boneNames.length}) {showBones ? '▴' : '▾'}
        </button>
        {showBones && (
          <div className="mt-2 max-h-40 overflow-y-auto opacity-70 leading-relaxed break-words">
            {boneNames.length === 0 ? 'none found yet' : boneNames.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
