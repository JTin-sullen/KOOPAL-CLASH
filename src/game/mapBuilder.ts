import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  MAP_BY_ID,
  MapId,
  getMapTerrainHeight,
} from '../shared/gameData.ts';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createProceduralGroundTex(mapId: MapId): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  if (mapId === 'meadow') {
    // Rich sunlit emerald meadow stone & grass flagstones
    ctx.fillStyle = '#477614';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(132, 204, 22, 0.22)'
          : i % 3 === 1
          ? 'rgba(54, 83, 20, 0.26)'
          : 'rgba(163, 230, 53, 0.14)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 10, 4 + Math.random() * 10);
    }
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        ctx.strokeRect(x + 2, y + 2, 60, 60);
      }
    }
  } else if (mapId === 'temple') {
    // Polished crimson-slate temple courtyard flagstones
    ctx.fillStyle = '#383242';
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? 'rgba(71, 85, 105, 0.28)' : 'rgba(30, 41, 59, 0.26)';
        ctx.fillRect(x + 2, y + 2, 60, 60);
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.24)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, 62, 62);
      }
    }
  } else {
    // Obsidian storm basalt slabs with violet arcane veins
    ctx.fillStyle = '#151526';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.28)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        ctx.strokeRect(x + 1, y + 1, 62, 62);
      }
    }
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.36)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 110, sy + (Math.random() - 0.5) * 110);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createSkyDome(mapId: MapId): THREE.Mesh {
  const geo = new THREE.SphereGeometry(125, 20, 12);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const topColor = new THREE.Color(
    mapId === 'meadow' ? 0x1d4ed8 : mapId === 'temple' ? 0x451a03 : 0x090418
  );
  const midColor = new THREE.Color(
    mapId === 'meadow' ? 0x38bdf8 : mapId === 'temple' ? 0xc2410c : 0x3b0764
  );
  const horizonColor = new THREE.Color(
    mapId === 'meadow' ? 0xfef3c7 : mapId === 'temple' ? 0xfdba74 : 0x6b21a8
  );
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const yNorm = THREE.MathUtils.clamp((pos.getY(i) + 15) / 135, 0, 1);
    if (yNorm < 0.35) {
      tmp.copy(horizonColor).lerp(midColor, yNorm / 0.35);
    } else {
      tmp.copy(midColor).lerp(topColor, (yNorm - 0.35) / 0.65);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.castShadow = false;
  sky.receiveShadow = false;
  return sky;
}

function safeMerge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false);
  for (const g of geos) g.dispose();
  for (const g of nonIndexed) {
    if (!geos.includes(g)) g.dispose();
  }
  return merged;
}

export interface BuiltMapScene {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

export function buildArenaMap(mapId: MapId, scene: THREE.Scene, maxAniso: number): BuiltMapScene {
  const spec = MAP_BY_ID[mapId];
  scene.background = new THREE.Color(spec.skyHex);
  scene.fog = new THREE.FogExp2(spec.fogHex, mapId === 'meadow' ? 0.011 : 0.014);

  const group = new THREE.Group();
  scene.add(group);

  // 1-draw-call atmospheric sky dome
  group.add(createSkyDome(mapId));

  const groundTex = createProceduralGroundTex(mapId);
  groundTex.anisotropy = maxAniso;

  // Flat playable floor inside combat radius, scenic rim outside
  const terrainGeo = new THREE.PlaneGeometry(110, 110, 36, 36);
  terrainGeo.rotateX(-Math.PI * 0.5);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, getMapTerrainHeight(mapId, pos.getX(i), pos.getZ(i)));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: mapId === 'obsidian' ? 0.65 : 0.86,
    metalness: mapId === 'obsidian' ? 0.25 : 0.05,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  group.add(terrain);

  // Subtle flat arena combat ring + inner center battle circle (merged into 1 draw call)
  const accentHex = mapId === 'meadow' ? 0xfacc15 : mapId === 'temple' ? 0xfb923c : 0xa855f7;
  const outerRingGeo = new THREE.RingGeometry(spec.arenaRadius - 0.22, spec.arenaRadius + 0.08, 64);
  outerRingGeo.rotateX(-Math.PI * 0.5);
  outerRingGeo.translate(0, 0.03, 0);

