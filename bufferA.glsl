// Buffer A
// iChannel0 = Buffer A (feedback)
// iChannel1 = Keyboard

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uLookDelta;

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
    float fov      = max(s1.z, 0.01);   // <--- NEW

    if (iFrame == 0 || length(pos) < 1e-6)
    {
        pos = vec3(1.0, 2.0, 2.0);

        vec3 target = vec3(-1.9, -2.01, -0.20005);
        vec3 dir = normalize(target - pos);

        yaw   = atan(dir.z, dir.x);
        pitch = asin(clamp(dir.y, -1.0, 1.0));

        moveStep = 1.0;
        fov = 1.0;                      // <--- NEW default
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
    float moveSpeed = baseSpeed * moveStep * fast;

    vec3 fwd = forwardFromYawPitch(yaw, pitch);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(fwd, worldUp));
    vec3 camUp = normalize(cross(right, fwd));

    pos += (fwd * fw + right * rt + camUp * up) * moveSpeed * dt;

    if (fc.x == 0) fragColor = vec4(pos, yaw);
    else           fragColor = vec4(pitch, moveStep, fov, 0.0); // <--- store fov in .z
}
