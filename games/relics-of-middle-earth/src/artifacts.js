import * as THREE from 'three';
import { createBladeRuneTexture, createInscriptionTexture } from './materials.js';

function addArtifactLights(group, warm = true) {
  const key = new THREE.PointLight(warm ? 0xffbd69 : 0xbdeeff, 22, 18, 2);
  key.position.set(4, 4, 5);
  const rim = new THREE.PointLight(warm ? 0xff4b18 : 0x7aa8ff, 16, 15, 2);
  rim.position.set(-4, 1, -3);
  group.add(key, rim);
}

function makeStonePedestal(color = 0x16100d, accent = 0xd77a27) {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.08 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.82, 0.56, 48), baseMaterial);
  base.position.y = -3.08;
  base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.16, 2.44, 0.22, 48), baseMaterial);
  top.position.y = -2.7;
  top.receiveShadow = true;
  const inlay = new THREE.Mesh(
    new THREE.TorusGeometry(1.64, 0.026, 8, 96),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.65 }),
  );
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = -2.575;
  group.add(base, top, inlay);
  return group;
}

function buildFlatRingBand(inscription) {
  const group = new THREE.Group();
  const outerRadius = 2.42;
  const innerRadius = 1.92;
  const width = 0.82;

  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xc68a24,
    metalness: 1,
    roughness: 0.13,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    emissive: new THREE.Color(0xff3b08),
    emissiveMap: inscription,
    emissiveIntensity: 2.6,
    envMapIntensity: 3.2,
  });
  const innerGold = gold.clone();
  innerGold.side = THREE.BackSide;
  innerGold.emissiveIntensity = 2.15;
  const faceGold = new THREE.MeshPhysicalMaterial({
    color: 0xd89d36,
    metalness: 1,
    roughness: 0.11,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 3.4,
  });
  const edgeGold = new THREE.MeshPhysicalMaterial({
    color: 0xffce71,
    metalness: 1,
    roughness: 0.075,
    clearcoat: 1,
    envMapIntensity: 4,
  });

  const outer = new THREE.Mesh(new THREE.CylinderGeometry(outerRadius, outerRadius, width, 256, 2, true), gold);
  outer.rotation.x = Math.PI / 2;
  outer.castShadow = true;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(innerRadius, innerRadius, width, 256, 2, true), innerGold);
  inner.rotation.x = Math.PI / 2;

  const front = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 256, 4), faceGold);
  front.position.z = width / 2;
  const back = front.clone();
  back.position.z = -width / 2;
  back.rotation.y = Math.PI;
  group.add(outer, inner, front, back);

  for (const z of [-width / 2, width / 2]) {
    const outerRim = new THREE.Mesh(new THREE.TorusGeometry(outerRadius - 0.025, 0.065, 14, 256), edgeGold);
    outerRim.position.z = z;
    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(innerRadius + 0.025, 0.055, 14, 256), edgeGold);
    innerRim.position.z = z;
    group.add(outerRim, innerRim);
  }

  return { group, gold, innerGold };
}

export function createOneRing() {
  const root = new THREE.Group();
  root.name = 'The One Ring';
  addArtifactLights(root, true);
  root.add(makeStonePedestal(0x100a08, 0xff5b18));

  const artifact = new THREE.Group();
  artifact.position.y = 0.15;
  artifact.rotation.set(0.16, -0.34, -0.06);
  root.add(artifact);

  const inscription = createInscriptionTexture();
  const band = buildFlatRingBand(inscription);
  artifact.add(band.group);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.18, 0.36, 24, 192),
    new THREE.MeshBasicMaterial({
      color: 0xff5a12,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.z = 1.45;
  artifact.add(halo);

  const coreLight = new THREE.PointLight(0xff651e, 15, 11, 2);
  coreLight.position.set(0, 0, 1.3);
  artifact.add(coreLight);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = 0.18 + Math.sin(time * 0.85) * 0.13;
      artifact.rotation.y += delta * 0.065;
      halo.material.opacity = 0.045 + (Math.sin(time * 2.2) + 1) * 0.022;
      band.gold.emissiveIntensity = 2.15 + Math.sin(time * 1.7) * 0.48;
      band.innerGold.emissiveIntensity = 1.8 + Math.sin(time * 1.9) * 0.38;
      coreLight.intensity = 12 + Math.sin(time * 2.4) * 3;
    },
  };
}

