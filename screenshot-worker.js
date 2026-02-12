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
  } else if (type === "2f" && Array.isArray(value) && value.length === 2) {
    gl.uniform2f(location, value[0], value[1]);
  } else if (type === "3f" && Array.isArray(value) && value.length === 3) {
    gl.uniform3f(location, value[0], value[1], value[2]);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function halton(index, base) {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function computePercentileThreshold(hist, percentile, total) {
  const target = total * percentile;
  let sum = 0;
  for (let i = 0; i < hist.length; i += 1) {
    sum += hist[i];
    if (sum >= target) {
      return i / (hist.length - 1);
    }
  }
  return 1;
}

function applyAutoEnhance(rgb, width, height, denoiseStrength) {
  const pixelCount = Math.max(1, width * height);
  const hist = new Uint32Array(256);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    const y = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b, 0, 1);
    hist[Math.min(255, Math.max(0, (y * 255) | 0))] += 1;
  }

  const lowCut = computePercentileThreshold(hist, 0.003, pixelCount);
  const highCut = computePercentileThreshold(hist, 0.995, pixelCount);
  const range = Math.max(0.06, highCut - lowCut);

  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;
  const avgGray = Math.max(1e-4, (avgR + avgG + avgB) / 3);

  const gainR = clamp(avgGray / Math.max(avgR, 1e-4), 0.9, 1.12);
  const gainG = clamp(avgGray / Math.max(avgG, 1e-4), 0.9, 1.12);
  const gainB = clamp(avgGray / Math.max(avgB, 1e-4), 0.9, 1.12);

  const out = new Float32Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    let r = clamp((rgb[i] - lowCut) / range, 0, 1);
    let g = clamp((rgb[i + 1] - lowCut) / range, 0, 1);
    let b = clamp((rgb[i + 2] - lowCut) / range, 0, 1);

    r = clamp(r * gainR, 0, 1);
    g = clamp(g * gainG, 0, 1);
    b = clamp(b * gainB, 0, 1);

    r = r * r * (3 - 2 * r);
    g = g * g * (3 - 2 * g);
    b = b * b * (3 - 2 * b);

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;
    const vibrance = 0.06 + 0.2 * (1 - sat);

    out[i] = clamp(luma + (r - luma) * (1 + vibrance), 0, 1);
    out[i + 1] = clamp(luma + (g - luma) * (1 + vibrance), 0, 1);
    out[i + 2] = clamp(luma + (b - luma) * (1 + vibrance), 0, 1);
  }

  if (denoiseStrength <= 0) {
    return out;
  }

  const filtered = new Float32Array(out.length);
  const radius = 1;
  const lumaThreshold = 0.08;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const centerR = out[index];
      const centerG = out[index + 1];
      const centerB = out[index + 2];
      const centerLuma = 0.2126 * centerR + 0.7152 * centerG + 0.0722 * centerB;

      let sumR2 = 0;
      let sumG2 = 0;
      let sumB2 = 0;
      let weightSum = 0;

      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const sx = clamp(x + ox, 0, width - 1);
          const sy = clamp(y + oy, 0, height - 1);
          const si = (sy * width + sx) * 3;
          const sr = out[si];
          const sg = out[si + 1];
          const sb = out[si + 2];
          const sl = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
          const lumaDiff = Math.abs(sl - centerLuma);
          const w = lumaDiff < lumaThreshold ? 1.0 : 0.15;

          sumR2 += sr * w;
          sumG2 += sg * w;
          sumB2 += sb * w;
          weightSum += w;
        }
      }

      const blurR = sumR2 / weightSum;
      const blurG = sumG2 / weightSum;
      const blurB = sumB2 / weightSum;
      filtered[index] = centerR + (blurR - centerR) * denoiseStrength;
      filtered[index + 1] = centerG + (blurG - centerG) * denoiseStrength;
      filtered[index + 2] = centerB + (blurB - centerB) * denoiseStrength;
    }
  }

  return filtered;
}

