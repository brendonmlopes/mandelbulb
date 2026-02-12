// Buffer A
// iChannel0 = Buffer A (feedback)
// iChannel1 = Keyboard

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uLookDelta;
uniform float uMoveScale;
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

float mapScene(vec3 p)
{
    if (uMode == 2)
    {
        return mandelbulbDE(sin(p));
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

    if (iFrame == 0 || length(pos) < 1e-6)
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
