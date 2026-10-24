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

export function createOneRing() {
  const root = new THREE.Group();
  root.name = 'The One Ring';
  addArtifactLights(root, true);
  root.add(makeStonePedestal(0x100a08, 0xff5b18));

  const artifact = new THREE.Group();
  artifact.position.y = 0.15;
  artifact.rotation.set(0.08, -0.28, -0.08);
  root.add(artifact);

  const inscription = createInscriptionTexture();
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xe4a63a,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new THREE.Color(0xff3b08),
    emissiveMap: inscription,
    emissiveIntensity: 2.35,
    envMapIntensity: 2.2,
  });
  const geometry = new THREE.TorusGeometry(2.15, 0.57, 72, 256);
  const ring = new THREE.Mesh(geometry, gold);
  ring.castShadow = true;
  artifact.add(ring);

  // A second inner lip catches moving highlights and makes the band feel thick.
  const innerLip = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.49, 36, 256),
    new THREE.MeshPhysicalMaterial({
      color: 0xffc766,
      metalness: 1,
      roughness: 0.08,
      clearcoat: 1,
      side: THREE.BackSide,
      envMapIntensity: 2.5,
    }),
  );
  innerLip.scale.set(1, 1, 1.015);
  artifact.add(innerLip);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.64, 32, 160),
    new THREE.MeshBasicMaterial({
      color: 0xff6a19,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  artifact.add(halo);

  const coreLight = new THREE.PointLight(0xff651e, 13, 10, 2);
  coreLight.position.set(0, 0, 1.2);
  artifact.add(coreLight);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = 0.18 + Math.sin(time * 0.85) * 0.15;
      artifact.rotation.y += delta * 0.08;
      halo.material.opacity = 0.055 + (Math.sin(time * 2.2) + 1) * 0.025;
      gold.emissiveIntensity = 1.9 + Math.sin(time * 1.7) * 0.45;
      coreLight.intensity = 11 + Math.sin(time * 2.4) * 3;
    },
  };
}

function createBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.52, -0.62);
  shape.lineTo(-0.38, 3.72);
  shape.lineTo(0, 4.92);
  shape.lineTo(0.38, 3.72);
  shape.lineTo(0.52, -0.62);
  shape.lineTo(0, -0.48);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -0.06);
  geometry.computeVertexNormals();
  return geometry;
}

function createCurvedGuard(material) {
  const left = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.63, 0),
    new THREE.Vector3(-0.62, -0.7, 0),
    new THREE.Vector3(-1.15, -0.57, 0.02),
    new THREE.Vector3(-1.72, -0.18, 0),
  ]);
  const right = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.63, 0),
    new THREE.Vector3(0.62, -0.7, 0),
    new THREE.Vector3(1.15, -0.57, 0.02),
    new THREE.Vector3(1.72, -0.18, 0),
  ]);
  const group = new THREE.Group();
  for (const curve of [left, right]) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.105, 12, false), material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  for (const x of [-1.73, 1.73]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.53, 20), material);
    tip.position.set(x, -0.07, 0);
    tip.rotation.z = x < 0 ? -0.65 : 0.65;
    tip.castShadow = true;
    group.add(tip);
  }
  return group;
}

export function createNarsil() {
  const root = new THREE.Group();
  root.name = 'Narsil';
  addArtifactLights(root, false);
  root.add(makeStonePedestal(0x182028, 0xe2c77e));

  const artifact = new THREE.Group();
  artifact.position.y = -0.28;
  artifact.rotation.set(-0.03, -0.2, -0.05);
  root.add(artifact);

  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdbe5ea,
    metalness: 1,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 2.8,
  });
  const darkSilver = new THREE.MeshPhysicalMaterial({ color: 0x75818a, metalness: 1, roughness: 0.23, clearcoat: 0.8 });
  const guardMaterial = new THREE.MeshPhysicalMaterial({ color: 0xbec9cb, metalness: 1, roughness: 0.22, clearcoat: 1 });

  const blade = new THREE.Mesh(createBladeGeometry(), bladeMaterial);
  blade.castShadow = true;
  artifact.add(blade);

  // Raised central ridge and fuller create a faceted, forged profile.
  const ridgeShape = new THREE.Shape();
  ridgeShape.moveTo(-0.07, -0.43);
  ridgeShape.lineTo(-0.045, 4.18);
  ridgeShape.lineTo(0, 4.78);
  ridgeShape.lineTo(0.045, 4.18);
  ridgeShape.lineTo(0.07, -0.43);
  ridgeShape.closePath();
  const ridge = new THREE.Mesh(new THREE.ShapeGeometry(ridgeShape), darkSilver);
  ridge.position.z = 0.122;
  artifact.add(ridge);

  const runes = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 3.65),
    new THREE.MeshBasicMaterial({
      map: createBladeRuneTexture(),
      transparent: true,
      opacity: 0.76,
      color: 0xcff7ff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  runes.position.set(0.22, 1.45, 0.135);
  artifact.add(runes);

  artifact.add(createCurvedGuard(guardMaterial));

  const rainGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.34, 28), darkSilver);
  rainGuard.position.y = -0.78;
  artifact.add(rainGuard);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.23, 1.42, 28),
    new THREE.MeshStandardMaterial({ color: 0x322218, roughness: 0.75, metalness: 0.06 }),
  );
  grip.position.y = -1.55;
  grip.castShadow = true;
  artifact.add(grip);

  const wrapMaterial = new THREE.MeshStandardMaterial({ color: 0x9c7a4a, metalness: 0.52, roughness: 0.4 });
  for (let y = -2.15; y <= -0.93; y += 0.17) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.018, 7, 24), wrapMaterial);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    artifact.add(wrap);
  }

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 2), guardMaterial);
  pommel.scale.y = 1.28;
  pommel.position.y = -2.47;
  pommel.castShadow = true;
  artifact.add(pommel);
  const pommelGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x97d4e8, emissive: 0x143b57, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.08 }),
  );
  pommelGem.position.set(0, -2.47, 0.39);
  artifact.add(pommelGem);

  const glint = new THREE.PointLight(0xd9f5ff, 10, 9, 2);
  glint.position.set(0.4, 2.2, 1.5);
  artifact.add(glint);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = -0.28 + Math.sin(time * 0.7) * 0.1;
      artifact.rotation.y += delta * 0.045;
      glint.position.y = Math.sin(time * 0.55) * 3.4 + 1;
      glint.intensity = 7 + Math.max(0, Math.sin(time * 1.2)) * 8;
    },
  };
}

