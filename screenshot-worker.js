const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

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

function wrapShadertoySource(source) {
  const cleanSource = sanitizeShadertoySource(source);
  return `#version 300 es
precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform sampler2D iChannel0;

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
    const log = gl.getShaderInfoLog(shader) || "No shader compile log.";
    gl.deleteShader(shader);
    throw new Error(label + " compile failed\n" + log + "\n\n" + withLineNumbers(source));
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource, "screenshot vertex");
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, "screenshot fragment");

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Could not create screenshot program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "No program link log.";
    gl.deleteProgram(program);
    throw new Error("Screenshot program link failed\n" + log);
  }

  return program;
}

function setUniform(gl, location, type, value) {
  if (location === null || location === undefined) {
    return;
  }

  if (type === "1f") {
    gl.uniform1f(location, value);
  } else if (type === "1i") {
    gl.uniform1i(location, value);
  }
}

async function addWatermarkIfNeeded(canvas, text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return canvas;
  }

  const overlay = new OffscreenCanvas(canvas.width, canvas.height);
  const ctx = overlay.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.drawImage(canvas, 0, 0);

  const margin = Math.max(12, Math.round(canvas.height * 0.018));
  const fontSize = Math.max(16, Math.round(canvas.height * 0.03));
  ctx.font = "600 " + fontSize + "px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = canvas.width * 0.5;
  const y = canvas.height * 0.5;

  ctx.fillStyle = "rgba(235, 248, 255, 0.5)";
  ctx.fillText(text, x, y);

  return overlay;
}

self.onmessage = async function onMessage(event) {
  try {
    const payload = event.data;
    if (!payload || !payload.mainImageSource) {
      throw new Error("Missing screenshot payload.");
    }

    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas is not supported in this browser.");
    }

    const width = Math.max(1, payload.width | 0);
    const height = Math.max(1, payload.height | 0);
    const canvas = new OffscreenCanvas(width, height);
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      throw new Error("WebGL2 is not available in worker context.");
    }

    const floatExt = gl.getExtension("EXT_color_buffer_float");
    if (!floatExt) {
      throw new Error("EXT_color_buffer_float is unavailable for screenshot worker.");
    }

    const fragmentSource = wrapShadertoySource(payload.mainImageSource);
    const program = createProgram(gl, VERTEX_SHADER_SOURCE, fragmentSource);

    const statePixels = new Float32Array(payload.stateBuffer);
    const stateTexture = gl.createTexture();
    if (!stateTexture) {
      throw new Error("Could not allocate state texture in screenshot worker.");
    }
    gl.bindTexture(gl.TEXTURE_2D, stateTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2, 1, 0, gl.RGBA, gl.FLOAT, statePixels);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error("Could not allocate VAO in screenshot worker.");
    }
    gl.bindVertexArray(vao);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

    const uniforms = payload.uniforms || {};
    setUniform(gl, gl.getUniformLocation(program, "iTime"), "1f", uniforms.iTime || 0.0);
    setUniform(gl, gl.getUniformLocation(program, "iTimeDelta"), "1f", uniforms.iTimeDelta || 1.0 / 60.0);
    setUniform(gl, gl.getUniformLocation(program, "iFrame"), "1i", uniforms.iFrame || 0);
    const iResolution = gl.getUniformLocation(program, "iResolution");
    if (iResolution !== null) {
      gl.uniform3f(iResolution, width, height, 1.0);
    }

    setUniform(gl, gl.getUniformLocation(program, "uMinHit"), "1f", uniforms.uMinHit);
    setUniform(gl, gl.getUniformLocation(program, "uEps"), "1f", uniforms.uEps);
    setUniform(gl, gl.getUniformLocation(program, "uMode"), "1i", uniforms.uMode);
    setUniform(gl, gl.getUniformLocation(program, "uMaxDist"), "1f", uniforms.uMaxDist);
    setUniform(gl, gl.getUniformLocation(program, "uGlowStrength"), "1f", uniforms.uGlowStrength);
    setUniform(gl, gl.getUniformLocation(program, "uStepTint"), "1f", uniforms.uStepTint);
    setUniform(gl, gl.getUniformLocation(program, "uMaxSteps"), "1i", uniforms.uMaxSteps);
    setUniform(gl, gl.getUniformLocation(program, "uMbIters"), "1i", uniforms.uMbIters);
    setUniform(gl, gl.getUniformLocation(program, "uLowPowerMode"), "1i", uniforms.uLowPowerMode);
    setUniform(gl, gl.getUniformLocation(program, "uFovOverride"), "1f", uniforms.uFovOverride);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexture);
    setUniform(gl, gl.getUniformLocation(program, "iChannel0"), "1i", 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();

    const outputCanvas = await addWatermarkIfNeeded(canvas, payload.watermarkText || "");
    const blob = await outputCanvas.convertToBlob({ type: "image/png" });
    const blobBuffer = await blob.arrayBuffer();

    self.postMessage(
      {
        ok: true,
        blobBuffer: blobBuffer,
        fileName: payload.fileName,
      },
      [blobBuffer]
    );
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
