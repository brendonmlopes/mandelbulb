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
    expect(html).toMatch(/id=["']helpButton["']/i);
    expect(html).toMatch(/id=["']helpDialog["']/i);
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
});