function extrudedShape(shape, depth = 0.12, bevel = 0.035) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.52);
  shape.lineTo(-0.39, 5.5);
  shape.lineTo(-0.25, 6.45);
  shape.lineTo(0, 7.18);
  shape.lineTo(0.25, 6.45);
  shape.lineTo(0.39, 5.5);
  shape.lineTo(0.5, -0.52);
  shape.lineTo(0, -0.37);
  shape.closePath();
  return extrudedShape(shape, 0.16, 0.048);
}

function createGuardFinial(material, goldMaterial, side) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.34, 0.13, 0.54, 0.5);
  shape.quadraticCurveTo(0.12, 0.47, -0.16, 0.73);
  shape.quadraticCurveTo(-0.1, 0.31, -0.28, 0.04);
  shape.closePath();
  const finial = new THREE.Group();
  const shell = new THREE.Mesh(extrudedShape(shape, 0.2, 0.025), material);
  shell.scale.x = side;
  finial.add(shell);

  const inset = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.19, 4, 1, Math.PI * 0.25, Math.PI * 1.5), goldMaterial);
  inset.position.set(side * 0.08, 0.35, 0.125);
  inset.rotation.z = side < 0 ? 0.2 : -0.2;
  finial.add(inset);
  return finial;
}

function createCurvedGuard(material, goldMaterial) {
  const left = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.58, 0),
    new THREE.Vector3(-0.74, -0.58, 0),
    new THREE.Vector3(-1.48, -0.7, 0.01),
    new THREE.Vector3(-2.1, -0.98, 0),
  ]);
  const right = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.58, 0),
    new THREE.Vector3(0.74, -0.58, 0),
    new THREE.Vector3(1.48, -0.7, 0.01),
    new THREE.Vector3(2.1, -0.98, 0),
  ]);
  const group = new THREE.Group();
  for (const curve of [left, right]) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.095, 14, false), material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  const leftTip = createGuardFinial(material, goldMaterial, -1);
  leftTip.position.set(-2.12, -1.08, 0);
  leftTip.rotation.z = -1.0;
  const rightTip = createGuardFinial(material, goldMaterial, 1);
  rightTip.position.set(2.12, -1.08, 0);
  rightTip.rotation.z = 1.0;
  group.add(leftTip, rightTip);
  return group;
}

function createLongPommel(silver, gold) {
  const group = new THREE.Group();
  const shaftShape = new THREE.Shape();
  shaftShape.moveTo(-0.2, -2.22);
  shaftShape.lineTo(-0.32, -2.42);
  shaftShape.lineTo(-0.38, -2.82);
  shaftShape.quadraticCurveTo(-0.64, -2.98, -0.78, -3.3);
  shaftShape.quadraticCurveTo(-0.42, -3.24, 0, -3.58);
  shaftShape.quadraticCurveTo(0.42, -3.24, 0.78, -3.3);
  shaftShape.quadraticCurveTo(0.64, -2.98, 0.38, -2.82);
  shaftShape.lineTo(0.32, -2.42);
  shaftShape.lineTo(0.2, -2.22);
  shaftShape.closePath();
  const shell = new THREE.Mesh(extrudedShape(shaftShape, 0.24, 0.045), silver);
  shell.castShadow = true;
  group.add(shell);

  const insetShape = new THREE.Shape();
  insetShape.moveTo(0, -3.02);
  insetShape.quadraticCurveTo(-0.28, -3.15, -0.39, -3.34);
  insetShape.quadraticCurveTo(0, -3.25, 0.39, -3.34);
  insetShape.quadraticCurveTo(0.28, -3.15, 0, -3.02);
  const inset = new THREE.Mesh(new THREE.ShapeGeometry(insetShape), gold);
  inset.position.z = 0.145;
  group.add(inset);
  return group;
}

