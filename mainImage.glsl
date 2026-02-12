// Image
// iChannel0 = Buffer A

#ifdef GL_ES
precision highp float;
#endif

const int MAX_STEPS_CAP = 1000;
const int MB_ITERS_CAP = 24;
const float PI = 3.14159265359;

uniform float uMinHit;
uniform float uEps;
uniform int uMode;
uniform float uMaxDist;
uniform float uGlowStrength;
uniform float uStepTint;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uSunAzimuth;
uniform float uSunElevation;
uniform float uSunIntensity;
uniform float uFogDensity;
uniform float uRoughness;
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform int uMaxSteps;
uniform int uMbIters;
uniform int uLowPowerMode;
uniform float uFovOverride;

mat3 makeCamera(vec3 ro, vec3 ta, float roll)
{
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

vec3 forwardFromYawPitch(float yaw, float pitch)
{
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    return normalize(vec3(cy * cp, sp, sy * cp));
}

vec3 sunDirection(float azimuth, float elevation)
{
    float ca = cos(azimuth), sa = sin(azimuth);
    float ce = cos(elevation), se = sin(elevation);
    return normalize(vec3(ca * ce, se, sa * ce));
}

float mandelbulbDE(vec3 p)
{
    float MB_POWER = min(iTime / 10.0, 10.0);

    vec3 z = (uMode == 3) ? sin(p) : p;
    float dr = 1.0;
    float r = 0.0;

    for (int i = 0; i < MB_ITERS_CAP; i++)
    {
        if (i >= uMbIters) break;
        r = length(z);
        if (r > 4.0) break;

        float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
        float phi = atan(z.y, z.x);

        dr = pow(r, MB_POWER - 1.0) * MB_POWER * dr + 1.0;

        float zr = pow(r, MB_POWER);
        theta *= MB_POWER;
        phi *= MB_POWER;

        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        );
        z += p;
    }

    return 0.5 * log(r) * r / dr;
}

float mapScene(vec3 p)
{
    if (uMode == 2)
    {
        return mandelbulbDE(sin(p));
    }

    return mandelbulbDE(p);
}

vec3 calcNormal(vec3 p)
{
    float e = max(uEps, 1e-5);
    vec2 h = vec2(e, -e);
    return normalize(
        h.xyy * mapScene(p + h.xyy) +
        h.yyx * mapScene(p + h.yyx) +
        h.yxy * mapScene(p + h.yxy) +
        h.xxx * mapScene(p + h.xxx)
    );
}

float softShadow(vec3 ro, vec3 rd, float tmin, float tmax)
{
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 24; i++)
    {
        if (uLowPowerMode == 1 && i >= 12) break;
        float h = mapScene(ro + rd * t);
        if (h < 0.0007) return 0.0;
        res = min(res, 12.0 * h / t);
        t += clamp(h, 0.01, 0.35);
        if (t > tmax) break;
    }
    return clamp(res, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n)
{
    if (uLowPowerMode == 1)
    {
        return 1.0;
    }

    float ao = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++)
    {
        float h = 0.02 + 0.05 * float(i);
        float d = mapScene(p + n * h);
        ao += (h - d) * sca;
        sca *= 0.62;
    }
    return clamp(1.0 - 1.45 * ao, 0.0, 1.0);
}

bool raymarch(vec3 ro, vec3 rd, out float t, out vec3 pHit, out int stepsUsed)
{
    t = 0.0;
    stepsUsed = 0;

    for (int i = 0; i < MAX_STEPS_CAP; i++)
    {
        if (i >= uMaxSteps) break;
        stepsUsed = i + 1;

        vec3 p = ro + rd * t;
        float d = mapScene(p);

        if (d < uMinHit)
        {
            pHit = p;
            return true;
        }

        t += d;
        if (t > uMaxDist) break;
    }

    pHit = ro + rd * t;
    return false;
}

vec3 skyColor(vec3 rd, vec3 sunDir)
{
    float up = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizon = vec3(0.09, 0.16, 0.26);
    vec3 zenith = vec3(0.02, 0.08, 0.19);
    vec3 col = mix(horizon, zenith, smoothstep(0.0, 1.0, up));

    float sunAmount = max(dot(rd, sunDir), 0.0);
    vec3 sunCore = vec3(1.25, 1.03, 0.84) * pow(sunAmount, 240.0);
    vec3 sunGlow = vec3(0.30, 0.46, 0.78) * pow(sunAmount, 10.0);
    col += (sunCore + sunGlow * 0.06) * uSunIntensity;

    float horizonPulse = 0.5 + 0.5 * sin(rd.x * 6.0 + iTime * 0.1);
    col += vec3(0.02, 0.04, 0.09) * horizonPulse * (1.0 - up);
    return col;
}

