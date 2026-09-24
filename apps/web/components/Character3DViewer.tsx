'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Grid, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models/2.0/CesiumMan/glTF-Binary/CesiumMan.glb';

interface BoneRig {
  upperArms: THREE.Bone[];
  lowerArms: THREE.Bone[];
  upperLegs: THREE.Bone[];
  lowerLegs: THREE.Bone[];
}

function matchBones(root: THREE.Object3D): BoneRig {
  const rig: BoneRig = { upperArms: [], lowerArms: [], upperLegs: [], lowerLegs: [] };
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Bone)) return;
    const n = obj.name.toLowerCase();
    const isArm = n.includes('arm');
    const isLeg = n.includes('leg') || n.includes('thigh') || n.includes('shin') || n.includes('calf');
    const isUpper = n.includes('up') || n.includes('thigh') || n.includes('shoulder');
    const isLower = n.includes('low') || n.includes('fore') || n.includes('shin') || n.includes('calf');
    if (isArm && isUpper) rig.upperArms.push(obj);
    else if (isArm && isLower) rig.lowerArms.push(obj);
    else if (isLeg && isUpper) rig.upperLegs.push(obj);
    else if (isLeg && isLower) rig.lowerLegs.push(obj);
  });
  return rig;
}

interface RigSummary {
  names: string[];
  armCount: number;
  legCount: number;
}

interface ModelProps {
  heightScale: number;
  buildScale: number;
  armScale: number;
  legScale: number;
  onRigDetected: (summary: RigSummary) => void;
}

function Model({ heightScale, buildScale, armScale, legScale, onRigDetected }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const rigRef = useRef<BoneRig | null>(null);

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
    const names: string[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Bone) names.push(obj.name);
    });
    onRigDetected({
      names,
      armCount: rig.upperArms.length + rig.lowerArms.length,
      legCount: rig.upperLegs.length + rig.lowerLegs.length,
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
    for (const bone of [...rig.upperArms, ...rig.lowerArms]) {
      bone.scale.y = armScale;
    }
  }, [armScale]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    for (const bone of [...rig.upperLegs, ...rig.lowerLegs]) {
      bone.scale.y = legScale;
    }
  }, [legScale]);

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

export default function Character3DViewer() {
  const [heightScale, setHeightScale] = useState(1);
  const [buildScale, setBuildScale] = useState(1);
  const [armScale, setArmScale] = useState(1);
  const [legScale, setLegScale] = useState(1);
  const [boneNames, setBoneNames] = useState<string[]>([]);
  const [armCount, setArmCount] = useState(0);
  const [legCount, setLegCount] = useState(0);
  const [showBones, setShowBones] = useState(true);

  const handleRigDetected = useCallback((summary: RigSummary) => {
    setBoneNames(summary.names);
    setArmCount(summary.armCount);
    setLegCount(summary.legCount);
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

      <div className="eden-panel p-2 text-xs">
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

useGLTF.preload(MODEL_URL);I'm 
