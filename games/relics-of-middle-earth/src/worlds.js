import * as THREE from 'three';
import { createNarsil, createNenya, createOneRing } from './artifacts.js';
import {
  createRadialTexture,
  createSkyDome,
  createSmokeTexture,
  createSparkTexture,
  makeLavaMaterial,
  makeWaterfallMaterial,
  makeWaterMaterial,
} from './materials.js';

const backgroundLoader = new THREE.TextureLoader();
function loadCinematicBackground(name) {
  const texture = backgroundLoader.load(new URL(`../assets/references/${name}.png`, import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const cinematicBackgrounds = {
  mordor: loadCinematicBackground('mordor'),
  gondor: loadCinematicBackground('gondor'),
  rivendell: loadCinematicBackground('rivendell'),
};

function seeded(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createMountainGeometry(baseRadius, height, topRadius = 0.2, seed = 1, segments = 72, rings = 28) {
  const random = seeded(seed);
  const noise = Array.from({ length: segments }, () => 0.8 + random() * 0.36);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const baseShape = THREE.MathUtils.lerp(baseRadius, topRadius, Math.pow(t, 0.82));
    for (let segment = 0; segment <= segments; segment += 1) {
      const index = segment % segments;
      const angle = segment / segments * Math.PI * 2;
      const ridge = noise[index] * (1 - t * 0.55);
      const wave = 1 + Math.sin(angle * 5 + t * 9) * 0.055 + Math.sin(angle * 11 - t * 7) * 0.025;
      const radius = baseShape * ridge * wave;
      positions.push(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius);
      uvs.push(segment / segments, t);
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function displaceGround(geometry, amount, random) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const distance = Math.hypot(x, y);
    position.setZ(i, (Math.sin(x * 0.18) + Math.cos(y * 0.16)) * amount + random() * amount - distance * 0.004);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function blendSceneryWithBackdrop(root, opacity) {
  const treated = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || treated.has(material) || material.isShaderMaterial || material.isMeshBasicMaterial) continue;
      if ((material.emissiveIntensity ?? 0) > 0.75) continue;
      treated.add(material);
      material.transparent = true;
      material.opacity = Math.min(material.opacity ?? 1, opacity);
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });
}

function addContactShadow(root, color = 0x000000) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.36, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -3.34;
  root.add(shadow);
}

function createPointField(count, range, color, size, texture, random) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * range.x;
    positions[i * 3 + 1] = random() * range.y + range.minY;
    positions[i * 3 + 2] = (random() - 0.5) * range.z + range.offsetZ;
    speeds[i] = 0.4 + random() * 1.3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    map: texture,
    transparent: true,
    opacity: 0.85,
    alphaTest: 0.015,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.speeds = speeds;
  return points;
}

function animateRisingPoints(points, delta, minY, maxY, drift = 0.1) {
  const positions = points.geometry.attributes.position;
  const speeds = points.userData.speeds;
  for (let i = 0; i < positions.count; i += 1) {
    let y = positions.getY(i) + speeds[i] * delta;
    let x = positions.getX(i) + Math.sin(y * 1.7 + i) * drift * delta;
    if (y > maxY) {
      y = minY;
      x += (Math.random() - 0.5) * 2;
    }
    positions.setXY(i, x, y);
  }
  positions.needsUpdate = true;
}

function createMordor(quality) {
  const root = new THREE.Group();
  root.name = 'Mordor';
  const random = seeded(0x0badf00d);
  const animated = [];

  const sky = createSkyDome('#08030b', '#5b140e', '#120405');
  root.add(sky);

  const groundGeometry = new THREE.PlaneGeometry(170, 170, 70, 70);
  displaceGround(groundGeometry, 1.15, random);
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({ color: 0x110d0d, roughness: 0.98, metalness: 0.03 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.5;
  ground.position.z = -23;
  ground.receiveShadow = true;
  root.add(ground);

  const volcanoMaterial = new THREE.MeshStandardMaterial({ color: 0x160c0b, roughness: 0.96, metalness: 0.08 });
  const volcano = new THREE.Mesh(createMountainGeometry(13.5, 20, 2.3, 44, 84, 32), volcanoMaterial);
  volcano.position.set(5.5, -8.0, -34);
  volcano.castShadow = true;
  volcano.receiveShadow = true;
  root.add(volcano);

  // Warm edge light around the crater.
  const crater = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.28, 20, 72),
    new THREE.MeshStandardMaterial({ color: 0x23100b, emissive: 0xff2c02, emissiveIntensity: 1.6, roughness: 0.72 }),
  );
  crater.rotation.x = Math.PI / 2;
  crater.position.set(5.5, 11.72, -34);
  root.add(crater);

  const lavaMaterial = makeLavaMaterial();
  const craterLava = new THREE.Mesh(new THREE.CircleGeometry(1.85, 64), lavaMaterial);
  craterLava.rotation.x = -Math.PI / 2;
  craterLava.position.set(5.5, 11.66, -34);
  root.add(craterLava);
  animated.push(lavaMaterial);

  const riverMaterial = makeLavaMaterial();
  riverMaterial.uniforms.uBrightness.value = -0.65;
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.5, -3.19, -31),
    new THREE.Vector3(-1.4, -3.12, -23),
    new THREE.Vector3(2.1, -3.1, -14),
    new THREE.Vector3(0.2, -3.08, -5),
    new THREE.Vector3(1.8, -3.06, 7),
  ]);
  const lavaRiver = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 120, 0.11, 10, false), riverMaterial);
  root.add(lavaRiver);
  animated.push(riverMaterial);

  // Secondary glowing fissures.
  for (let i = 0; i < 5; i += 1) {
    const x = -14 + i * 6.8 + random() * 2;
    const fissureCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -3.25, -16),
      new THREE.Vector3(x + random() * 2 - 1, -3.2, -10),
      new THREE.Vector3(x + random() * 3 - 1.5, -3.18, -4),
    ]);
    const material = new THREE.MeshBasicMaterial({ color: 0xff3d08, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    const fissure = new THREE.Mesh(new THREE.TubeGeometry(fissureCurve, 28, 0.055 + random() * 0.05, 6), material);
    root.add(fissure);
  }

  // Jagged distant ridges.
  for (let i = 0; i < 12; i += 1) {
    const radius = 5 + random() * 8;
    const ridge = new THREE.Mesh(createMountainGeometry(radius, 10 + random() * 13, 0.15, i + 90, 36, 15), volcanoMaterial);
    ridge.position.set((random() - 0.5) * 95, -4.2, -40 - random() * 45);
    ridge.scale.z = 0.6 + random() * 0.7;
    root.add(ridge);
  }

  const rockGeometry = new THREE.DodecahedronGeometry(0.6, 0);
  const rocks = new THREE.InstancedMesh(rockGeometry, volcanoMaterial, Math.floor(130 * quality));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < rocks.count; i += 1) {
    const s = 0.25 + random() * 1.5;
    matrix.compose(
      new THREE.Vector3((random() - 0.5) * 70, -3.3 + random() * 0.45, (random() - 0.5) * 65 - 10),
      quaternion.setFromEuler(new THREE.Euler(random() * 3, random() * 3, random() * 3)),
      scale.set(s, s * (0.5 + random()), s),
    );
    rocks.setMatrixAt(i, matrix);
  }
  rocks.receiveShadow = true;
  root.add(rocks);

  const smokeTexture = createSmokeTexture();
  const smoke = [];
  for (let i = 0; i < Math.floor(24 * quality); i += 1) {
    const material = new THREE.SpriteMaterial({ map: smokeTexture, color: 0x493835, transparent: true, opacity: 0.2 + random() * 0.18, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(5.5 + (random() - 0.5) * 4, 11.8 + random() * 15, -34 + (random() - 0.5) * 4);
    const size = 4 + random() * 8;
    sprite.scale.set(size, size, 1);
    sprite.userData = { speed: 0.35 + random() * 0.8, drift: random() * 6, baseScale: size };
    smoke.push(sprite);
    root.add(sprite);
  }

  const emberTexture = createSparkTexture();
  const embers = createPointField(Math.floor(460 * quality), { x: 30, y: 27, z: 28, minY: -2, offsetZ: -25 }, 0xff631c, 0.28, emberTexture, random);
  root.add(embers);
  const ash = createPointField(Math.floor(620 * quality), { x: 100, y: 55, z: 80, minY: -2, offsetZ: -35 }, 0x6f5550, 0.12, createRadialTexture(), random);
  ash.material.opacity = 0.26;
  ash.material.blending = THREE.NormalBlending;
  root.add(ash);

  const volcanoLight = new THREE.PointLight(0xff3510, 110, 62, 2);
  volcanoLight.position.set(5.5, 11.8, -31);
  root.add(volcanoLight);
  const hemi = new THREE.HemisphereLight(0x2b1833, 0x220500, 1.1);
  root.add(hemi);
  const redRim = new THREE.DirectionalLight(0xff5a25, 2.8);
  redRim.position.set(-10, 18, -8);
  root.add(redRim);

  blendSceneryWithBackdrop(root, 0.35);
  const artifact = createOneRing();
  root.add(artifact.root);
  addContactShadow(root);

  return {
    key: 'mordor',
    root,
    artifact,
    background: cinematicBackgrounds.mordor,
    fog: new THREE.FogExp2(0x120506, 0.013),
    camera: { position: new THREE.Vector3(0.4, 0.35, 12.3), target: new THREE.Vector3(0, -0.1, 0), min: 6.2, max: 18.5 },
    ui: {
      chapter: 'I', realm: 'MORDOR', type: 'THE ONE RING', name: 'THE RULING RING',
      lore: 'Forged in the fires of Orodruin, a golden vessel for a dark will—its fiery inscription awakens beneath the gaze of Mount Doom.',
      specs: [['ORIGIN', 'ORODRUIN'], ['AGE', 'SECOND AGE'], ['MATERIAL', 'GOLD']],
      world: 'MORDOR', subtitle: 'THE ASHEN LAND', loading: 'AWAKENING MORDOR',
    },
    audio: { filter: 180, gain: 0.055, pitch: 38 },
    update(time, delta, active) {
      sky.material.uniforms.uTime.value = time;
      for (const material of animated) material.uniforms.uTime.value = time;
      artifact.update(time, delta, active);
      animateRisingPoints(embers, delta, -2, 29, 0.24);
      ash.rotation.y += delta * 0.008;
      ash.position.x = Math.sin(time * 0.04) * 2;
      volcanoLight.intensity = 92 + Math.sin(time * 2.7) * 17 + Math.sin(time * 7.1) * 7;
      smoke.forEach((sprite, index) => {
        sprite.position.y += delta * sprite.userData.speed;
        sprite.position.x += Math.sin(time * 0.22 + sprite.userData.drift) * delta * 0.22;
        sprite.material.rotation += delta * 0.025 * (index % 2 ? 1 : -1);
        if (sprite.position.y > 38) {
          sprite.position.y = 11.8;
          sprite.position.x = 5.5 + (random() - 0.5) * 4;
        }
      });
    },
  };
}

function createTower(material, roofMaterial, height, radius = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, height, 20), material);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.35, 20), material);
  crown.position.y = height + 0.08;
  group.add(crown);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.15, radius * 1.75, 20), roofMaterial);
  roof.position.y = height + radius * 0.98;
  roof.castShadow = true;
  group.add(roof);

  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe6a4 });
  for (let i = 0; i < 4; i += 1) {
    const angle = i / 4 * Math.PI * 2;
    const window = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.18, radius * 0.48), windowMaterial);
    window.position.set(Math.cos(angle) * (radius + 0.012), height * 0.72, Math.sin(angle) * (radius + 0.012));
    window.rotation.y = -angle + Math.PI / 2;
    group.add(window);
  }
  return group;
}

