const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(projectRoot, fileName), "utf8");
}

describe("Mandelbulb web app smoke suite", () => {
  test("required project files exist", () => {
    const requiredFiles = [
      "index.html",
      "favicon.svg",
      "style.css",
      "main.js",
      "bufferA.glsl",
      "mainImage.glsl",
      "screenshot-worker.js",
      "server.js",
      "vercel.json",
      "api/public-config.js",
      "api/create-checkout-session.js",
      "api/verify-unlock.js",
      "api/validate-unlock.js",
      "api/stripe-webhook.js",
      "lib/monetization.js",
      "lib/http.js",
      ".env.example",
      "README.md",
      "package.json",
      "jest.config.cjs",
    ];

    for (const fileName of requiredFiles) {
      const exists = fs.existsSync(path.join(projectRoot, fileName));
      expect(exists).toBe(true);
    }
  });

  test("index page contains fullscreen canvas and overlays", () => {
    const html = readProjectFile("index.html");

    expect(html).toMatch(/<canvas[^>]*id=["']glCanvas["']/i);
    expect(html).toMatch(/rel=["']icon["'][^>]*href=["']\.\/favicon\.svg["']/i);
    expect(html).toMatch(/class=["'][^"']*social-links[^"']*["']/i);
    expect(html).toMatch(/href=["']https:\/\/x\.com\/stack_overchill["']/i);
    expect(html).toMatch(/href=["']https:\/\/www\.linkedin\.com\/in\/brendon-maia-lopes-a696581a4\/["']/i);
    expect(html).toMatch(/id=["']movementHint["']/i);
    expect(html).toMatch(/id=["']movementHintTitle["']/i);
    expect(html).toMatch(/Use\s+WASD\s+to\s+move/i);
    expect(html).toMatch(/id=["']turnHint["']/i);
    expect(html).toMatch(/id=["']turnHintTitle["']/i);
    expect(html).toMatch(/Use\s+arrows\s+to\s+turn/i);
    expect(html).toMatch(/or\s+Click\s+and\s+drag/i);
    expect(html).toMatch(/class=["'][^"']*mouse-hint-icon[^"']*["']/i);
    expect(html).toMatch(/id=["']helpPointerHint["']/i);
    expect(html).toMatch(/id=["']mobileControls["']/i);
    expect(html).toMatch(/id=["']mobileFovControl["']/i);
    expect(html).toMatch(/id=["']mobileFovSlider["']/i);
    expect(html).toMatch(/id=["']mobileFovValue["']/i);
    expect(html).toMatch(/id=["']screenshotButton["']/i);
    expect(html).toMatch(/class=["'][^"']*screenshot-icon[^"']*["']/i);
    expect(html).toMatch(/aria-label=["']Capture screenshot["']/i);
    expect(html).toMatch(/id=["']helpDesktopContent["']/i);
    expect(html).toMatch(/id=["']helpMobileContent["']/i);
    expect(html).toMatch(/Touch\s+controls\s+are\s+enabled\s+for\s+your\s+phone/i);
    expect(html).toMatch(/data-touch-keycode=["']87["']/i);
    expect(html).toMatch(/data-touch-keycode=["']38["']/i);
    expect(html).toMatch(/data-touch-keycode=["']69["']/i);
    expect(html).toMatch(/id=["']helpButton["']/i);
    expect(html).toMatch(/id=["']settingsButton["']/i);
    expect(html).toMatch(/id=["']helpDialog["']/i);
    expect(html).toMatch(/id=["']settingsDialog["']/i);
    expect(html).toMatch(/id=["']paywallDialog["']/i);
    expect(html).toMatch(/id=["']unlockPremiumButton["']/i);
    expect(html).toMatch(/id=["']checkoutPremiumButton["']/i);
    expect(html).toMatch(/id=["']premiumPresetSelect["']/i);
    expect(html).toMatch(/id=["']adContainer["']/i);
    expect(html).toMatch(/id=["']adSlot["']/i);
    expect(html).toMatch(/id=["']minHitSlider["']/i);
    expect(html).toMatch(/id=["']minHitValue["']/i);
    expect(html).toMatch(/id=["']modeSelect["']/i);
    expect(html).toMatch(/id=["']maxDistSlider["']/i);
    expect(html).toMatch(/id=["']glowSlider["']/i);
    expect(html).toMatch(/id=["']stepTintSlider["']/i);
    expect(html).toMatch(/id=["']visualPresetSelect["']/i);
    expect(html).toMatch(/id=["']baseHueSlider["']/i);
    expect(html).toMatch(/id=["']baseColorValue["']/i);
    expect(html).toMatch(/id=["']exposureSlider["']/i);
    expect(html).toMatch(/id=["']contrastSlider["']/i);
    expect(html).toMatch(/id=["']saturationSlider["']/i);
    expect(html).toMatch(/id=["']sunAzimuthSlider["']/i);
    expect(html).toMatch(/id=["']sunElevationSlider["']/i);
    expect(html).toMatch(/id=["']sunIntensitySlider["']/i);
    expect(html).toMatch(/id=["']fogDensitySlider["']/i);
    expect(html).toMatch(/id=["']roughnessSlider["']/i);
    expect(html).not.toMatch(/EPS/);
    expect(html).toMatch(/Brendon Maia/);
    expect(html).toMatch(/src=["']\.\/main\.js["']/i);
    expect(html).toMatch(/href=["']\.\/style\.css["']/i);
  });

  test("help menu documents the movement controls", () => {
    const html = readProjectFile("index.html");

    expect(html).toMatch(/W\s*\/\s*S/);
    expect(html).toMatch(/A\s*\/\s*D/);
    expect(html).toMatch(/E\s*\/\s*Q/);
    expect(html).toMatch(/Arrow\s+keys/i);
    expect(html).toMatch(/Shift/i);
    expect(html).toMatch(/Z[^\n]*X/);
    expect(html).toMatch(/-\s*\(wider\)\s*\/\s*\+\s*\(narrower\)/i);
  });

  test("main.js has valid JavaScript syntax", () => {
    const source = readProjectFile("main.js");
    expect(() => new vm.Script(source, { filename: "main.js" })).not.toThrow();
  });

  test("main.js wires rendering, monetization, and ads flow", () => {
    const source = readProjectFile("main.js");

    expect(source).toContain("EXT_color_buffer_float");
    expect(source).toContain("wrapShadertoySource");
    expect(source).toContain("loadText(\"./bufferA.glsl\")");
    expect(source).toContain("loadText(\"./mainImage.glsl\")");
    expect(source).toContain("STATE_WIDTH");
    expect(source).toContain("KEYBOARD_TEX_WIDTH");
    expect(source).toContain("screenshot-worker.js");
    expect(source).toContain("getScreenshotDimensions");
    expect(source).toContain("uMaxSteps: premiumProfile ? premiumProfile.uMaxSteps : maxStepsValue");
    expect(source).toContain("uMaxDist: premiumProfile ? premiumProfile.uMaxDist : maxDistValue");
    expect(source).toContain("uMinHit: premiumProfile ? premiumProfile.uMinHit : minHitValue");
    expect(source).toContain("detectMobileClient");
    expect(source).toContain("devicePixelRatioCap");
    expect(source).toContain("PREMIUM_UNLOCK_TOKEN_KEY");
    expect(source).toContain("startCheckoutFlow");
    expect(source).toContain("initializeMonetization");
    expect(source).toContain("markInteractionForAds");
    expect(source).toContain("shouldShowAdContainer");
    expect(source).toContain("screenshotInProgress || isAnyModalOpen()");
    expect(source).toContain("WATERMARK_TEXT");
  });

  test("screenshot worker file is wired for hi-res rendering", () => {
    const workerSource = readProjectFile("screenshot-worker.js");

    expect(workerSource).toContain("OffscreenCanvas");
    expect(workerSource).toContain("convertToBlob");
    expect(workerSource).toContain("uExposure");
    expect(workerSource).toContain("uContrast");
    expect(workerSource).toContain("uSaturation");
    expect(workerSource).toContain("uSunAzimuth");
    expect(workerSource).toContain("uSunElevation");
    expect(workerSource).toContain("uSunIntensity");
    expect(workerSource).toContain("uFogDensity");
    expect(workerSource).toContain("uRoughness");
    expect(workerSource).toContain("uBaseColor");
    expect(workerSource).toContain("uMaxSteps");
    expect(workerSource).toContain("uMaxDist");
    expect(workerSource).toContain("uMinHit");
    expect(workerSource).toContain("self.onmessage");
    expect(workerSource).toContain("addWatermarkIfNeeded");
    expect(workerSource).toContain("watermarkText");
  });

  test("server exposes secure monetization endpoints", () => {
    const serverSource = readProjectFile("server.js");

    expect(serverSource).toContain("require(\"dotenv\").config");
    expect(serverSource).toContain("helmet(");
    expect(serverSource).toContain("contentSecurityPolicy");
    expect(serverSource).toContain("rateLimit");
    expect(serverSource).toContain("/api/create-checkout-session");
    expect(serverSource).toContain("/api/verify-unlock");
    expect(serverSource).toContain("/api/validate-unlock");
    expect(serverSource).toContain("/api/stripe-webhook");
    expect(serverSource).toContain("constructEvent");
    expect(serverSource).toContain("jwt.sign");
  });

  test("vercel api routes are configured for monetization", () => {
    const publicConfigApi = readProjectFile("api/public-config.js");
    const createCheckoutApi = readProjectFile("api/create-checkout-session.js");
    const verifyUnlockApi = readProjectFile("api/verify-unlock.js");
    const validateUnlockApi = readProjectFile("api/validate-unlock.js");
    const webhookApi = readProjectFile("api/stripe-webhook.js");
    const monetizationLib = readProjectFile("lib/monetization.js");
    const httpLib = readProjectFile("lib/http.js");
    const vercelConfig = readProjectFile("vercel.json");

    expect(publicConfigApi).toContain("getPublicConfig");
    expect(createCheckoutApi).toContain("success_url");
    expect(createCheckoutApi).toContain("stripe.checkout.sessions.create");
    expect(verifyUnlockApi).toContain("stripe.checkout.sessions.retrieve");
    expect(verifyUnlockApi).toContain("signUnlockToken");
    expect(validateUnlockApi).toContain("verifyUnlockToken");
    expect(webhookApi).toContain("constructEvent");
    expect(webhookApi).toContain("stripe-signature");
    expect(monetizationLib).toContain("VERCEL_ENV");
    expect(httpLib).toContain("rateLimit");
    expect(vercelConfig).toContain("Content-Security-Policy");
  });

  test("bufferA shader still contains expected movement key bindings", () => {
    const bufferShader = readProjectFile("bufferA.glsl");
    const keyCodes = [87, 83, 68, 65, 69, 81, 39, 37, 38, 40, 88, 90, 189, 187, 16];

    for (const code of keyCodes) {
      expect(bufferShader).toMatch(new RegExp(`keyDown\\(${code}\\)`));
    }

    expect(bufferShader).toMatch(/fragColor\s*=\s*vec4\(pitch,\s*moveStep,\s*fov,\s*0\.0\)/);
  });

  test("mainImage shader reads camera state from Buffer A", () => {
    const imageShader = readProjectFile("mainImage.glsl");

    expect(imageShader).toMatch(/texelFetch\(iChannel0,\s*ivec2\(0,0\),\s*0\)/);
    expect(imageShader).toMatch(/texelFetch\(iChannel0,\s*ivec2\(1,0\),\s*0\)/);
    expect(imageShader).toMatch(/float\s+FOV\s*=\s*\(uFovOverride\s*>\s*0\.0\)\s*\?\s*uFovOverride\s*:\s*s1\.z/);
    expect(imageShader).toMatch(/void\s+mainImage\s*\(/);
  });

  test("mainImage shader exposes settings uniforms and mode logic", () => {
    const imageShader = readProjectFile("mainImage.glsl");

    expect(imageShader).toMatch(/uniform\s+float\s+uMinHit\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uEps\s*;/);
    expect(imageShader).toMatch(/uniform\s+int\s+uMode\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uMaxDist\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uGlowStrength\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uStepTint\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uExposure\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uContrast\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uSaturation\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uSunAzimuth\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uSunElevation\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uSunIntensity\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uFogDensity\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uRoughness\s*;/);
    expect(imageShader).toMatch(/uniform\s+vec3\s+uBaseColor\s*;/);
    expect(imageShader).toMatch(/uniform\s+int\s+uMaxSteps\s*;/);
    expect(imageShader).toMatch(/uniform\s+int\s+uMbIters\s*;/);
    expect(imageShader).toMatch(/uniform\s+int\s+uLowPowerMode\s*;/);
    expect(imageShader).toMatch(/uniform\s+float\s+uFovOverride\s*;/);
    expect(imageShader).toMatch(/MAX_STEPS_CAP\s*=\s*1000/);
    expect(imageShader).toMatch(/uMode\s*==\s*2/);
    expect(imageShader).toMatch(/uMode\s*==\s*3/);
    expect(imageShader).toMatch(/i\s*>=\s*uMaxSteps/);
    expect(imageShader).toMatch(/i\s*>=\s*uMbIters/);
    expect(imageShader).toMatch(/vec3\s+z\s*=\s*\(uMode\s*==\s*3\)\s*\?\s*sin\(p\)\s*:\s*p\s*;/);
    expect(imageShader).toMatch(/float\s+d\s*=\s*mapScene\(p\)\s*;/);
    expect(imageShader).toMatch(/t\s*>\s*uMaxDist/);
    expect(imageShader).toMatch(/d\s*<\s*uMinHit/);
  });

  test("main.js wires MIN_HIT and mode settings uniforms", () => {
    const source = readProjectFile("main.js");

    expect(source).toContain("uMinHit");
    expect(source).toContain("uEps");
    expect(source).toContain("uMode");
    expect(source).toContain("uMaxDist");
    expect(source).toContain("uGlowStrength");
    expect(source).toContain("uStepTint");
    expect(source).toContain("uExposure");
    expect(source).toContain("uContrast");
    expect(source).toContain("uSaturation");
    expect(source).toContain("uSunAzimuth");
    expect(source).toContain("uSunElevation");
    expect(source).toContain("uSunIntensity");
    expect(source).toContain("uFogDensity");
    expect(source).toContain("uRoughness");
    expect(source).toContain("uBaseColor");
    expect(source).toContain("visualPresetSelect");
    expect(source).toContain("VISUAL_PRESETS");
    expect(source).toContain("applyVisualPreset");
    expect(source).toContain("baseHueSlider");
    expect(source).toContain("uMaxSteps");
    expect(source).toContain("uMbIters");
    expect(source).toContain("uLowPowerMode");
    expect(source).toContain("uFovOverride");
    expect(source).toContain("minHitValue * 5.0");
    expect(source).toContain("Math.pow(10");
    expect(source).toContain("settingsButton");
    expect(source).toContain("modeValue");
    expect(source).toContain("MOVEMENT_HINT_KEYCODES");
    expect(source).toContain("TURN_HINT_KEYCODES");
    expect(source).toContain("MOBILE_DEFAULTS");
    expect(source).toContain("renderScale");
    expect(source).toContain("targetFps");
    expect(source).toContain("bindMobileControls");
    expect(source).toContain("setTouchKeyState");
    expect(source).toContain("beginPointerLook");
    expect(source).toContain("updatePointerLook");
    expect(source).toContain("canvas.addEventListener(\"pointerdown\"");
    expect(source).toContain("uLookDelta");
    expect(source).toContain("mobileFovSlider");
    expect(source).toContain("HELP_POINTER_MS");
    expect(source).toContain("dismissMovementHint");
    expect(source).toContain("dismissTurnHint");
    expect(source).toContain("showHelpPointerHint");
  });

  test("bufferA shader accepts pointer look deltas", () => {
    const bufferShader = readProjectFile("bufferA.glsl");

    expect(bufferShader).toMatch(/uniform\s+vec2\s+uLookDelta\s*;/);
    expect(bufferShader).toMatch(/yaw\s*\+=\s*yawIn\s*\*\s*lookSpeed\s*\*\s*dt\s*\+\s*uLookDelta\.x/);
    expect(bufferShader).toMatch(/pitch\s*\+=\s*pitIn\s*\*\s*lookSpeed\s*\*\s*dt\s*\+\s*uLookDelta\.y/);
  });
});
