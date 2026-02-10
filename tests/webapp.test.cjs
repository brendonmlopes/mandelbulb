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
      "style.css",
      "main.js",
      "bufferA.glsl",
      "mainImage.glsl",
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
    expect(html).toMatch(/id=["']movementHint["']/i);
    expect(html).toMatch(/id=["']movementHintTitle["']/i);
    expect(html).toMatch(/Use\s+WASD\s+to\s+move/i);
    expect(html).toMatch(/id=["']turnHint["']/i);
    expect(html).toMatch(/id=["']turnHintTitle["']/i);
    expect(html).toMatch(/Use\s+Arrow\s+Keys\s+to\s+turn/i);
    expect(html).toMatch(/id=["']helpPointerHint["']/i);
    expect(html).toMatch(/id=["']mobileControls["']/i);
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
    expect(html).toMatch(/id=["']minHitSlider["']/i);
    expect(html).toMatch(/id=["']minHitValue["']/i);
    expect(html).toMatch(/id=["']modeSelect["']/i);
    expect(html).toMatch(/id=["']maxDistSlider["']/i);
    expect(html).toMatch(/id=["']glowSlider["']/i);
    expect(html).toMatch(/id=["']stepTintSlider["']/i);
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

  test("main.js wires Shadertoy-like two-pass pipeline", () => {
    const source = readProjectFile("main.js");

    expect(source).toContain("EXT_color_buffer_float");
    expect(source).toContain("wrapShadertoySource");
    expect(source).toContain("loadText(\"./bufferA.glsl\")");
    expect(source).toContain("loadText(\"./mainImage.glsl\")");
    expect(source).toContain("STATE_WIDTH");
    expect(source).toContain("KEYBOARD_TEX_WIDTH");
    expect(source).toContain("detectMobileClient");
    expect(source).toContain("devicePixelRatioCap");
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
    expect(imageShader).toMatch(/float\s+FOV\s*=\s*s1\.z/);
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
    expect(imageShader).toMatch(/uMode\s*==\s*2/);
    expect(imageShader).toMatch(/uMode\s*==\s*3/);
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
    expect(source).toContain("minHitValue * 5.0");
    expect(source).toContain("Math.pow(10");
    expect(source).toContain("settingsButton");
    expect(source).toContain("modeValue");
    expect(source).toContain("MOVEMENT_HINT_KEYCODES");
    expect(source).toContain("TURN_HINT_KEYCODES");
    expect(source).toContain("MOBILE_DEFAULTS");
    expect(source).toContain("bindMobileControls");
    expect(source).toContain("setTouchKeyState");
    expect(source).toContain("HELP_POINTER_MS");
    expect(source).toContain("dismissMovementHint");
    expect(source).toContain("dismissTurnHint");
    expect(source).toContain("showHelpPointerHint");
  });
});