function createCloud(texture, random, color = 0xffffff) {
  const group = new THREE.Group();
  const count = 3 + Math.floor(random() * 4);
  for (let i = 0; i < count; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity: 0.12 + random() * 0.1, depthWrite: false }));
    const size = 12 + random() * 14;
    sprite.scale.set(size, size * 0.38, 1);
    sprite.position.set((i - count / 2) * 6 + random() * 3, random() * 3, random() * 2);
    group.add(sprite);
  }
  return group;
}

function createGondor(quality) {
  const root = new THREE.Group();
  root.name = 'Gondor and Numenor';
  const random = seeded(0x601d0a);
  const sky = createSkyDome('#172942', '#c68765', '#2c4150');
  root.add(sky);

  const waterMaterial = makeWaterMaterial('#12384a', '#d7c799');
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, 150, 90, 70), waterMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -4.3, -32);
  root.add(sea);

  const coast = new THREE.Mesh(
    createMountainGeometry(34, 19, 13, 303, 90, 16),
    new THREE.MeshStandardMaterial({ color: 0x4c5960, roughness: 0.96 }),
  );
  coast.scale.set(1.6, 0.72, 0.42);
  coast.position.set(0, -7, -43);
  root.add(coast);

  const whiteStone = new THREE.MeshStandardMaterial({ color: 0xc6c4b6, roughness: 0.72, metalness: 0.03 });
  const paleStone = new THREE.MeshStandardMaterial({ color: 0xe0ddd0, roughness: 0.65 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x38475a, roughness: 0.48, metalness: 0.26 });
  const city = new THREE.Group();
  city.position.set(0, -3.6, -34);
  root.add(city);

  const flags = [];
  for (let ring = 0; ring < 3; ring += 1) {
    const count = 7 + ring * 3;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 1.5 + 0.75;
      const radius = 9 + ring * 7;
      const height = 3.5 + random() * 5 + (2 - ring) * 1.4;
      const tower = createTower(whiteStone, roofMaterial, height, 0.55 + random() * 0.45);
      tower.position.set(Math.cos(angle) * radius, ring * 2.2, Math.sin(angle) * radius * 0.42);
      city.add(tower);
      if ((i + ring) % 3 === 0) {
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.48, 8, 2), new THREE.MeshBasicMaterial({ color: 0xe7e2cd, side: THREE.DoubleSide }));
        flag.position.copy(tower.position).add(new THREE.Vector3(0.65, height + 1.8, 0));
        flag.userData.phase = random() * 10;
        flags.push(flag);
        city.add(flag);
      }
    }
  }

  // The supplied cinematic plate already carries the monumental central keep;
  // omit the old low-poly citadel so the long Narsil silhouette remains legible.
  const citadel = createTower(paleStone, roofMaterial, 13.5, 1.65);
  citadel.position.set(0, 6.4, -2);
  citadel.visible = false;
  city.add(citadel);
  const palace = new THREE.Mesh(new THREE.BoxGeometry(9, 2.8, 4.5), paleStone);
  palace.position.set(0, 5.8, -1.4);
  palace.castShadow = true;
  city.add(palace);

  // Monumental arch and bridge evoke the seafaring architecture of Númenor.
  const archMaterial = whiteStone;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.5, 12, 80, Math.PI), archMaterial);
  arch.rotation.z = 0;
  arch.position.set(-12, 2.8, -1);
  city.add(arch);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 0.55, 1.6), archMaterial);
  bridge.position.set(-6, 3.0, -1);
  city.add(bridge);

  const waterfallMaterials = [];
  for (const x of [-15, 13]) {
    const material = makeWaterfallMaterial('#d9f6ff');
    material.uniforms.uOpacity.value = 0.56;
    const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 18, 20, 40), material);
    waterfall.position.set(x, 1.5, -31);
    root.add(waterfall);
    waterfallMaterials.push(material);
  }

  const cloudTexture = createSmokeTexture();
  const clouds = [];
  for (let i = 0; i < Math.floor(11 * quality); i += 1) {
    const cloud = createCloud(cloudTexture, random, 0xe8d7c8);
    cloud.position.set((random() - 0.5) * 100, 14 + random() * 23, -38 - random() * 45);
    cloud.userData.speed = 0.25 + random() * 0.45;
    clouds.push(cloud);
    root.add(cloud);
  }

  const sunlight = new THREE.DirectionalLight(0xffdfad, 4.6);
  sunlight.position.set(-18, 30, 15);
  sunlight.castShadow = quality > 0.7;
  sunlight.shadow.mapSize.set(1024, 1024);
  root.add(sunlight, new THREE.HemisphereLight(0xa9c6e8, 0x4f3424, 1.65));
  const cityGlow = new THREE.PointLight(0xffc16e, 58, 72, 2);
  cityGlow.position.set(0, 11, -28);
  root.add(cityGlow);

  const dust = createPointField(Math.floor(280 * quality), { x: 80, y: 34, z: 50, minY: -2, offsetZ: -25 }, 0xffdd9e, 0.09, createRadialTexture(), random);
  dust.material.opacity = 0.28;
  root.add(dust);

  blendSceneryWithBackdrop(root, 0.2);
  const artifact = createNarsil();
  root.add(artifact.root);
  addContactShadow(root, 0x04080c);

  return {
    key: 'gondor', root, artifact,
    background: cinematicBackgrounds.gondor,
    fog: new THREE.FogExp2(0x34444d, 0.009),
    camera: { position: new THREE.Vector3(0.8, 2.5, 18.8), target: new THREE.Vector3(0.45, 2.4, 0), min: 11, max: 27 },
    ui: {
      chapter: 'II', realm: 'GONDOR · NÚMENOR', type: 'THE SWORD OF ELENDIL', name: 'NARSIL',
      lore: 'A moon-bright blade of the Dúnedain, borne by Elendil and raised by Isildur. Its steel carries the memory of Númenor and the high towers of Gondor.',
      specs: [['ORIGIN', 'NÚMENOR'], ['BEARER', 'ISILDUR'], ['MATERIAL', 'STAR-STEEL']],
      world: 'GONDOR', subtitle: 'HEIRS OF NÚMENOR', loading: 'RAISING THE WHITE CITY',
    },
    audio: { filter: 620, gain: 0.03, pitch: 92 },
    update(time, delta, active) {
      sky.material.uniforms.uTime.value = time;
      waterMaterial.uniforms.uTime.value = time;
      waterfallMaterials.forEach((material) => { material.uniforms.uTime.value = time; });
      artifact.update(time, delta, active);
      clouds.forEach((cloud) => {
        cloud.position.x += cloud.userData.speed * delta;
        if (cloud.position.x > 60) cloud.position.x = -60;
      });
      flags.forEach((flag) => {
        flag.rotation.y = Math.sin(time * 1.8 + flag.userData.phase) * 0.22;
        flag.rotation.z = Math.sin(time * 2.4 + flag.userData.phase) * 0.06;
      });
      dust.rotation.y += delta * 0.012;
      cityGlow.intensity = 53 + Math.sin(time * 0.8) * 5;
    },
  };
}