export function createNarsil() {
  const root = new THREE.Group();
  root.name = 'Narsil';
  addArtifactLights(root, false);
  root.add(makeStonePedestal(0x182028, 0xe2c77e));

  const artifact = new THREE.Group();
  artifact.position.set(0.7, 0.94, 0);
  artifact.rotation.set(-0.02, -0.16, -0.045);
  root.add(artifact);

  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf3f7f8,
    metalness: 0.88,
    roughness: 0.16,
    emissive: 0x061018,
    emissiveIntensity: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    envMapIntensity: 3.7,
  });
  const darkSilver = new THREE.MeshPhysicalMaterial({ color: 0x6f7d86, metalness: 0.92, roughness: 0.2, clearcoat: 0.9 });
  const guardMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd7dfe0, metalness: 0.94, roughness: 0.16, clearcoat: 1, envMapIntensity: 3.4 });
  const goldMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd4a833, metalness: 0.94, roughness: 0.18, clearcoat: 1 });

  const blade = new THREE.Mesh(createBladeGeometry(), bladeMaterial);
  blade.castShadow = true;
  artifact.add(blade);

  // Long central ridge and twin fullers give the blade a forged diamond section.
  const ridgeShape = new THREE.Shape();
  ridgeShape.moveTo(-0.065, -0.36);
  ridgeShape.lineTo(-0.04, 6.42);
  ridgeShape.lineTo(0, 7.02);
  ridgeShape.lineTo(0.04, 6.42);
  ridgeShape.lineTo(0.065, -0.36);
  ridgeShape.closePath();
  const ridge = new THREE.Mesh(new THREE.ShapeGeometry(ridgeShape), darkSilver);
  ridge.position.z = 0.152;
  artifact.add(ridge);

  const fullerMaterial = new THREE.MeshBasicMaterial({ color: 0xb8c7ce, transparent: true, opacity: 0.34 });
  for (const x of [-0.24, 0.24]) {
    const fuller = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 5.9), fullerMaterial);
    fuller.position.set(x, 2.65, 0.155);
    artifact.add(fuller);
  }

  const runes = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 4.8),
    new THREE.MeshBasicMaterial({ map: createBladeRuneTexture(), transparent: true, opacity: 0.52, color: 0xe5fbff, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  runes.position.set(0.17, 2.55, 0.165);
  artifact.add(runes);

  artifact.add(createCurvedGuard(guardMaterial, goldMaterial));

  const rainGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.4, 32), darkSilver);
  rainGuard.position.y = -0.79;
  artifact.add(rainGuard);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 1.34, 32),
    new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.82, metalness: 0.03 }),
  );
  grip.position.y = -1.53;
  grip.castShadow = true;
  artifact.add(grip);

  const wrapMaterial = new THREE.MeshStandardMaterial({ color: 0x343536, metalness: 0.24, roughness: 0.58 });
  for (let y = -2.08; y <= -1.0; y += 0.15) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.238, 0.018, 7, 28), wrapMaterial);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    artifact.add(wrap);
  }

  artifact.add(createLongPommel(guardMaterial, goldMaterial));

  const glint = new THREE.PointLight(0xe3f7ff, 13, 11, 2);
  glint.position.set(0.35, 3.3, 1.5);
  artifact.add(glint);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = 0.94 + Math.sin(time * 0.7) * 0.07;
      artifact.rotation.y += delta * 0.032;
      glint.position.y = Math.sin(time * 0.45) * 5.2 + 1.2;
      glint.intensity = 8 + Math.max(0, Math.sin(time * 1.15)) * 9;
    },
  };
}

function makeVine(points, material, radius = 0.045) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 10, false), material);
}

function createLeafPetalGeometry(length = 1.1, width = 0.34, depth = 0.1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-width, length * 0.18, -width * 0.92, length * 0.72, 0, length);
  shape.bezierCurveTo(width * 0.92, length * 0.72, width, length * 0.18, 0, 0);
  shape.closePath();
  return extrudedShape(shape, depth, 0.025);
}

