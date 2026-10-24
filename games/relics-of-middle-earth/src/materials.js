import * as THREE from 'three';

export function createRadialTexture(stops = [
  [0, 'rgba(255,255,255,1)'],
  [0.28, 'rgba(255,255,255,.5)'],
  [1, 'rgba(255,255,255,0)'],
], size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [position, color] of stops) gradient.addColorStop(position, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createInscriptionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 112px Georgia, serif';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 7;
  ctx.fillStyle = '#fff';
  const glyphs = 'ᚨ ᛋᚺ ᚾᚨᛉᚷ ᛞᚢᚱᛒᚨᛏᚢᛚᚢᚲ ᚨᛋᚺ ᚾᚨᛉᚷ ᚷᛁᛗᛒᚨᛏᚢᛚ  ·  ';
  const pattern = `${glyphs}${glyphs}${glyphs}`;
  ctx.fillText(pattern, 20, 130);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1.4, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createBladeRuneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(64, 940);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 30px Georgia, serif';
  ctx.fillStyle = '#dff5ff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 5;
  ctx.fillText('ᚾᚨᚱᛋᛁᛚ  ·  ᛖᛚᛖᚾᛞᛁᛚ  ·  ᚾᚢᛗᛖᚾᛟᚱ', 0, 0);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeLavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBrightness: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 1.6 + uTime * 1.5) * cos(p.y * 1.1 - uTime) * 0.08;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      uniform float uBrightness;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) { value += noise(p) * amp; p *= 2.03; amp *= 0.5; }
        return value;
      }
      void main() {
        vec2 flow = vUv * vec2(7.0, 12.0) + vec2(uTime * .12, -uTime * .38);
        float n = fbm(flow) + fbm(flow * 1.7 + 4.2) * .45;
        float vein = smoothstep(.48, .85, n + sin(vUv.y * 32.0 - uTime * 2.4) * .12);
        vec3 deep = vec3(.18, .005, 0.0);
        vec3 red = vec3(1.0, .07, .005);
        vec3 hot = vec3(1.0, .82, .16);
        vec3 color = mix(deep, red, smoothstep(.2, .65, n));
        color = mix(color, hot, vein);
        gl_FragColor = vec4(color * (1.3 + uBrightness * .8 + vWave), .96);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function makeWaterMaterial(colorA = '#0b4f68', colorB = '#8edfd4') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * .65 + uTime) * .09 + sin(p.y * 1.35 - uTime * 1.4) * .045;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      void main() {
        float lines = pow(abs(sin((vUv.x + vUv.y) * 42.0 + uTime * 1.5)), 24.0);
        float shimmer = sin(vUv.x * 80.0 - uTime * 2.0) * .5 + .5;
        vec3 color = mix(uColorA, uColorB, .25 + vWave * 2.2 + lines * .32 + shimmer * .08);
        gl_FragColor = vec4(color, .68 + lines * .18);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function makeWaterfallMaterial(color = '#bdefff') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.72 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float lane = sin(vUv.x * 52.0 + sin(vUv.y * 9.0)) * .5 + .5;
        float rush = sin((vUv.y + uTime * .72) * 85.0 + hash(floor(vUv.x * 20.0)) * 8.0) * .5 + .5;
        float edge = smoothstep(0.0, .14, vUv.x) * smoothstep(0.0, .14, 1.0 - vUv.x);
        float alpha = (.25 + lane * .36 + rush * .27) * edge * uOpacity;
        gl_FragColor = vec4(uColor * (1.0 + rush * .45), alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createSkyDome(topColor, horizonColor, bottomColor) {
  const geometry = new THREE.SphereGeometry(150, 40, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(topColor) },
      uHorizon: { value: new THREE.Color(horizonColor) },
      uBottom: { value: new THREE.Color(bottomColor) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform float uTime;
      void main() {
        float h = vWorld.y * .5 + .5;
        vec3 color = h > .46 ? mix(uHorizon, uTop, smoothstep(.46, 1.0, h)) : mix(uBottom, uHorizon, smoothstep(0.0, .46, h));
        float haze = sin(vWorld.x * 15.0 + uTime * .015) * sin(vWorld.z * 11.0) * .018;
        gl_FragColor = vec4(color + haze, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -100;
  return mesh;
}

export function createSmokeTexture() {
  return createRadialTexture([
    [0, 'rgba(170,155,145,.45)'],
    [.3, 'rgba(105,95,90,.26)'],
    [1, 'rgba(30,25,25,0)'],
  ], 192);
}

export function createSparkTexture(color = '#fff4c4') {
  return createRadialTexture([
    [0, 'rgba(255,255,255,1)'],
    [.15, color],
    [.45, 'rgba(255,160,50,.45)'],
    [1, 'rgba(255,80,20,0)'],
  ]);
}
