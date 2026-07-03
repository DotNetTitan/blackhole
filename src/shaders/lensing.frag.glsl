uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform mat3 uCamMatrix;
uniform float uFovScale;
uniform float uAspect;
uniform float uTime;
uniform sampler2D uSkybox;
uniform float uRs;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskSpeed;
uniform float uDiskBrightness;

const float PI = 3.14159265359;

// ---- lightweight hash / value noise (self-contained, no external deps) ----
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise2(p);
    p *= 2.02;
    amp *= 0.55;
  }
  return v;
}

vec2 dirToEquirect(vec3 d) {
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return vec2(u, v);
}

float diskDensity(float radius) {
  float inner = smoothstep(uDiskInner, uDiskInner + 0.2, radius);
  float outer = 1.0 - smoothstep(uDiskOuter - 0.8, uDiskOuter, radius);
  return clamp(inner * outer, 0.0, 1.0);
}

vec3 diskShade(vec3 p, float radius, vec3 rd) {
  float angle = atan(p.z, p.x);
  float t = 1.0 - clamp((radius - uDiskInner) / max(uDiskOuter - uDiskInner, 0.001), 0.0, 1.0);

  float rotSpeed = uDiskSpeed / pow(max(radius, 0.4), 1.5);
  vec2 noiseCoord = vec2(angle * 3.0 - uTime * rotSpeed * 1.5, radius * 1.2);
  float turb = fbm(noiseCoord * 2.0);

  vec3 hot  = vec3(1.0, 0.96, 0.88);
  vec3 mid  = vec3(1.0, 0.55, 0.20);
  vec3 cool = vec3(0.55, 0.09, 0.02);
  vec3 base = t > 0.55 ? mix(mid, hot, (t - 0.55) / 0.45) : mix(cool, mid, t / 0.55);
  base *= 0.55 + 0.9 * turb;

  // relativistic beaming: approaching disk material brightens & blue-shifts,
  // receding material dims & red-shifts
  vec3 tangent = normalize(vec3(-sin(angle), 0.0, cos(angle)));
  float doppler = dot(tangent, normalize(-rd));
  float beam = pow(clamp(1.0 + doppler * 0.9, 0.05, 3.2), 2.2);
  vec3 shifted = mix(base * vec3(1.0, 0.55, 0.4), base * vec3(0.55, 0.72, 1.0), clamp(doppler * 0.5 + 0.5, 0.0, 1.0));

  return shifted * beam * uDiskBrightness;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  vec3 rdCam = normalize(vec3(uv * uFovScale, -1.0));
  vec3 dir = normalize(uCamMatrix * rdCam);
  vec3 pos = uCamPos;

  vec3 accum = vec3(0.0);
  float accumA = 0.0;

  const int STEPS = 140;
  for (int i = 0; i < STEPS; i++) {
    if (accumA > 0.995) break;

    float r2 = dot(pos, pos);
    float r = sqrt(r2);

    if (r < uRs * 1.05) {
      accumA = 1.0;
      break;
    }
    if (r > 60.0 && dot(pos, dir) > 0.0) {
      vec2 suv = dirToEquirect(normalize(dir));
      vec3 sky = texture2D(uSkybox, suv).rgb;
      accum += (1.0 - accumA) * sky;
      accumA = 1.0;
      break;
    }

    float stepSize = clamp(r * 0.12, 0.015, 0.5);

    vec3 h = cross(pos, dir);
    vec3 accel = -1.5 * uRs * dot(h, h) * pos / pow(r2, 2.5);
    vec3 newDir = normalize(dir + accel * stepSize);
    vec3 prevPos = pos;
    pos += newDir * stepSize;
    dir = newDir;

    if ((prevPos.y > 0.0) != (pos.y > 0.0)) {
      float denom = prevPos.y - pos.y;
      float tcross = abs(denom) > 1e-6 ? prevPos.y / denom : 0.0;
      vec3 crossPos = mix(prevPos, pos, clamp(tcross, 0.0, 1.0));
      float radius = length(crossPos.xz);
      if (radius > uDiskInner && radius < uDiskOuter) {
        float dens = diskDensity(radius);
        if (dens > 0.001) {
          vec3 col = diskShade(crossPos, radius, dir);
          float a = dens * (1.0 - accumA);
          accum += a * col;
          accumA += a;
        }
      }
    }
  }

  gl_FragColor = vec4(accum, 1.0);
}
