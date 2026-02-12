// Buffer A
// iChannel0 = Buffer A (feedback)
// iChannel1 = Keyboard

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uLookDelta;
uniform float uMoveScale;
uniform float uResetCamera;
uniform float uMinHit;
uniform int uMode;
uniform int uMbIters;

const int MB_ITERS_CAP = 24;

bool keyDown(int key)
{
    return texelFetch(iChannel1, ivec2(key, 0), 0).r > 0.5;
}

vec3 forwardFromYawPitch(float yaw, float pitch)
{
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    return normalize(vec3(cy * cp, sp, sy * cp)); // Y up
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

        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        z += p;
    }

    return 0.5 * log(r) * r / dr;
}

float mandelboxDE(vec3 p)
{
    vec3 z = p;
    float dr = 1.0;
    const float scale = -1.6;
    const float minRadius2 = 0.25;
    const float fixedRadius2 = 1.0;

    for (int i = 0; i < MB_ITERS_CAP; i++)
    {
        if (i >= uMbIters) break;

        z = clamp(z, -1.0, 1.0) * 2.0 - z;
        float r2 = dot(z, z);
        if (r2 < minRadius2)
        {
            float m = fixedRadius2 / minRadius2;
            z *= m;
            dr *= m;
        }
        else if (r2 < fixedRadius2)
        {
            float m = fixedRadius2 / r2;
            z *= m;
            dr *= m;
        }

        z = z * scale + p;
        dr = dr * abs(scale) + 1.0;
        if (dot(z, z) > 100.0) break;
    }

    return length(z) / max(abs(dr), 1e-5);
}

float juliaBulbDE(vec3 p)
{
    const float power = 8.0;
    vec3 c = vec3(-0.32, 0.56, -0.14);
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;

    for (int i = 0; i < MB_ITERS_CAP; i++)
    {
        if (i >= uMbIters) break;
        r = length(z);
        if (r > 4.0) break;

        float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
        float phi = atan(z.y, z.x);

        dr = pow(r, power - 1.0) * power * dr + 1.0;

        float zr = pow(r, power);
        theta *= power;
        phi *= power;
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + c;
    }

    return 0.5 * log(max(r, 1e-6)) * r / max(dr, 1e-5);
}

float gyroidHybridDE(vec3 p)
{
    vec3 q = p;
    float foldScale = 1.0;
    for (int i = 0; i < 6; i++)
    {
        if (i >= max(3, uMbIters / 3)) break;
        q = abs(q) - vec3(1.05, 1.12, 0.98);
        q = q.yzx;
        foldScale *= 1.22;
    }

    float gyroid = abs(dot(sin(p * 1.55), cos(p.zxy * 1.55))) - 0.34;
    float folded = (length(q) - 0.72) / foldScale;
    return min(gyroid * 0.62, folded);
}

float mapScene(vec3 p)
{
    if (uMode == 2)
    {
        return mandelbulbDE(sin(p));
    }

    if (uMode == 4)
    {
        return mandelboxDE(p);
    }

    if (uMode == 5)
    {
        return juliaBulbDE(p);
    }

    if (uMode == 6)
    {
        return gyroidHybridDE(p);
    }

    return mandelbulbDE(p);
}

