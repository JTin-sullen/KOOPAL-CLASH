import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FIGHTER_BY_ID, FighterId } from '../shared/gameData.ts';
import { FighterRig, createArticulatedFighter, getStancePose, poseFighter } from '../game/fighterBuilder.ts';
import { detectSoftwareWebGL } from '../game/mapBuilder.ts';

interface TekkenStagePreviewProps {
  fighterId: FighterId;
}

export const TekkenStagePreview: React.FC<TekkenStagePreviewProps> = ({ fighterId }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fighterIdRef = useRef<FighterId>(fighterId);
  const dragYawRef = useRef<number>(0);

  fighterIdRef.current = fighterId;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;

    // Critical for mobile high-DPR screens: keep CSS display size locked to container
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(0, 1.45, 4.4);
    camera.lookAt(0, 1.0, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x0f172a, 0.9);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
    key.position.set(3, 5, 4);
    key.castShadow = !isSoftwareGl;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 1.05);
    rim.position.set(-3.5, 3, -3.5);
    scene.add(rim);

    // Pedestal Base
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.72,
      roughness: 0.28,
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.24, 6), pedestalMat);
    pedestal.position.y = -0.12;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ringMat = new THREE.MeshBasicMaterial({
      color: FIGHTER_BY_ID[fighterId].hex,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.18, 6), ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.01;
    scene.add(ring);

    const rigs: Record<FighterId, FighterRig> = {
      marjohn: createArticulatedFighter('marjohn', scene),
      prime: createArticulatedFighter('prime', scene),
      damen: createArticulatedFighter('damen', scene),
      khen: createArticulatedFighter('khen', scene),
      jm: createArticulatedFighter('jm', scene),
    };
    // Hide in-match overhead HP bars inside Tekken stage preview
    (Object.values(rigs) as FighterRig[]).forEach((r) => {
      r.overheadSprite.visible = false;
    });

    const resize = () => {
      const w = Math.max(100, container.clientWidth);
      const h = Math.max(100, container.clientHeight);
      const aspect = w / h;
      camera.aspect = aspect;
      // Adapt FOV & distance so fighter stays centered from head to boots on portrait, landscape, or desktop
      camera.fov = aspect < 1.0 ? 48 : 40;
      const dist = aspect < 1.0 ? 5.2 : 4.25;
      camera.position.set(0, 1.4, dist);
      camera.lookAt(0, 0.98, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(container);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragYawRef.current += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let frameId = 0;
    let active = true;
    const startMs = performance.now();

    const tick = () => {
      if (!active) return;
      const t = (performance.now() - startMs) / 1000;
      const curId = fighterIdRef.current;
      const spec = FIGHTER_BY_ID[curId];
      ringMat.color.setHex(spec.hex);
      rim.color.setHex(spec.hex);

      if (!dragging) dragYawRef.current += 0.008;

      (Object.keys(rigs) as FighterId[]).forEach((id) => {
        const rig = rigs[id];
        const isCurrent = id === curId;
        rig.root.visible = isCurrent;
        if (isCurrent) {
          const pose = getStancePose(id, t);
          pose.rotY = Math.sin(t * 0.6) * 0.3 + dragYawRef.current;
          poseFighter(rig, pose, null, t);
          rig.overheadSprite.visible = false;
        }
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 90);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[150px] overflow-hidden touch-none-select cursor-grab active:cursor-grabbing"
    />
  );
};