function createElvenTower(stone, roof, height, scale = 1) {
  const group = new THREE.Group();
  const columnCount = 6;
  for (let i = 0; i < columnCount; i += 1) {
    const angle = i / columnCount * Math.PI * 2;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.15 * scale, height, 9), stone);
    column.position.set(Math.cos(angle) * 0.55 * scale, height / 2, Math.sin(angle) * 0.55 * scale);
    group.add(column);
  }
  const floorCount = 3;
  for (let i = 0; i < floorCount; i += 1) {
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(0.78 * scale, 0.72 * scale, 0.13 * scale, 24), stone);
    balcony.position.y = height * (0.22 + i * 0.3);
    group.add(balcony);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.92 * scale, 2.2 * scale, 24), roof);
  cap.position.y = height + 1.05 * scale;
  group.add(cap);
  return group;
}

function createRivendell(quality) {
  const root = new THREE.Group();
  root.name = 'Rivendell';
  const random = seeded(0xe1fe1100);
  const sky = createSkyDome('#102a30', '#8ab0a2', '#152d28');
  root.add(sky);

  const stone = new THREE.MeshStandardMaterial({ color: 0xaaa99a, roughness: 0.74 });
  const mossStone = new THREE.MeshStandardMaterial({ color: 0x4b5f4c, roughness: 0.9 });
  const roof = new THREE.MeshPhysicalMaterial({ color: 0xb9a36d, metalness: 0.52, roughness: 0.4 });

  const riverMaterial = makeWaterMaterial('#062f36', '#8bded0');
  const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 80, 80), riverMaterial);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, -4.15, -30);
  root.add(river);

  const cliffs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i += 1) {
      const cliff = new THREE.Mesh(
        createMountainGeometry(10 + random() * 8, 21 + random() * 16, 0.3, 700 + i + (side > 0 ? 20 : 0), 44, 20),
        mossStone,
      );
      cliff.scale.set(0.55 + random() * 0.5, 1, 0.55 + random() * 0.55);
      cliff.position.set(side * (22 + random() * 34), -7, -22 - random() * 48);
      cliffs.push(cliff);
      root.add(cliff);
    }
  }

  const city = new THREE.Group();
  city.position.set(0, -3.55, -29);
  root.add(city);
  for (let i = 0; i < 11; i += 1) {
    const tower = createElvenTower(stone, roof, 4 + random() * 6, 0.6 + random() * 0.65);
    tower.position.set((random() - 0.5) * 34, random() * 8, (random() - 0.5) * 13);
    city.add(tower);
  }

  // Slender elven arches crossing the valley.
  for (let i = 0; i < 3; i += 1) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4 + i * 1.4, 0.18, 10, 56, Math.PI), stone);
    arch.position.set(-10 + i * 9.5, 1.5 + i * 1.8, -1 - i * 2);
    city.add(arch);
  }

  const waterfallMaterials = [];
  for (const [x, y, width, height, z] of [[-17, 7, 4, 25, -31], [16, 12, 5, 32, -38], [4, 8, 2.2, 20, -45]]) {
    const material = makeWaterfallMaterial('#c7fff5');
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 18, 50), material);
    fall.position.set(x, y, z);
    fall.rotation.y = x < 0 ? 0.12 : -0.12;
    waterfallMaterials.push(material);
    root.add(fall);
  }

  const treeTrunk = new THREE.CylinderGeometry(0.14, 0.24, 2.1, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x34261b, roughness: 1 });
  const trunks = new THREE.InstancedMesh(treeTrunk, trunkMaterial, Math.floor(150 * quality));
  const leafGeometry = new THREE.ConeGeometry(1.05, 3.2, 9);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x163f32, roughness: 0.92 });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, trunks.count);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < trunks.count; i += 1) {
    const x = (random() - 0.5) * 80;
    const z = -8 - random() * 58;
    const size = 0.55 + random() * 1.1;
    matrix.compose(new THREE.Vector3(x, -3.1, z), q, s.set(size, size, size));
    trunks.setMatrixAt(i, matrix);
    matrix.compose(new THREE.Vector3(x, -1.05 + size * 0.4, z), q, s.set(size, size, size));
    leaves.setMatrixAt(i, matrix);
  }
  root.add(trunks, leaves);

  const fireflyTexture = createSparkTexture('#baffd7');
  const fireflies = createPointField(Math.floor(370 * quality), { x: 60, y: 20, z: 50, minY: -2, offsetZ: -20 }, 0xa7ffd9, 0.17, fireflyTexture, random);
  root.add(fireflies);

  const mistTexture = createSmokeTexture();
  const mists = [];
  for (let i = 0; i < Math.floor(16 * quality); i += 1) {
    const mist = createCloud(mistTexture, random, 0xb4d8d1);
    mist.position.set((random() - 0.5) * 70, -1 + random() * 7, -20 - random() * 45);
    mist.userData.speed = 0.08 + random() * 0.12;
    mists.push(mist);
    root.add(mist);
  }

  const moon = new THREE.DirectionalLight(0xb9e8e4, 3.2);
  moon.position.set(-12, 26, 15);
  moon.castShadow = quality > 0.7;
  root.add(moon, new THREE.HemisphereLight(0xa1d9d0, 0x183229, 1.7));
  const valleyGlow = new THREE.PointLight(0x76f3d2, 32, 60, 2);
  valleyGlow.position.set(0, 8, -25);
  root.add(valleyGlow);

  blendSceneryWithBackdrop(root, 0.22);
  const artifact = createNenya();
  root.add(artifact.root);
  addContactShadow(root, 0x020807);

  return {
    key: 'rivendell', root, artifact,
    background: cinematicBackgrounds.rivendell,
    fog: new THREE.FogExp2(0x18352f, 0.0095),
    camera: { position: new THREE.Vector3(0.4, 0.2, 9.4), target: new THREE.Vector3(0, 0.15, 0), min: 5.3, max: 16 },
    ui: {
      chapter: 'III', realm: 'RIVENDELL', type: 'THE RING OF WATER', name: 'NENYA',
      lore: 'The Ring of Adamant, borne by Galadriel: silver as starlight, crowned by a clear stone whose quiet power preserves beauty against the passing of time.',
      specs: [['KEEPER', 'GALADRIEL'], ['REALM', 'LOTHLÓRIEN'], ['STONE', 'ADAMANT']],
      world: 'RIVENDELL', subtitle: 'THE HIDDEN VALLEY', loading: 'OPENING THE HIDDEN VALLEY',
    },
    audio: { filter: 1100, gain: 0.027, pitch: 146 },
    update(time, delta, active) {
      sky.material.uniforms.uTime.value = time;
      riverMaterial.uniforms.uTime.value = time;
      waterfallMaterials.forEach((material, index) => { material.uniforms.uTime.value = time + index * 0.7; });
      artifact.update(time, delta, active);
      fireflies.rotation.y += delta * 0.025;
      fireflies.material.opacity = 0.65 + Math.sin(time * 1.4) * 0.16;
      mists.forEach((mist) => {
        mist.position.x += mist.userData.speed * delta;
        if (mist.position.x > 40) mist.position.x = -40;
      });
      leaves.rotation.z = Math.sin(time * 0.22) * 0.002;
      valleyGlow.intensity = 28 + Math.sin(time * 1.1) * 5;
    },
  };
}

export function createWorlds() {
  const quality = window.innerWidth < 700 ? 0.58 : window.devicePixelRatio > 1.8 ? 0.78 : 1;
  return [createMordor(quality), createGondor(quality), createRivendell(quality)];
}
