(function runMandelbulbApp() {
  "use strict";

  const canvas = document.getElementById("glCanvas");
  const movementHint = document.getElementById("movementHint");
  const turnHint = document.getElementById("turnHint");
  const helpPointerHint = document.getElementById("helpPointerHint");
  const helpButton = document.getElementById("helpButton");
  const settingsButton = document.getElementById("settingsButton");
  const closeHelpButton = document.getElementById("closeHelpButton");
  const closeSettingsButton = document.getElementById("closeSettingsButton");
  const helpDialog = document.getElementById("helpDialog");
  const settingsDialog = document.getElementById("settingsDialog");
  const minHitSlider = document.getElementById("minHitSlider");
  const minHitValueEl = document.getElementById("minHitValue");
  const modeSelect = document.getElementById("modeSelect");
  const maxDistSlider = document.getElementById("maxDistSlider");
  const maxDistValueEl = document.getElementById("maxDistValue");
  const glowSlider = document.getElementById("glowSlider");
  const glowValueEl = document.getElementById("glowValue");
  const stepTintSlider = document.getElementById("stepTintSlider");
  const stepTintValueEl = document.getElementById("stepTintValue");
  const errorBanner = document.getElementById("errorBanner");

  if (
    !canvas ||
    !movementHint ||
    !turnHint ||
    !helpPointerHint ||
    !helpButton ||
    !settingsButton ||
    !closeHelpButton ||
    !closeSettingsButton ||
    !helpDialog ||
    !settingsDialog ||
    !minHitSlider ||
    !minHitValueEl ||
    !modeSelect ||
    !maxDistSlider ||
    !maxDistValueEl ||
    !glowSlider ||
    !glowValueEl ||
    !stepTintSlider ||
    !stepTintValueEl ||
    !errorBanner
  ) {
    return;
  }

  turnHint.hidden = true;
  helpPointerHint.hidden = true;

  const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

  const STATE_WIDTH = 2;
  const STATE_HEIGHT = 1;
  const KEYBOARD_TEX_WIDTH = 256;

  const CONTROL_KEYCODES = new Set([
    16, 37, 38, 39, 40, 65, 68, 69, 81, 83, 87, 88, 90, 187, 189,
  ]);
  const MOVEMENT_HINT_KEYCODES = new Set([87, 65, 83, 68]);
  const TURN_HINT_KEYCODES = new Set([37, 38, 39, 40]);
  const HINT_FADE_MS = 500;
  const HELP_POINTER_MS = 10000;

  const keyCodeFallback = {
    ShiftLeft: 16,
    ShiftRight: 16,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    KeyA: 65,
    KeyD: 68,
    KeyE: 69,
    KeyQ: 81,
    KeyS: 83,
    KeyW: 87,
    KeyX: 88,
    KeyZ: 90,
    Equal: 187,
    Minus: 189,
  };

  const keyState = new Uint8Array(KEYBOARD_TEX_WIDTH);
  let helpOpen = false;
  let settingsOpen = false;
  let minHitExponent = -4.0;
  let minHitValue = Math.pow(10, minHitExponent);
  let modeValue = 1;
  let maxDistValue = 30.0;
  let glowStrengthValue = 1.0;
  let stepTintValue = 1.0;
  let movementHintDismissed = false;
  let turnHintDismissed = false;
  let helpPointerTimerId = null;

  function showError(message, detail) {
    if (detail) {
      console.error(detail);
    }
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  }

  function getLegacyKeyCode(event) {
    if (typeof event.keyCode === "number" && event.keyCode > 0 && event.keyCode < KEYBOARD_TEX_WIDTH) {
      return event.keyCode;
    }
    const fallback = keyCodeFallback[event.code];
    if (typeof fallback === "number") {
      return fallback;
    }
    return null;
  }

  function clearKeys() {
    keyState.fill(0);
  }

  function openHelp() {
    dismissHelpPointerHint(true);
    settingsOpen = false;
    settingsDialog.hidden = true;
    helpOpen = true;
    clearKeys();
    helpDialog.hidden = false;
    closeHelpButton.focus();
  }

  function closeHelp() {
    helpOpen = false;
    clearKeys();
    helpDialog.hidden = true;
    helpButton.focus();
  }

  function openSettings() {
    helpOpen = false;
    helpDialog.hidden = true;
    settingsOpen = true;
    clearKeys();
    settingsDialog.hidden = false;
    minHitSlider.focus();
  }

  function closeSettings() {
    settingsOpen = false;
    clearKeys();
    settingsDialog.hidden = true;
    settingsButton.focus();
  }

  function modalIsOpen() {
    return helpOpen || settingsOpen;
  }

  function fadeOutAndHideHint(element, done) {
    element.classList.add("movement-hint--fading");
    window.setTimeout(function hideHintAfterFade() {
      element.hidden = true;
      element.classList.remove("movement-hint--fading");
      if (done) {
        done();
      }
    }, HINT_FADE_MS);
  }

  function showTurnHint() {
    if (!turnHint.hidden) {
      return;
    }

    turnHint.hidden = false;
  }

  function showHelpPointerHint() {
    if (!helpPointerHint.hidden) {
      return;
    }

    helpPointerHint.hidden = false;
    if (helpPointerTimerId !== null) {
      window.clearTimeout(helpPointerTimerId);
    }
    helpPointerTimerId = window.setTimeout(function autoHideHelpPointerHint() {
      dismissHelpPointerHint(false);
    }, HELP_POINTER_MS);
  }

  function dismissHelpPointerHint(immediate) {
    if (helpPointerHint.hidden) {
      return;
    }

    if (helpPointerTimerId !== null) {
      window.clearTimeout(helpPointerTimerId);
      helpPointerTimerId = null;
    }

    if (immediate) {
      helpPointerHint.hidden = true;
      helpPointerHint.classList.remove("movement-hint--fading");
      return;
    }

    if (helpPointerHint.classList.contains("movement-hint--fading")) {
      return;
    }

    fadeOutAndHideHint(helpPointerHint);
  }

  function dismissMovementHint() {
    if (movementHintDismissed || movementHint.hidden) {
      return;
    }

    movementHintDismissed = true;
    fadeOutAndHideHint(movementHint, showTurnHint);
  }

  function dismissTurnHint() {
    if (turnHintDismissed || turnHint.hidden) {
      return;
    }

    turnHintDismissed = true;
    fadeOutAndHideHint(turnHint, showHelpPointerHint);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatScientific(value, digits) {
    return value.toExponential(digits);
  }

  function updateMinHitFromSlider() {
    const parsed = Number(minHitSlider.value);
    if (!Number.isFinite(parsed)) {
      minHitSlider.value = String(minHitExponent);
      minHitValueEl.textContent = formatScientific(minHitValue, 2);
      return;
    }

    minHitExponent = clamp(parsed, -6.0, -2.0);
    minHitValue = Math.pow(10, minHitExponent);
    minHitValueEl.textContent = formatScientific(minHitValue, 2);
  }

  function updateMaxDistFromSlider() {
    const parsed = Number(maxDistSlider.value);
    if (!Number.isFinite(parsed)) {
      maxDistSlider.value = String(maxDistValue);
      maxDistValueEl.textContent = maxDistValue.toFixed(1);
      return;
    }

    maxDistValue = clamp(parsed, 8.0, 80.0);
    maxDistValueEl.textContent = maxDistValue.toFixed(1);
  }

  function updateGlowFromSlider() {
    const parsed = Number(glowSlider.value);
    if (!Number.isFinite(parsed)) {
      glowSlider.value = String(glowStrengthValue);
      glowValueEl.textContent = glowStrengthValue.toFixed(2);
      return;
    }

    glowStrengthValue = clamp(parsed, 0.0, 2.0);
    glowValueEl.textContent = glowStrengthValue.toFixed(2);
  }

  function updateStepTintFromSlider() {
    const parsed = Number(stepTintSlider.value);
    if (!Number.isFinite(parsed)) {
      stepTintSlider.value = String(stepTintValue);
      stepTintValueEl.textContent = stepTintValue.toFixed(2);
      return;
    }

    stepTintValue = clamp(parsed, 0.0, 1.0);
    stepTintValueEl.textContent = stepTintValue.toFixed(2);
  }

  function updateModeFromInput() {
    const parsed = Number(modeSelect.value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
      modeValue = 1;
      modeSelect.value = "1";
      return;
    }
    modeValue = parsed;
  }

  helpButton.addEventListener("click", openHelp);
  settingsButton.addEventListener("click", openSettings);
  closeHelpButton.addEventListener("click", closeHelp);
  closeSettingsButton.addEventListener("click", closeSettings);
  helpDialog.addEventListener("click", function onHelpBackdropClick(event) {
    if (event.target === helpDialog) {
      closeHelp();
    }
  });
  settingsDialog.addEventListener("click", function onSettingsBackdropClick(event) {
    if (event.target === settingsDialog) {
      closeSettings();
    }
  });

  minHitSlider.addEventListener("input", updateMinHitFromSlider);
  minHitSlider.addEventListener("change", updateMinHitFromSlider);
  modeSelect.addEventListener("change", updateModeFromInput);
  maxDistSlider.addEventListener("input", updateMaxDistFromSlider);
  maxDistSlider.addEventListener("change", updateMaxDistFromSlider);
  glowSlider.addEventListener("input", updateGlowFromSlider);
  glowSlider.addEventListener("change", updateGlowFromSlider);
  stepTintSlider.addEventListener("input", updateStepTintFromSlider);
  stepTintSlider.addEventListener("change", updateStepTintFromSlider);

  updateMinHitFromSlider();
  updateModeFromInput();
  updateMaxDistFromSlider();
  updateGlowFromSlider();
  updateStepTintFromSlider();

  window.addEventListener("keydown", function onKeyDown(event) {
    if (event.key === "Escape" && modalIsOpen()) {
      event.preventDefault();
      if (settingsOpen) {
        closeSettings();
      } else {
        closeHelp();
      }
      return;
    }

    const keyCode = getLegacyKeyCode(event);
    if (keyCode !== null && CONTROL_KEYCODES.has(keyCode)) {
      event.preventDefault();
    }

    if (modalIsOpen()) {
      return;
    }

    if (keyCode !== null && MOVEMENT_HINT_KEYCODES.has(keyCode)) {
      dismissMovementHint();
    }

    if (keyCode !== null && TURN_HINT_KEYCODES.has(keyCode)) {
      dismissTurnHint();
    }

    if (keyCode !== null) {
      keyState[keyCode] = 255;
    }
  });

  window.addEventListener("keyup", function onKeyUp(event) {
    const keyCode = getLegacyKeyCode(event);
    if (keyCode !== null) {
      keyState[keyCode] = 0;
    }
  });

  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", function onVisibilityChange() {
    if (document.hidden) {
      clearKeys();
    }
  });

  function withLineNumbers(source) {
    const lines = source.split("\n");
    return lines
      .map(function mapLine(line, index) {
        return String(index + 1).padStart(4, " ") + " | " + line;
      })
      .join("\n");
  }

  function sanitizeShadertoySource(source) {
    const lines = source.split("\n");
    const filtered = [];
    let insideGlEsBlock = false;

    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();

      if (!insideGlEsBlock && trimmed === "#ifdef GL_ES") {
        insideGlEsBlock = true;
        continue;
      }

      if (insideGlEsBlock) {
        if (trimmed === "#endif") {
          insideGlEsBlock = false;
        }
        continue;
      }

      filtered.push(lines[i]);
    }

    return filtered.join("\n");
  }

  function wrapShadertoySource(source, channelCount) {
    const channelUniforms = [];
    for (let i = 0; i < channelCount; i += 1) {
      channelUniforms.push("uniform sampler2D iChannel" + i + ";");
    }

    const cleanSource = sanitizeShadertoySource(source);

    return `#version 300 es
precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
${channelUniforms.join("\n")}
out vec4 outColor;

${cleanSource}

void main() {
  mainImage(outColor, gl_FragCoord.xy);
}
`;
  }

  function createShader(gl, type, source, label) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Could not create shader: " + label);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "No shader compiler log.";
      gl.deleteShader(shader);
      throw new Error(label + " shader compile failed\n" + log + "\n\n" + withLineNumbers(source));
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource, label) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource, label + " vertex");
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label + " fragment");

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error("Could not create program: " + label);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || "No program linker log.";
      gl.deleteProgram(program);
      throw new Error(label + " link failed\n" + log);
    }

    return program;
  }

  function createTexture(gl, internalFormat, width, height, format, type, data) {
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Could not create texture.");
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);

    return texture;
  }

  function createStateTarget(gl) {
    const texture = createTexture(
      gl,
      gl.RGBA32F,
      STATE_WIDTH,
      STATE_HEIGHT,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array(STATE_WIDTH * STATE_HEIGHT * 4)
    );

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Could not create framebuffer.");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Framebuffer is incomplete. Status: 0x" + status.toString(16));
    }

    return { texture: texture, framebuffer: framebuffer };
  }

  function getUniformBundle(gl, program, channelCount) {
    const channels = [];
    for (let i = 0; i < channelCount; i += 1) {
      channels.push(gl.getUniformLocation(program, "iChannel" + i));
    }

    return {
      iResolution: gl.getUniformLocation(program, "iResolution"),
      iTime: gl.getUniformLocation(program, "iTime"),
      iTimeDelta: gl.getUniformLocation(program, "iTimeDelta"),
      iFrame: gl.getUniformLocation(program, "iFrame"),
      uMinHit: gl.getUniformLocation(program, "uMinHit"),
      uEps: gl.getUniformLocation(program, "uEps"),
      uMode: gl.getUniformLocation(program, "uMode"),
      uMaxDist: gl.getUniformLocation(program, "uMaxDist"),
      uGlowStrength: gl.getUniformLocation(program, "uGlowStrength"),
      uStepTint: gl.getUniformLocation(program, "uStepTint"),
      channels: channels,
    };
  }

  function setUniforms(gl, bundle, width, height, time, delta, frame) {
    if (bundle.iResolution !== null) {
      gl.uniform3f(bundle.iResolution, width, height, 1.0);
    }
    if (bundle.iTime !== null) {
      gl.uniform1f(bundle.iTime, time);
    }
    if (bundle.iTimeDelta !== null) {
      gl.uniform1f(bundle.iTimeDelta, delta);
    }
    if (bundle.iFrame !== null) {
      gl.uniform1i(bundle.iFrame, frame);
    }
    if (bundle.uMinHit !== null) {
      gl.uniform1f(bundle.uMinHit, minHitValue);
    }
    if (bundle.uEps !== null) {
      gl.uniform1f(bundle.uEps, minHitValue * 5.0);
    }
    if (bundle.uMode !== null) {
      gl.uniform1i(bundle.uMode, modeValue);
    }
    if (bundle.uMaxDist !== null) {
      gl.uniform1f(bundle.uMaxDist, maxDistValue);
    }
    if (bundle.uGlowStrength !== null) {
      gl.uniform1f(bundle.uGlowStrength, glowStrengthValue);
    }
    if (bundle.uStepTint !== null) {
      gl.uniform1f(bundle.uStepTint, stepTintValue);
    }
  }

  function bindTextureAt(gl, unit, texture, uniformLocation) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (uniformLocation !== null) {
      gl.uniform1i(uniformLocation, unit);
    }
  }

  function resizeCanvasToDisplaySize(glContext, canvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    if (canvasElement.width !== width || canvasElement.height !== height) {
      canvasElement.width = width;
      canvasElement.height = height;
      glContext.viewport(0, 0, width, height);
    }
  }

  function updateKeyboardTexture(gl, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, KEYBOARD_TEX_WIDTH, 1, gl.RED, gl.UNSIGNED_BYTE, keyState);
  }

  async function loadText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load " + url + ": HTTP " + response.status);
    }
    return response.text();
  }

  async function init() {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      showError("WebGL2 is not available in this browser.");
      return;
    }

    const floatColorExt = gl.getExtension("EXT_color_buffer_float");
    if (!floatColorExt) {
      showError("This browser does not support EXT_color_buffer_float (required for Buffer A feedback).");
      return;
    }

    let rawBufferA;
    let rawMainImage;
    try {
      const shaderSources = await Promise.all([loadText("./bufferA.glsl"), loadText("./mainImage.glsl")]);
      rawBufferA = shaderSources[0];
      rawMainImage = shaderSources[1];
    } catch (error) {
      showError(
        "Could not load shader files. Run a local web server and open this page over http://localhost.",
        error
      );
      return;
    }

    const bufferFragmentSource = wrapShadertoySource(rawBufferA, 2);
    const imageFragmentSource = wrapShadertoySource(rawMainImage, 1);

    let bufferProgram;
    let imageProgram;
    try {
      bufferProgram = createProgram(gl, VERTEX_SHADER_SOURCE, bufferFragmentSource, "BufferA");
      imageProgram = createProgram(gl, VERTEX_SHADER_SOURCE, imageFragmentSource, "MainImage");
    } catch (error) {
      showError("Shader compilation failed. Open the console for details.", error);
      return;
    }

    const bufferUniforms = getUniformBundle(gl, bufferProgram, 2);
    const imageUniforms = getUniformBundle(gl, imageProgram, 1);

    const keyboardTexture = createTexture(
      gl,
      gl.R8,
      KEYBOARD_TEX_WIDTH,
      1,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array(KEYBOARD_TEX_WIDTH)
    );

    let readState;
    let writeState;
    try {
      readState = createStateTarget(gl);
      writeState = createStateTarget(gl);
    } catch (error) {
      showError("Could not initialize framebuffers for Buffer A state.", error);
      return;
    }

    const vao = gl.createVertexArray();
    if (!vao) {
      showError("Could not create rendering VAO.");
      return;
    }

    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    let frame = 0;
    let lastTime = performance.now() * 0.001;

    function render(nowMillis) {
      const now = nowMillis * 0.001;
      const delta = Math.max(1.0 / 240.0, Math.min(0.25, now - lastTime));
      lastTime = now;

      resizeCanvasToDisplaySize(gl, canvas);
      updateKeyboardTexture(gl, keyboardTexture);

      gl.useProgram(bufferProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeState.framebuffer);
      gl.viewport(0, 0, STATE_WIDTH, STATE_HEIGHT);
      setUniforms(gl, bufferUniforms, STATE_WIDTH, STATE_HEIGHT, now, delta, frame);
      bindTextureAt(gl, 0, readState.texture, bufferUniforms.channels[0]);
      bindTextureAt(gl, 1, keyboardTexture, bufferUniforms.channels[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(imageProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      setUniforms(gl, imageUniforms, canvas.width, canvas.height, now, delta, frame);
      bindTextureAt(gl, 0, writeState.texture, imageUniforms.channels[0]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const temp = readState;
      readState = writeState;
      writeState = temp;

      frame += 1;
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  init().catch(function onInitError(error) {
    showError("Unexpected startup error.", error);
  });
})();
