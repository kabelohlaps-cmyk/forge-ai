'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Grid, useAnimations } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models/2.0/CesiumMan/glTF-Binary/CesiumMan.glb';

function Model() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const firstAction = Object.values(actions)[0];
    firstAction?.reset().play();
    return () => {
      firstAction?.stop();
    };
  }, [actions]);

  return (
    <group ref={group} position={[0, 0, 0]} scale={1}>
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

export default function Character3DViewer() {
  return (
    <div className="relative w-full h-[55vh] min-h-[320px] rounded-lg overflow-hidden border border-eden-gold/30 bg-[#101014]">
      <Canvas camera={{ position: [2, 1.4, 3], fov: 45 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Suspense fallback={<LoadingFallback />}>
          <Model />
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
  );
}

useGLTF.preload(MODEL_URL);