function makeVine(points, material, radius = 0.045) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 10, false), material);
}

export function createNenya() {
  const root = new THREE.Group();
  root.name = 'Nenya';
  addArtifactLights(root, false);
  root.add(makeStonePedestal(0x111b19, 0x83dfce));

  const artifact = new THREE.Group();
  artifact.position.y = 0.05;
  artifact.rotation.set(0.05, -0.24, 0.03);
  root.add(artifact);

  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xf4ffff,
    metalness: 0.82,
    roughness: 0.14,
    emissive: 0x071c1a,
    emissiveIntensity: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 3,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.25, 48, 220), silver);
  ring.castShadow = true;
  artifact.add(ring);

  // Fine double filigree around the band.
  for (const offset of [-0.17, 0.17]) {
    const wire = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.032, 10, 180),
      new THREE.MeshPhysicalMaterial({ color: 0xa9c6c4, metalness: 1, roughness: 0.16 }),
    );
    wire.position.z = offset;
    artifact.add(wire);
  }

  const gemCenter = new THREE.Vector3(0, 2.03, 0.06);
  const vineSets = [
    [new THREE.Vector3(-1.25, 1.22, 0), new THREE.Vector3(-0.8, 1.75, 0.02), new THREE.Vector3(-0.34, 1.86, 0.05), gemCenter],
    [new THREE.Vector3(1.25, 1.22, 0), new THREE.Vector3(0.8, 1.75, 0.02), new THREE.Vector3(0.34, 1.86, 0.05), gemCenter],
    [new THREE.Vector3(-0.86, 1.55, -0.08), new THREE.Vector3(-0.45, 2.25, -0.04), new THREE.Vector3(0, 2.4, 0)],
    [new THREE.Vector3(0.86, 1.55, -0.08), new THREE.Vector3(0.45, 2.25, -0.04), new THREE.Vector3(0, 2.4, 0)],
  ];
  for (const points of vineSets) artifact.add(makeVine(points, silver, 0.055));

  const petalGeometry = new THREE.SphereGeometry(0.28, 28, 16);
  for (let i = 0; i < 8; i += 1) {
    const angle = i / 8 * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, silver);
    petal.scale.set(0.62, 1.75, 0.32);
    petal.rotation.z = -angle;
    petal.position.set(Math.cos(angle) * 0.57, 2.03 + Math.sin(angle) * 0.57, 0);
    petal.castShadow = true;
    artifact.add(petal);
  }

  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9ffff,
    emissive: 0x1b9cae,
    emissiveIntensity: 1.25,
    roughness: 0.03,
    metalness: 0,
    transmission: 0.83,
    thickness: 1.1,
    ior: 2.05,
    clearcoat: 1,
    iridescence: 1,
    iridescenceIOR: 1.4,
    transparent: true,
    opacity: 0.97,
  });
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), gemMaterial);
  gem.position.copy(gemCenter);
  gem.scale.set(0.82, 1.08, 0.62);
  gem.castShadow = true;
  artifact.add(gem);

  const gemCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.32, 2),
    new THREE.MeshBasicMaterial({ color: 0xa4ffff, transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending }),
  );
  gemCore.position.copy(gemCenter);
  artifact.add(gemCore);

  const gemLight = new THREE.PointLight(0x82f6ff, 19, 11, 2);
  gemLight.position.set(0, 2.05, 1.1);
  artifact.add(gemLight);

  return {
    root,
    artifact,
    update(time, delta, active) {
      if (!active) return;
      artifact.position.y = 0.05 + Math.sin(time * 0.78) * 0.13;
      artifact.rotation.y += delta * 0.055;
      gem.rotation.y += delta * 0.45;
      gem.rotation.x = Math.sin(time * 0.6) * 0.15;
      gemCore.scale.setScalar(0.92 + Math.sin(time * 2.1) * 0.09);
      gemLight.intensity = 16 + Math.sin(time * 2.1) * 5;
      gemMaterial.emissiveIntensity = 1.1 + Math.sin(time * 1.7) * 0.25;
    },
  };
}