float estimateForwardClearance(vec3 pos, vec3 fwd)
{
    float t = max(uMinHit * 12.0, 0.01);
    float hitThreshold = max(uMinHit * 2.5, 0.002);

    for (int i = 0; i < 24; i++)
    {
        float d = mapScene(pos + fwd * t);
        if (d < hitThreshold)
        {
            return t;
        }
        t += clamp(d, 0.01, 1.6);
        if (t > 40.0) break;
    }

    return t;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 fc = ivec2(fragCoord);
    if (fc.y > 0 || fc.x > 1) { fragColor = vec4(0.0); return; }

    vec4 s0 = texelFetch(iChannel0, ivec2(0,0), 0);
    vec4 s1 = texelFetch(iChannel0, ivec2(1,0), 0);

    vec3  pos      = s0.xyz;
    float yaw      = s0.w;
    float pitch    = s1.x;
    float moveStep = max(s1.y, 0.01);
    float fov      = max(s1.z, 0.01);
    float proximityZoom = clamp(s1.w, 0.0, 0.85);

    if (iFrame == 0 || length(pos) < 1e-6 || uResetCamera > 0.5)
    {
        pos = vec3(1.0, 2.0, 2.0);

        vec3 target = vec3(-1.9, -2.01, -0.20005);
        vec3 dir = normalize(target - pos);

        yaw   = atan(dir.z, dir.x);
        pitch = asin(clamp(dir.y, -1.0, 1.0));

        moveStep = 1.0;
        fov = 1.0;
        proximityZoom = 0.0;
    }

    float dt = max(iTimeDelta, 1.0/240.0);

    // Move
    float fw = (keyDown(87) ? 1.0 : 0.0) - (keyDown(83) ? 1.0 : 0.0); // W/S
    float rt = (keyDown(68) ? 1.0 : 0.0) - (keyDown(65) ? 1.0 : 0.0); // D/A
    float up = (keyDown(69) ? 1.0 : 0.0) - (keyDown(81) ? 1.0 : 0.0); // E/Q

    // Turn (arrows)
    float yawIn = (keyDown(39) ? 1.0 : 0.0) - (keyDown(37) ? 1.0 : 0.0); // Right/Left
    float pitIn = (keyDown(38) ? 1.0 : 0.0) - (keyDown(40) ? 1.0 : 0.0); // Up/Down

    float lookSpeed = 1.8;
    yaw   += yawIn * lookSpeed * dt + uLookDelta.x;
    pitch += pitIn * lookSpeed * dt + uLookDelta.y;
    pitch = clamp(pitch, -1.55, 1.55);

    // Movement step adjust: Z/X
    float stepIn = (keyDown(88) ? 1.0 : 0.0) - (keyDown(90) ? 1.0 : 0.0); // X - Z
    moveStep *= exp(stepIn * 1.4 * dt);
    moveStep = clamp(moveStep, 0.1, 10.0);

    // FOV adjust: '+' and '-'
    // '-' = 189, '+' is usually '=' (187) with Shift
    float fovIn = (keyDown(189) ? 1.0 : 0.0) - (keyDown(187) ? 1.0 : 0.0); // '-' minus, '+' plus
    // Multiplicative for smooth zoom
    fov *= exp(fovIn * 1.6 * dt);
    fov = clamp(fov, 0.1, 1000.0); // smaller = wider, larger = narrower

    float fast = keyDown(16) ? 4.0 : 1.0; // Shift
    float baseSpeed = 2.5;
    float moveSpeed = baseSpeed * moveStep * fast * max(uMoveScale, 0.03125);

    vec3 fwd = forwardFromYawPitch(yaw, pitch);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(fwd, worldUp));
    vec3 camUp = normalize(cross(right, fwd));

    float clearance = estimateForwardClearance(pos, fwd);
    float safetyMargin = max(uMinHit * 10.0, 0.0025);
    vec3 moveDelta = (fwd * fw + right * rt + camUp * up) * moveSpeed * dt;

    float zoomNearDistance = max(safetyMargin * 34.0, 0.8);
    float nearFactor = 1.0 - smoothstep(safetyMargin, zoomNearDistance, clearance);
    float zoomTarget = nearFactor * 0.68;
    if (fw <= 0.0)
    {
        zoomTarget *= 0.35;
    }
    float zoomResponse = 1.0 - exp(-(fw > 0.0 ? 7.0 : 3.0) * dt);
    proximityZoom = mix(proximityZoom, zoomTarget, zoomResponse);
    proximityZoom = clamp(proximityZoom, 0.0, 0.85);

    pos += moveDelta;

    if (fc.x == 0) fragColor = vec4(pos, yaw);
    else           fragColor = vec4(pitch, moveStep, fov, proximityZoom);
}
