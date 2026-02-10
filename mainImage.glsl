// Image
// iChannel0 = Buffer A

#ifdef GL_ES
precision highp float;
#endif

const int   MAX_STEPS_CAP = 320;
const int   MB_ITERS_CAP  = 24;
uniform float uMinHit;
uniform float uEps;
uniform int uMode;
uniform float uMaxDist;
uniform float uGlowStrength;
uniform float uStepTint;
uniform int uMaxSteps;
uniform int uMbIters;
uniform int uLowPowerMode;

mat3 makeCamera(vec3 ro, vec3 ta, float roll)
{
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

float mandelbulbDE(vec3 p)
{
    float MB_POWER = min(iTime/10.0, 10.0);

    vec3 z = (uMode == 3) ? sin(p) : p;
    float dr = 1.0;
    float r  = 0.0;

    for (int i = 0; i < MB_ITERS_CAP; i++)
    {
        if (i >= uMbIters) break;
        r = length(z);
        if (r > 4.0) break;

        float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
        float phi   = atan(z.y, z.x);

        dr = pow(r, MB_POWER - 1.0) * MB_POWER * dr + 1.0;

        float zr = pow(r, MB_POWER);
        theta *= MB_POWER;
        phi   *= MB_POWER;

        z = zr * vec3(sin(theta) * cos(phi),
                      sin(theta) * sin(phi),
                      cos(theta));
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
    vec2 e = vec2(uEps, 0.0);
    float d = mapScene(p);
    vec3 n = vec3(
        mapScene(p + vec3(e.x, e.y, e.y)) - d,
        mapScene(p + vec3(e.y, e.x, e.y)) - d,
        mapScene(p + vec3(e.y, e.y, e.x)) - d
    );
    return normalize(n);
}

float softShadow(vec3 ro, vec3 rd, float tmin, float tmax)
{
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 24; i++)
    {
        if (uLowPowerMode == 1 && i >= 12) break;
        float h = mapScene(ro + rd * t);
        if (h < 0.0008) return 0.0;
        res = min(res, 8.0 * h / t);
        t += clamp(h, 0.01, 0.25);
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
        float h = 0.02 + 0.06 * float(i);
        float d = mapScene(p + n * h);
        ao += (h - d) * sca;
        sca *= 0.6;
    }
    return clamp(1.0 - 1.6 * ao, 0.0, 1.0);
}

// Raymarch that also returns number of steps used
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

vec3 forwardFromYawPitch(float yaw, float pitch)
{
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    return normalize(vec3(cy * cp, sp, sy * cp));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Camera state from Buffer A
    vec4 s0 = texelFetch(iChannel0, ivec2(0,0), 0);
    vec4 s1 = texelFetch(iChannel0, ivec2(1,0), 0);

    vec3 ro = s0.xyz;
    float yaw = s0.w;
    float pitch = s1.x;

    vec3 fwd = forwardFromYawPitch(yaw, pitch);
    vec3 ta  = ro + fwd * 3.0;

    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    mat3 cam = makeCamera(ro, ta, 0.0);

    float FOV = s1.z;
    vec3 rd = normalize(cam * vec3(uv, FOV));

    float t;
    vec3 pHit;
    int stepsUsed;
    bool hit = raymarch(ro, rd, t, pHit, stepsUsed);

    // Step-based color (0..1)
    float maxStepsF = max(float(uMaxSteps), 1.0);
    float s = float(stepsUsed) / maxStepsF;
    vec3 stepCol = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + exp(-10.0*s)));

    vec3 col = vec3(0.02, 0.03, 0.9) + 0.02 * vec3(uv.y);

    if (hit)
    {
        vec3 n = calcNormal(pHit);

        vec3 lightPos = ro + vec3(3.5, 
        4.0, 2.5);
        vec3 ldir = normalize(lightPos - pHit);
        vec3 vdir = normalize(ro - pHit);
        vec3 hdir = normalize(ldir + vdir);

        float diff = max(dot(n, ldir), 0.0);
        float specPower = (uLowPowerMode == 1) ? 24.0 : 64.0;
        float spec = pow(max(dot(n, hdir), 0.0), specPower);

        float sh = (uLowPowerMode == 1) ? 1.0 : softShadow(pHit + n * 0.002, ldir, 0.02, 12.0);
        float ao = ambientOcclusion(pHit, n);

        float glow = exp(-0.12 * t);
        vec3 base = 0.55 + 0.45 * cos(vec3(0.0, 1.0, 2.0) + 0.7 * pHit.xyz);

        col = base * (0.15 + 0.85 * diff * sh);
        float specScale = (uLowPowerMode == 1) ? 0.2 : 0.35;
        col += specScale * spec * sh;
        col *= ao;

        if (uLowPowerMode == 0)
        {
            float rim = pow(1.0 - max(dot(n, vdir), 0.0), 2.0);
            col += 0.18 * rim * base;
        }

        col = mix(col, vec3(0.02, 0.03, 0.05), 1.0 - exp(-0.05 * t));
        col += 0.05 * glow * uGlowStrength;

        // Map/tint final color by raymarch steps
        float tintMix = clamp(uStepTint * exp(-0.25 / max(s, 1e-4)), 0.0, 1.0);
        col = mix(col, stepCol, tintMix);
    }
    else
    {
        // Optional: background also shows step heat
        col = mix(col, exp(-stepCol), clamp(uStepTint, 0.0, 1.0));
    }

    fragColor = vec4(col, 1.0);
}