export function createNenya() {
  const root = new THREE.Group();
  root.name = 'Nenya';
  addArtifactLights(root, false);
  root.add(makeStonePedestal(0x111b19, 0x83dfce));

  const artifact = new THREE.Group();
  artifact.position.y = 0.02;
  artifact.rotation.set(0.08, -0.28, 0.02);
  root.add(artifact);

  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xf8ffff,
    metalness: 0.86,
    roughness: 0.11,
    emissive: 0x071c1a,
    emissiveIntensity: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 4,
  });
  const shadowSilver = new THREE.MeshPhysicalMaterial({ color: 0x92a7a6, metalness: 0.96, roughness: 0.2, clearcoat: 1 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.17, 42, 240), silver);
  ring.castShadow = true;
  artifact.add(ring);

  // Braided silver wires wrap the band and rise into the flower setting.
  for (const offset of [-0.13, 0.13]) {
    const wire = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.028, 10, 200), shadowSilver);
    wire.position.z = offset;
    artifact.add(wire);
  }

  const flowerCenter = new THREE.Vector3(0, 2.05, 0.05);
  const vineSets = [
    [new THREE.Vector3(-1.36, 1.02, -0.03), new THREE.Vector3(-1.0, 1.65, 0.02), new THREE.Vector3(-0.45, 1.77, 0.08), flowerCenter],
    [new THREE.Vector3(1.36, 1.02, -0.03), new THREE.Vector3(1.0, 1.65, 0.02), new THREE.Vector3(0.45, 1.77, 0.08), flowerCenter],
    [new THREE.Vector3(-1.08, 1.38, -0.09), new THREE.Vector3(-0.64, 2.04, -0.02), new THREE.Vector3(-0.16, 2.13, 0.03)],
    [new THREE.Vector3(1.08, 1.38, -0.09), new THREE.Vector3(0.64, 2.04, -0.02), new THREE.Vector3(0.16, 2.13, 0.03)],
    [new THREE.Vector3(-0.8, 1.55, 0.09), new THREE.Vector3(-0.35, 2.46, 0.02), new THREE.Vector3(0, 2.58, 0)],
    [new THREE.Vector3(0.8, 1.55, 0.09), new THREE.Vector3(0.35, 2.46, 0.02), new THREE.Vector3(0, 2.58, 0)],
  ];
  for (const points of vineSets) artifact.add(makeVine(points, silver, 0.045));

  const outerPetalGeometry = createLeafPetalGeometry(1.0, 0.33, 0.12);
  const innerPetalGeometry = createLeafPetalGeometry(0.67, 0.25, 0.14);
  const petals = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = i / 8 * Math.PI * 2;
    const petal = new THREE.Mesh(outerPetalGeometry, silver);
    petal.position.copy(flowerCenter);
    petal.rotation.z = -angle;
    petal.rotation.x = 0.08 + (i % 2) * 0.06;
    petal.castShadow = true;
    petals.push(petal);
    artifact.add(petal);
  }
  for (let i = 0; i < 6; i += 1) {
    const angle = i / 6 * Math.PI * 2 + Math.PI / 6;
    const petal = new THREE.Mesh(innerPetalGeometry, shadowSilver);
    petal.position.set(flowerCenter.x, flowerCenter.y, 0.13);
    petal.rotation.z = -angle;
    petal.rotation.x = -0.08;
    petals.push(petal);
    artifact.add(petal);
  }

  // Side leaves reproduce the dense, organic silverwork of the reference ring.
  for (const [x, y, rotation, scale] of [[-0.94, 1.66, 1.02, 0.54], [0.94, 1.66, -1.02, 0.54], [-0.56, 1.83, 0.7, 0.42], [0.56, 1.83, -0.7, 0.42]]) {
    const leaf = new THREE.Mesh(outerPetalGeometry, silver);
    leaf.position.set(x, y, -0.02);
    leaf.rotation.z = rotation;
    leaf.scale.setScalar(scale);
    artifact.add(leaf);
  }

  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeaffff,
    emissive: 0x53d7d1,
    emissiveIntensity: 0.62,
    roughness: 0.025,
    metalness: 0,
    transmission: 0.9,
    thickness: 0.75,
    ior: 2.1,
    clearcoat: 1,
    iridescence: 1,
    iridescenceIOR: 1.45,
    transparent: true,
    opacity: 0.98,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 2), gemMaterial);
  gem.position.set(0, 2.06, 0.28);
  gem.scale.set(0.9, 0.9, 0.58);
  gem.castShadow = true;
  artifact.add(gem);

  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), silver);
  bead.position.set(0, 2.06, 0.46);
  artifact.add(bead);

  const gemLight = new THREE.PointLight(0xbafff6, 10, 8, 2);
  gemLight.position.set(0, 2.05, 1.05);
  artifact.add(gemLight);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = 0.02 + Math.sin(time * 0.78) * 0.1;
      artifact.rotation.y += delta * 0.042;
      gem.rotation.y += delta * 0.4;
      gem.rotation.x = Math.sin(time * 0.6) * 0.13;
      petals.forEach((petal, index) => { petal.position.z = Math.sin(time * 1.25 + index * 0.7) * 0.018; });
      gemLight.intensity = 8 + Math.sin(time * 2.1) * 2.4;
      gemMaterial.emissiveIntensity = 0.52 + Math.sin(time * 1.7) * 0.12;
    },
  };
}