function floatRgbToImageData(rgb, width, height) {
  const imageData = new ImageData(width, height);
  const out = imageData.data;
  for (let y = 0; y < height; y += 1) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const srcIndex = (srcY * width + x) * 3;
      const dstIndex = (y * width + x) * 4;
      out[dstIndex] = Math.round(clamp(rgb[srcIndex], 0, 1) * 255);
      out[dstIndex + 1] = Math.round(clamp(rgb[srcIndex + 1], 0, 1) * 255);
      out[dstIndex + 2] = Math.round(clamp(rgb[srcIndex + 2], 0, 1) * 255);
      out[dstIndex + 3] = 255;
    }
  }
  return imageData;
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
    const screenshotOptions = payload.screenshotOptions || {};
    const sampleCount = Math.max(1, Math.min(32, Math.round(screenshotOptions.samples || 1)));
    const autoEnhance = screenshotOptions.autoEnhance !== false;
    const denoiseStrength = clamp(Number(screenshotOptions.denoiseStrength) || 0, 0, 0.45);

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
    setUniform(gl, gl.getUniformLocation(program, "uExposure"), "1f", uniforms.uExposure);
    setUniform(gl, gl.getUniformLocation(program, "uContrast"), "1f", uniforms.uContrast);
    setUniform(gl, gl.getUniformLocation(program, "uSaturation"), "1f", uniforms.uSaturation);
    setUniform(gl, gl.getUniformLocation(program, "uSunAzimuth"), "1f", uniforms.uSunAzimuth);
    setUniform(gl, gl.getUniformLocation(program, "uSunElevation"), "1f", uniforms.uSunElevation);
    setUniform(gl, gl.getUniformLocation(program, "uSunIntensity"), "1f", uniforms.uSunIntensity);
    setUniform(gl, gl.getUniformLocation(program, "uFogDensity"), "1f", uniforms.uFogDensity);
    setUniform(gl, gl.getUniformLocation(program, "uRoughness"), "1f", uniforms.uRoughness);
    setUniform(gl, gl.getUniformLocation(program, "uBaseColor"), "3f", uniforms.uBaseColor);
    setUniform(gl, gl.getUniformLocation(program, "uSecondaryColor"), "3f", uniforms.uSecondaryColor);
    setUniform(gl, gl.getUniformLocation(program, "uMaxSteps"), "1i", uniforms.uMaxSteps);
    setUniform(gl, gl.getUniformLocation(program, "uMbIters"), "1i", uniforms.uMbIters);
    setUniform(gl, gl.getUniformLocation(program, "uLowPowerMode"), "1i", uniforms.uLowPowerMode);
    setUniform(gl, gl.getUniformLocation(program, "uFovOverride"), "1f", uniforms.uFovOverride);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexture);
    setUniform(gl, gl.getUniformLocation(program, "iChannel0"), "1i", 0);

    const rgbaBytes = new Uint8Array(width * height * 4);
    const accumRgb = new Float32Array(width * height * 3);
    const baseJitter = Array.isArray(uniforms.uScreenshotJitter) && uniforms.uScreenshotJitter.length === 2
      ? uniforms.uScreenshotJitter
      : [0, 0];

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const jitterX = (halton(sampleIndex + 1, 2) - 0.5) + baseJitter[0];
      const jitterY = (halton(sampleIndex + 1, 3) - 0.5) + baseJitter[1];
      setUniform(gl, gl.getUniformLocation(program, "uScreenshotJitter"), "2f", [jitterX, jitterY]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgbaBytes);

      for (let i = 0, j = 0; i < rgbaBytes.length; i += 4, j += 3) {
        accumRgb[j] += rgbaBytes[i] / 255;
        accumRgb[j + 1] += rgbaBytes[i + 1] / 255;
        accumRgb[j + 2] += rgbaBytes[i + 2] / 255;
      }
    }

    const sampleNorm = 1 / sampleCount;
    for (let i = 0; i < accumRgb.length; i += 1) {
      accumRgb[i] *= sampleNorm;
    }

    const gradedRgb = autoEnhance ? applyAutoEnhance(accumRgb, width, height, denoiseStrength) : accumRgb;

    const colorCanvas = new OffscreenCanvas(width, height);
    const colorCtx = colorCanvas.getContext("2d");
    if (!colorCtx) {
      throw new Error("2D context unavailable for screenshot post-processing.");
    }
    const imageData = floatRgbToImageData(gradedRgb, width, height);
    colorCtx.putImageData(imageData, 0, 0);

    const outputCanvas = await addWatermarkIfNeeded(colorCanvas, payload.watermarkText || "");
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