vec3 acesToneMap(vec3 x)
{
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec4 s0 = texelFetch(iChannel0, ivec2(0,0), 0);
    vec4 s1 = texelFetch(iChannel0, ivec2(1,0), 0);

    vec3 ro = s0.xyz;
    float yaw = s0.w;
    float pitch = s1.x;

    vec3 fwd = forwardFromYawPitch(yaw, pitch);
    vec3 ta = ro + fwd * 3.0;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    mat3 cam = makeCamera(ro, ta, 0.0);

    float baseFov = (uFovOverride > 0.0) ? uFovOverride : s1.z;
    float proximityZoom = clamp(s1.w, 0.0, 0.85);
    float FOV = baseFov * (1.0 + proximityZoom * 1.35);
    vec3 rd = normalize(cam * vec3(uv, FOV));

    float t;
    vec3 pHit;
    int stepsUsed;
    bool hit = raymarch(ro, rd, t, pHit, stepsUsed);

    float maxStepsF = max(float(uMaxSteps), 1.0);
    float s = float(stepsUsed) / maxStepsF;
    float stepDarken = mix(1.0, 0.42, pow(clamp(s, 0.0, 1.0), 0.9));
    vec3 stepCol = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + exp(-8.0 * s)));

    vec3 sunDir = sunDirection(uSunAzimuth, uSunElevation);
    vec3 sunCol = vec3(1.12, 0.96, 0.84) * uSunIntensity;
    vec3 background = skyColor(rd, sunDir);
    vec3 col = background;

    if (hit)
    {
        vec3 n = calcNormal(pHit);
        vec3 v = normalize(ro - pHit);
        vec3 l = sunDir;
        vec3 h = normalize(v + l);

        float NoL = max(dot(n, l), 0.0);
        float NoV = max(dot(n, v), 0.001);
        float NoH = max(dot(n, h), 0.0);
        float VoH = max(dot(v, h), 0.0);

        float rough = clamp(uRoughness + (uLowPowerMode == 1 ? 0.08 : 0.0), 0.08, 0.95);
        float a = rough * rough;
        float a2 = a * a;

        float denom = NoH * NoH * (a2 - 1.0) + 1.0;
        float D = a2 / max(PI * denom * denom, 1e-4);
        float k = (rough + 1.0);
        k = (k * k) / 8.0;
        float Gv = NoV / mix(NoV, 1.0, k);
        float Gl = NoL / mix(NoL, 1.0, k);
        float G = Gv * Gl;

        vec3 orbitPalette = 0.52 + 0.48 * cos(vec3(0.12, 2.05, 4.1) + 0.55 * pHit.xyz + vec3(0.0, 1.2, 2.6));
        vec3 accentPalette = 0.5 + 0.5 * cos(vec3(1.4, 3.2, 5.0) + vec3(0.65, 0.42, 0.84) * pHit.yzx);
        vec3 dualBase = mix(uBaseColor, uSecondaryColor, clamp(0.12 + 0.88 * s, 0.0, 1.0));
        vec3 stepDrivenColor = mix(dualBase, stepCol, 0.38);
        vec3 albedo = mix(stepDrivenColor, orbitPalette, 0.25);
        albedo = mix(albedo, accentPalette, 0.25 + 0.25 * sin(0.7 * pHit.y + iTime * 0.05));
        albedo = pow(clamp(albedo, 0.0, 1.0), vec3(0.82));

        vec3 F0 = mix(vec3(0.03), albedo, 0.08);
        vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
        vec3 spec = 0.65 * (D * G * F) / max(4.0 * NoL * NoV, 1e-4);
        vec3 kd = (1.0 - F) * (1.0 - 0.08);
        vec3 diffuse = kd * albedo / PI;

        float sh = (uLowPowerMode == 1) ? 1.0 : softShadow(pHit + n * max(uEps * 8.0, 0.0015), l, 0.03, 18.0);
        float ao = ambientOcclusion(pHit, n);

        float cavitySample = mapScene(pHit + n * (uEps * 10.0)) - mapScene(pHit - n * (uEps * 10.0));
        float cavity = clamp(0.5 + 0.5 * cavitySample / max(uEps * 20.0, 1e-5), 0.0, 1.0);

        vec3 hemiSky = vec3(0.14, 0.34, 0.64);
        vec3 hemiGround = vec3(0.10, 0.08, 0.09);
        vec3 hemi = mix(hemiGround, hemiSky, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));

        vec3 direct = (diffuse + spec) * sunCol * NoL * sh;
        vec3 ambient = albedo * hemi * (0.22 + 0.18 * (1.0 - rough));
        ambient *= ao * mix(0.78, 1.0, cavity);

        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 rimGlow = vec3(0.16, 0.25, 0.38) * rim * (0.04 + 0.03 * uSunIntensity);

        col = direct + ambient + rimGlow;

        float tintMix = clamp(0.10 + 0.60 * uStepTint, 0.0, 1.0);
        col = mix(col, stepDrivenColor, 0.06 + tintMix * 0.24);
        col *= stepDarken;

        col += vec3(0.02, 0.04, 0.08) * exp(-0.13 * t) * uGlowStrength;

        float fogAmount = 1.0 - exp(-max(uFogDensity, 0.0) * t);
        col = mix(col, background, fogAmount);
    }
    else
    {
        col = mix(col, background + 0.2 * exp(-stepCol), clamp(uStepTint, 0.0, 1.0) * 0.2);
        col *= stepDarken;
    }

    col *= max(uExposure, 0.001);
    col = acesToneMap(col);

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, clamp(uSaturation, 0.0, 2.0));
    col = (col - 0.5) * clamp(uContrast, 0.4, 2.0) + 0.5;
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