  const innerRingGeo = new THREE.RingGeometry(4.4, 4.62, 48);
  innerRingGeo.rotateX(-Math.PI * 0.5);
  innerRingGeo.translate(0, 0.025, 0);

  const ringsMerged = safeMerge([outerRingGeo, innerRingGeo]);
  if (ringsMerged) {
    const ringMesh = new THREE.Mesh(
      ringsMerged,
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    ringMesh.castShadow = false;
    ringMesh.receiveShadow = false;
    group.add(ringMesh);
  }

  const animatedMeshes: Array<(dt: number, elapsed: number) => void> = [];
  const outerR = spec.arenaRadius + 4.2;

  if (mapId === 'meadow') {
    // Decorative sparkling water moat ring outside the playable combat floor
    const moatGeo = new THREE.RingGeometry(spec.arenaRadius + 1.4, spec.arenaRadius + 4.0, 56);
    moatGeo.rotateX(-Math.PI * 0.5);
    moatGeo.translate(0, 0.015, 0);
    const moatMesh = new THREE.Mesh(
      moatGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    moatMesh.castShadow = false;
    moatMesh.receiveShadow = false;
    group.add(moatMesh);

    // Merged stone perimeter archway + scenic monoliths (1 draw call)
    const stoneParts: THREE.BufferGeometry[] = [];
    for (const dz of [-2.4, 2.4]) {
      const col = new THREE.BoxGeometry(1.2, 4.6, 1.2);
      col.translate(-outerR, 2.3, dz);
      stoneParts.push(col);
    }
    const lintel = new THREE.BoxGeometry(1.5, 0.95, 6.4);
    lintel.translate(-outerR, 4.85, 0);
    stoneParts.push(lintel);

    const monolithCoords: Array<[number, number, number]> = [
      [outerR + 2.8, -5.2, 4.4],
      [outerR + 4.2, 1.6, 5.6],
      [outerR + 2.4, 6.4, 3.6],
    ];
    for (const [cx, cz, ch] of monolithCoords) {
      const rock = new THREE.DodecahedronGeometry(ch * 0.52, 0);
      rock.translate(cx, ch * 0.35, cz);
      stoneParts.push(rock);
    }
    const mergedStone = safeMerge(stoneParts);
    if (mergedStone) {
      const stoneMesh = new THREE.Mesh(
        mergedStone,
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.86 })
      );
      stoneMesh.castShadow = false;
      stoneMesh.receiveShadow = false;
      group.add(stoneMesh);
    }

    // Instanced outer perimeter grove trees (2 draw calls total for 18 trees!)
    const treeCount = 18;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 4.0, 6);
    trunkGeo.translate(0, 2.0, 0);
    const trunkInst = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 }),
      treeCount
    );
    trunkInst.castShadow = false;
    trunkInst.receiveShadow = false;

    const crownGeo = new THREE.DodecahedronGeometry(2.0, 0);
    crownGeo.translate(0, 4.4, 0);
    const crownInst = new THREE.InstancedMesh(
      crownGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 }),
      treeCount
    );
    crownInst.castShadow = false;
    crownInst.receiveShadow = false;

    const dummy = new THREE.Object3D();
    const greenA = new THREE.Color(0x4d7c0f);
    const greenB = new THREE.Color(0x84cc16);
    const goldLeaf = new THREE.Color(0xb45309);
    for (let t = 0; t < treeCount; t++) {
      const ang = (t / treeCount) * Math.PI * 2 + 0.18;
      const dist = outerR + 6.5 + (t % 3) * 3.8;
      const tx = Math.cos(ang) * dist;
      const tz = Math.sin(ang) * dist;
      const ty = getMapTerrainHeight('meadow', tx, tz);
      const scale = 0.88 + (t % 3) * 0.16;
      dummy.position.set(tx, ty, tz);
      dummy.rotation.set(0, ang, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(t, dummy.matrix);
      crownInst.setMatrixAt(t, dummy.matrix);
      crownInst.setColorAt(t, t % 4 === 0 ? goldLeaf : t % 2 === 0 ? greenA : greenB);
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();
    group.add(trunkInst, crownInst);
  } else if (mapId === 'temple') {
    // Flat central dojo medallion (zero height bump so aiming never snags)
    const daisMesh = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 36),
      new THREE.MeshBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    daisMesh.rotation.x = -Math.PI * 0.5;
    daisMesh.position.y = 0.015;
    daisMesh.castShadow = false;
    daisMesh.receiveShadow = false;
    group.add(daisMesh);

    // 10 Instanced Crimson Temple Lantern Pillars around outer perimeter (3 draw calls total!)
    const count = 10;
    const pillarGeo = new THREE.CylinderGeometry(0.38, 0.45, 5.2, 8);
    pillarGeo.translate(0, 2.6, 0);
    const pillarInst = new THREE.InstancedMesh(
      pillarGeo,
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48 }),
      count
    );
    pillarInst.castShadow = false;
    pillarInst.receiveShadow = false;

    const capGeo = new THREE.BoxGeometry(1.6, 0.35, 1.6);
    capGeo.translate(0, 5.3, 0);
    const capInst = new THREE.InstancedMesh(
      capGeo,
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72, metalness: 0.15 }),
      count
    );
    capInst.castShadow = false;
    capInst.receiveShadow = false;

    const orbGeo = new THREE.SphereGeometry(0.32, 8, 6);
    orbGeo.translate(0, 4.7, 0);
    const orbInst = new THREE.InstancedMesh(
      orbGeo,
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      count
    );
    orbInst.castShadow = false;
    orbInst.receiveShadow = false;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(ang) * (outerR + 0.8), 0, Math.sin(ang) * (outerR + 0.8));
      dummy.rotation.set(0, -ang, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      pillarInst.setMatrixAt(i, dummy.matrix);
      capInst.setMatrixAt(i, dummy.matrix);
      orbInst.setMatrixAt(i, dummy.matrix);
    }
    pillarInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    orbInst.instanceMatrix.needsUpdate = true;
    pillarInst.computeBoundingSphere();
    capInst.computeBoundingSphere();
    orbInst.computeBoundingSphere();
    group.add(pillarInst, capInst, orbInst);
  } else {
    // Obsidian Storm Peak: Instanced outer basalt + crystal spires (2 draw calls total!)
    const total = 14;
    const basaltCount = 10;
    const crystalCount = 4;

    const spireGeo = new THREE.ConeGeometry(1.1, 5.2, 5);
    spireGeo.translate(0, 2.4, 0);
    const basaltInst = new THREE.InstancedMesh(
      spireGeo,
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.45 }),
      basaltCount
    );
    basaltInst.castShadow = false;
    basaltInst.receiveShadow = false;

    const crystalInst = new THREE.InstancedMesh(
      spireGeo.clone(),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 1.2,
        roughness: 0.25,
        metalness: 0.5,
      }),
      crystalCount
    );
    crystalInst.castShadow = false;
    crystalInst.receiveShadow = false;

    const dummy = new THREE.Object3D();
    let bIdx = 0;
    let cIdx = 0;
    for (let i = 0; i < total; i++) {
      const ang = (i / total) * Math.PI * 2;
      const dist = outerR + 1.2 + (i % 2) * 3.0;
      const scaleY = 0.85 + (i % 3) * 0.35;
      dummy.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      dummy.rotation.set(0, ang, (i % 2 === 0 ? 1 : -1) * 0.14);
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      if (i % 3 === 0 && cIdx < crystalCount) {
        crystalInst.setMatrixAt(cIdx++, dummy.matrix);
      } else if (bIdx < basaltCount) {
        basaltInst.setMatrixAt(bIdx++, dummy.matrix);
      }
    }
    basaltInst.instanceMatrix.needsUpdate = true;
    crystalInst.instanceMatrix.needsUpdate = true;
    basaltInst.computeBoundingSphere();
    crystalInst.computeBoundingSphere();
    group.add(basaltInst, crystalInst);

    const centerSeal = new THREE.Mesh(
      new THREE.RingGeometry(4.0, 4.3, 6),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    centerSeal.rotation.x = -Math.PI * 0.5;
    centerSeal.position.y = 0.035;
    centerSeal.castShadow = false;
    centerSeal.receiveShadow = false;
    group.add(centerSeal);
    animatedMeshes.push((dt) => {
      centerSeal.rotation.z += dt * 0.25;
    });
  }

  return {
    group,
    update: (dt, elapsed) => {
      for (const fn of animatedMeshes) fn(dt, elapsed);
    },
    dispose: () => {
      scene.remove(group);
      group.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      groundTex.dispose();
    },
  };
}
