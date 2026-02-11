(function runMandelbulbApp() {
  "use strict";

  const canvas = document.getElementById("glCanvas");
  const movementHint = document.getElementById("movementHint");
  const movementHintTitle = document.getElementById("movementHintTitle");
  const turnHint = document.getElementById("turnHint");
  const turnHintTitle = document.getElementById("turnHintTitle");
  const helpPointerHint = document.getElementById("helpPointerHint");
  const helpButton = document.getElementById("helpButton");
  const settingsButton = document.getElementById("settingsButton");
  const closeHelpButton = document.getElementById("closeHelpButton");
  const closeSettingsButton = document.getElementById("closeSettingsButton");
  const closePaywallButton = document.getElementById("closePaywallButton");
  const helpDialog = document.getElementById("helpDialog");
  const helpDesktopContent = document.getElementById("helpDesktopContent");
  const helpMobileContent = document.getElementById("helpMobileContent");
  const settingsDialog = document.getElementById("settingsDialog");
  const paywallDialog = document.getElementById("paywallDialog");
  const checkoutPremiumButton = document.getElementById("checkoutPremiumButton");
  const unlockPremiumButton = document.getElementById("unlockPremiumButton");
  const premiumStatusText = document.getElementById("premiumStatusText");
  const premiumPresetSelect = document.getElementById("premiumPresetSelect");
  const mobileControls = document.getElementById("mobileControls");
  const mobileFovControl = document.getElementById("mobileFovControl");
  const mobileFovSlider = document.getElementById("mobileFovSlider");
  const mobileFovValue = document.getElementById("mobileFovValue");
  const screenshotButton = document.getElementById("screenshotButton");
  const minHitSlider = document.getElementById("minHitSlider");
  const minHitValueEl = document.getElementById("minHitValue");
  const modeSelect = document.getElementById("modeSelect");
  const maxDistSlider = document.getElementById("maxDistSlider");
  const maxDistValueEl = document.getElementById("maxDistValue");
  const glowSlider = document.getElementById("glowSlider");
  const glowValueEl = document.getElementById("glowValue");
  const stepTintSlider = document.getElementById("stepTintSlider");
  const stepTintValueEl = document.getElementById("stepTintValue");
  const visualPresetSelect = document.getElementById("visualPresetSelect");
  const exposureSlider = document.getElementById("exposureSlider");
  const exposureValueEl = document.getElementById("exposureValue");
  const contrastSlider = document.getElementById("contrastSlider");
  const contrastValueEl = document.getElementById("contrastValue");
  const saturationSlider = document.getElementById("saturationSlider");
  const saturationValueEl = document.getElementById("saturationValue");
  const sunAzimuthSlider = document.getElementById("sunAzimuthSlider");
  const sunAzimuthValueEl = document.getElementById("sunAzimuthValue");
  const sunElevationSlider = document.getElementById("sunElevationSlider");
  const sunElevationValueEl = document.getElementById("sunElevationValue");
  const sunIntensitySlider = document.getElementById("sunIntensitySlider");
  const sunIntensityValueEl = document.getElementById("sunIntensityValue");
  const fogDensitySlider = document.getElementById("fogDensitySlider");
  const fogDensityValueEl = document.getElementById("fogDensityValue");
  const roughnessSlider = document.getElementById("roughnessSlider");
  const roughnessValueEl = document.getElementById("roughnessValue");
  const baseHueSlider = document.getElementById("baseHueSlider");
  const baseColorValueEl = document.getElementById("baseColorValue");
  const adContainer = document.getElementById("adContainer");
  const adSlot = document.getElementById("adSlot");
  const mobileKeyButtons = Array.from(document.querySelectorAll("[data-touch-keycode]"));
  const errorBanner = document.getElementById("errorBanner");

  if (
    !canvas ||
    !movementHint ||
    !movementHintTitle ||
    !turnHint ||
    !turnHintTitle ||
    !helpPointerHint ||
    !helpButton ||
    !settingsButton ||
    !closeHelpButton ||
    !closeSettingsButton ||
    !closePaywallButton ||
    !helpDialog ||
    !helpDesktopContent ||
    !helpMobileContent ||
    !settingsDialog ||
    !paywallDialog ||
    !checkoutPremiumButton ||
    !unlockPremiumButton ||
    !premiumStatusText ||
    !premiumPresetSelect ||
    !mobileControls ||
    !mobileFovControl ||
    !mobileFovSlider ||
    !mobileFovValue ||
    !screenshotButton ||
    !minHitSlider ||
    !minHitValueEl ||
    !modeSelect ||
    !maxDistSlider ||
    !maxDistValueEl ||
    !glowSlider ||
    !glowValueEl ||
    !stepTintSlider ||
    !stepTintValueEl ||
    !visualPresetSelect ||
    !exposureSlider ||
    !exposureValueEl ||
    !contrastSlider ||
    !contrastValueEl ||
    !saturationSlider ||
    !saturationValueEl ||
    !sunAzimuthSlider ||
    !sunAzimuthValueEl ||
    !sunElevationSlider ||
    !sunElevationValueEl ||
    !sunIntensitySlider ||
    !sunIntensityValueEl ||
    !fogDensitySlider ||
    !fogDensityValueEl ||
    !roughnessSlider ||
    !roughnessValueEl ||
    !baseHueSlider ||
    !baseColorValueEl ||
    !adContainer ||
    !adSlot ||
    mobileKeyButtons.length === 0 ||
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

  function detectMobileClient() {
    const ua = navigator.userAgent || "";
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && coarse);
  }

  const isMobileClient = detectMobileClient();
  const devicePixelRatioCap = isMobileClient ? 1.0 : 2.0;

  const CONTROL_KEYCODES = new Set([
    16, 37, 38, 39, 40, 65, 68, 69, 81, 83, 87, 88, 90, 187, 189,
  ]);
  const MOVEMENT_HINT_KEYCODES = new Set([87, 65, 83, 68]);
  const TURN_HINT_KEYCODES = new Set([37, 38, 39, 40]);
  const HINT_FADE_MS = 500;
  const HELP_POINTER_MS = 10000;
  const BASE_COLOR_SATURATION = 0.82;
  const BASE_COLOR_VALUE = 1.0;
  const MIN_HIT_EXP_MIN = -6.0;
  const MIN_HIT_EXP_MAX = -2.0;
  const MIN_HIT_SLIDER_MIN = 0.0;
  const MIN_HIT_SLIDER_MAX = 10.0;
  const LOOK_SENSITIVITY_DESKTOP = 0.003;
  const LOOK_SENSITIVITY_MOBILE = 0.0045;
  const PREMIUM_UNLOCK_TOKEN_KEY = "mandelbulb_premium_unlock_token";
  const PREMIUM_PRESET_KEY = "mandelbulb_premium_preset";
  const CHECKOUT_SUCCESS_KEY = "checkout";
  const CHECKOUT_SESSION_ID_KEY = "session_id";
  const VISUAL_PRESET_KEY = "mandelbulb_visual_preset";
  const VISUAL_PRESETS = {
    vibrant: {
      glowStrength: 0.05,
      stepTint: 0.62,
      baseColorHex: "#2d75ff",
      exposure: 0.22,
      contrast: 1.14,
      saturation: 1.33,
      sunAzimuthDegrees: 30.0,
      sunElevationDegrees: 26.0,
      sunIntensity: 1.28,
      fogDensity: 0.023,
      roughness: 0.3,
    },
    cinematic: {
      glowStrength: 0.02,
      stepTint: 0.38,
      baseColorHex: "#4f66b9",
      exposure: 0.0,
      contrast: 1.2,
      saturation: 1.06,
      sunAzimuthDegrees: 16.0,
      sunElevationDegrees: 18.0,
      sunIntensity: 1.06,
      fogDensity: 0.03,
      roughness: 0.4,
    },
    neon: {
      glowStrength: 0.32,
      stepTint: 0.76,
      baseColorHex: "#17d5ff",
      exposure: 0.3,
      contrast: 1.1,
      saturation: 1.55,
      sunAzimuthDegrees: 44.0,
      sunElevationDegrees: 32.0,
      sunIntensity: 1.42,
      fogDensity: 0.018,
      roughness: 0.22,
    },
    solar: {
      glowStrength: 0.25,
      stepTint: 0.5,
      baseColorHex: "#ff6f3c",
      exposure: 0.15,
      contrast: 1.09,
      saturation: 1.25,
      sunAzimuthDegrees: -28.0,
      sunElevationDegrees: 38.0,
      sunIntensity: 1.45,
      fogDensity: 0.026,
      roughness: 0.36,
    },
  };
  const PREMIUM_PROFILES = {
    balanced: {
      desktop: { minHit: 7e-6, maxDist: 220.0, maxSteps: 520, mbIters: 20 },
      mobile: { minHit: 2e-5, maxDist: 120.0, maxSteps: 320, mbIters: 14 },
    },
    ultra: {
      desktop: { minHit: 1e-6, maxDist: 1000.0, maxSteps: 1000, mbIters: 24 },
      mobile: { minHit: 1.2e-5, maxDist: 240.0, maxSteps: 420, mbIters: 16 },
    },
  };
  const WATERMARK_TEXT = "3dfractal.xyz";
  const MOBILE_DEFAULTS = {
    minHitExponent: -2.4,
    maxDist: 10.0,
    glowStrength: 0.2,
    stepTint: 0.65,
    exposure: 0.08,
    contrast: 1.03,
    saturation: 1.15,
    sunAzimuthDegrees: 24.0,
    sunElevationDegrees: 22.0,
    sunIntensity: 1.12,
    fogDensity: 0.03,
    roughness: 0.44,
    baseColorHex: "#3386FF",
    maxSteps: 96,
    mbIters: 10,
    renderScale: 0.66,
    targetFps: 30,
  };

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

  const keyboardState = new Uint8Array(KEYBOARD_TEX_WIDTH);
  const touchState = new Uint8Array(KEYBOARD_TEX_WIDTH);
  const keyState = new Uint8Array(KEYBOARD_TEX_WIDTH);
  const touchPressCount = new Uint8Array(KEYBOARD_TEX_WIDTH);
  const pointerToKeyCode = new Map();
  let helpOpen = false;
  let settingsOpen = false;
  let minHitExponent = -3.5;
  let minHitValue = Math.pow(10, minHitExponent);
  let modeValue = 1;
  let maxDistValue = 30.0;
  let glowStrengthValue = 0.05;
  let stepTintValue = 0.62;
  let exposureValue = 0.22;
  let contrastValue = 1.14;
  let saturationValue = 1.33;
  let sunAzimuthDegrees = 32.0;
  let sunElevationDegrees = 26.0;
  let sunIntensityValue = 1.28;
  let fogDensityValue = 0.023;
  let roughnessValue = 0.3;
  let baseColorHueDegrees = 220.0;
  let baseColorHex = "#2D75FF";
  let baseColorRgb = [45 / 255, 117 / 255, 1.0];
  let maxStepsValue = 300;
  let mbItersValue = 20;
  let lowPowerModeValue = 0;
  let renderScaleValue = 1.0;
  let targetFrameDelta = 0.0;
  let fovOverrideValue = -1.0;
  let movementHintDismissed = false;
  let turnHintDismissed = false;
  let helpPointerTimerId = null;
  let screenshotInProgress = false;
  let paywallOpen = false;
  let isPremiumUnlocked = false;
  let unlockToken = "";
  let publicConfig = {
    paymentsEnabled: false,
    adsEnabled: false,
    adsenseClientId: "",
    adsenseSlotId: "",
    priceLabel: "$3.99",
  };
  let adsScriptLoaded = false;
  let adsInitialized = false;
  let isPointerLooking = false;
  let activeLookPointerId = null;
  let lastLookClientX = 0;
  let lastLookClientY = 0;
  let pendingLookYawDelta = 0.0;
  let pendingLookPitchDelta = 0.0;

  function showError(message, detail) {
    if (detail) {
      console.error(detail);
    }
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  }

  function setScreenshotBusy(isBusy) {
    screenshotInProgress = isBusy;
    screenshotButton.disabled = isBusy;
    screenshotButton.setAttribute(
      "aria-label",
      isBusy ? "Rendering screenshot" : "Capture screenshot"
    );
    updateAdVisibility();
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function revokeScreenshotUrl() {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function getScreenshotDimensions() {
    return {
      width: Math.max(1, canvas.width),
      height: Math.max(1, canvas.height),
    };
  }

  function getSelectedPremiumPreset() {
    const value = premiumPresetSelect.value;
    if (value === "ultra") {
      return "ultra";
    }
    return "balanced";
  }

  function openPaywall() {
    if (!publicConfig.paymentsEnabled) {
      return;
    }

    helpOpen = false;
    settingsOpen = false;
    helpDialog.hidden = true;
    settingsDialog.hidden = true;
    paywallOpen = true;
    clearKeys();
    checkoutPremiumButton.disabled = false;
    checkoutPremiumButton.textContent = "Unlock for " + publicConfig.priceLabel;
    paywallDialog.hidden = false;
    checkoutPremiumButton.focus();
    updateAdVisibility();
  }

  function closePaywall() {
    paywallOpen = false;
    clearKeys();
    paywallDialog.hidden = true;
    unlockPremiumButton.focus();
    updateAdVisibility();
  }

  function isAnyModalOpen() {
    return helpOpen || settingsOpen || paywallOpen;
  }

  function setPremiumUnlocked(unlocked) {
    isPremiumUnlocked = !!unlocked;
    premiumPresetSelect.disabled = !isPremiumUnlocked;

    if (isPremiumUnlocked) {
      paywallOpen = false;
      paywallDialog.hidden = true;
      premiumStatusText.textContent = "Premium export unlocked. No watermark and ads removed.";
      unlockPremiumButton.textContent = "Premium Unlocked";
      unlockPremiumButton.disabled = true;
      adContainer.hidden = true;
    } else {
      premiumStatusText.textContent = "Premium export is locked.";
      unlockPremiumButton.textContent = "Unlock Premium Export";
      unlockPremiumButton.disabled = false;
      updateAdVisibility();
    }
  }

  function shouldShowAdContainer() {
    if (!publicConfig.adsEnabled) {
      return false;
    }
    if (isPremiumUnlocked) {
      return false;
    }
    if (!adsScriptLoaded || !adsInitialized) {
      return false;
    }
    if (screenshotInProgress || isAnyModalOpen()) {
      return false;
    }
    return true;
  }

  function getCurrentPathWithHash() {
    return window.location.pathname + window.location.hash;
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });

    const payload = await response.json().catch(function parseError() {
      return {};
    });

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : "Request failed.";
      throw new Error(message);
    }

    return payload;
  }

  function removeCheckoutParamsFromUrl() {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete(CHECKOUT_SUCCESS_KEY);
    currentUrl.searchParams.delete(CHECKOUT_SESSION_ID_KEY);
    window.history.replaceState({}, "", currentUrl.toString());
  }

  async function loadPublicConfig() {
    try {
      const response = await fetch("/api/public-config", { credentials: "same-origin" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      publicConfig = Object.assign(publicConfig, payload);
    } catch (_error) {
      // Keep safe defaults when API is unavailable.
    }
  }

  async function validateStoredUnlockToken() {
    const storedToken = localStorage.getItem(PREMIUM_UNLOCK_TOKEN_KEY);
    if (!storedToken) {
      setPremiumUnlocked(false);
      return;
    }

    try {
      const payload = await postJson("/api/validate-unlock", { token: storedToken });
      if (payload && payload.valid) {
        unlockToken = storedToken;
        setPremiumUnlocked(true);
        return;
      }
    } catch (_error) {
      // Ignore and fallback to locked mode.
    }

    localStorage.removeItem(PREMIUM_UNLOCK_TOKEN_KEY);
    unlockToken = "";
    setPremiumUnlocked(false);
  }

  async function tryCompleteCheckoutFromUrl() {
    const url = new URL(window.location.href);
    if (url.searchParams.get(CHECKOUT_SUCCESS_KEY) !== "success") {
      return;
    }

    const sessionId = url.searchParams.get(CHECKOUT_SESSION_ID_KEY);
    if (!sessionId) {
      removeCheckoutParamsFromUrl();
      return;
    }

    try {
      const payload = await postJson("/api/verify-unlock", { sessionId: sessionId });
      if (payload && payload.unlocked && typeof payload.token === "string") {
        unlockToken = payload.token;
        localStorage.setItem(PREMIUM_UNLOCK_TOKEN_KEY, payload.token);
        setPremiumUnlocked(true);
      }
    } catch (error) {
      showError("Could not complete premium unlock after checkout.", error);
    } finally {
      removeCheckoutParamsFromUrl();
    }
  }

  function markInteractionForAds() {
    if (!publicConfig.adsEnabled || isPremiumUnlocked || adsScriptLoaded) {
      return;
    }

    if (!publicConfig.adsenseClientId || !publicConfig.adsenseSlotId) {
      return;
    }

    adsScriptLoaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(publicConfig.adsenseClientId);
    script.onload = function onAdsLoad() {
      if (isPremiumUnlocked || !publicConfig.adsEnabled) {
        return;
      }
      adSlot.setAttribute("data-ad-client", publicConfig.adsenseClientId);
      adSlot.setAttribute("data-ad-slot", publicConfig.adsenseSlotId);
      adSlot.setAttribute("data-ad-format", "horizontal");
      adSlot.setAttribute("data-full-width-responsive", "true");
      if (!adsInitialized) {
        adsInitialized = true;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      }
      updateAdVisibility();
    };
    document.head.appendChild(script);
  }

  function updateAdVisibility() {
    adContainer.hidden = !shouldShowAdContainer();
  }

  function getPremiumScreenshotProfile() {
    const preset = getSelectedPremiumPreset();
    const deviceProfile = isMobileClient ? PREMIUM_PROFILES[preset].mobile : PREMIUM_PROFILES[preset].desktop;
    return {
      uMinHit: deviceProfile.minHit,
      uEps: deviceProfile.minHit * 5.0,
      uMaxDist: deviceProfile.maxDist,
      uMaxSteps: deviceProfile.maxSteps,
      uMbIters: deviceProfile.mbIters,
      uLowPowerMode: 0,
    };
  }

  function suppressLongPressUi(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLOptionElement) {
      return;
    }
    event.preventDefault();
  }

  function getLegacyKeyCode(event) {
    const fallback = keyCodeFallback[event.code];
    if (typeof fallback === "number") {
      return fallback;
    }
    if (typeof event.keyCode === "number" && event.keyCode > 0 && event.keyCode < KEYBOARD_TEX_WIDTH) {
      return event.keyCode;
    }
    return null;
  }

  function syncKeyState() {
    for (let i = 0; i < KEYBOARD_TEX_WIDTH; i += 1) {
      keyState[i] = keyboardState[i] || touchState[i] ? 255 : 0;
    }
  }

  function clearPointerLook() {
    isPointerLooking = false;
    activeLookPointerId = null;
    lastLookClientX = 0;
    lastLookClientY = 0;
    pendingLookYawDelta = 0.0;
    pendingLookPitchDelta = 0.0;
    document.body.classList.remove("pointer-look-active");
  }

  function clearKeys() {
    keyboardState.fill(0);
    touchState.fill(0);
    touchPressCount.fill(0);
    pointerToKeyCode.clear();
    syncKeyState();
    clearPointerLook();
  }

  function beginPointerLook(event) {
    if (isAnyModalOpen()) {
      return;
    }

    if (activeLookPointerId !== null) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    activeLookPointerId = event.pointerId;
    isPointerLooking = true;
    lastLookClientX = event.clientX;
    lastLookClientY = event.clientY;
    if (!isMobileClient) {
      document.body.classList.add("pointer-look-active");
    }
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    dismissTurnHint();
    markInteractionForAds();
  }

  function updatePointerLook(event) {
    if (!isPointerLooking || event.pointerId !== activeLookPointerId || isAnyModalOpen()) {
      return;
    }

    const deltaX = event.clientX - lastLookClientX;
    const deltaY = event.clientY - lastLookClientY;
    lastLookClientX = event.clientX;
    lastLookClientY = event.clientY;

    const sensitivity = isMobileClient ? LOOK_SENSITIVITY_MOBILE : LOOK_SENSITIVITY_DESKTOP;
    pendingLookYawDelta += deltaX * sensitivity;
    pendingLookPitchDelta += -deltaY * sensitivity;
    dismissTurnHint();
  }

  function endPointerLook(pointerId) {
    if (pointerId !== activeLookPointerId) {
      return;
    }

    isPointerLooking = false;
    activeLookPointerId = null;
    if (!isMobileClient) {
      document.body.classList.remove("pointer-look-active");
    }
  }

  function applyMobileProfile() {
    if (!isMobileClient) {
      mobileControls.hidden = true;
      helpDesktopContent.hidden = false;
      helpMobileContent.hidden = true;
      movementHint.hidden = false;
      turnHint.hidden = true;
      helpPointerHint.hidden = true;
      movementHintDismissed = false;
      turnHintDismissed = false;
      movementHintTitle.textContent = "Use WASD to move";
      turnHintTitle.textContent = "Use arrows to turn";
      mobileFovControl.hidden = true;
      fovOverrideValue = -1.0;
      maxStepsValue = 300;
      mbItersValue = 20;
      lowPowerModeValue = 0;
      renderScaleValue = 1.0;
      targetFrameDelta = 0.0;
      return;
    }

    document.body.classList.add("mobile-device");
    mobileControls.hidden = false;
    helpDesktopContent.hidden = true;
    helpMobileContent.hidden = false;
    movementHint.hidden = true;
    turnHint.hidden = true;
    helpPointerHint.hidden = true;
    movementHintDismissed = true;
    turnHintDismissed = true;
    movementHint.classList.remove("movement-hint--fading");
    turnHint.classList.remove("movement-hint--fading");
    helpPointerHint.classList.remove("movement-hint--fading");
    if (helpPointerTimerId !== null) {
      window.clearTimeout(helpPointerTimerId);
      helpPointerTimerId = null;
    }
    movementHintTitle.textContent = "Use left pad to move";
    turnHintTitle.textContent = "Use right pad to turn";
    mobileFovControl.hidden = false;
    fovOverrideValue = Number(mobileFovSlider.value) || 0.6;

    minHitExponent = MOBILE_DEFAULTS.minHitExponent;
    maxDistValue = MOBILE_DEFAULTS.maxDist;
    glowStrengthValue = MOBILE_DEFAULTS.glowStrength;
    stepTintValue = MOBILE_DEFAULTS.stepTint;
    exposureValue = MOBILE_DEFAULTS.exposure;
    contrastValue = MOBILE_DEFAULTS.contrast;
    saturationValue = MOBILE_DEFAULTS.saturation;
    sunAzimuthDegrees = MOBILE_DEFAULTS.sunAzimuthDegrees;
    sunElevationDegrees = MOBILE_DEFAULTS.sunElevationDegrees;
    sunIntensityValue = MOBILE_DEFAULTS.sunIntensity;
    fogDensityValue = MOBILE_DEFAULTS.fogDensity;
    roughnessValue = MOBILE_DEFAULTS.roughness;
    baseColorHex = MOBILE_DEFAULTS.baseColorHex.toUpperCase();
    const mobileBaseRgb = hexToRgbNormalized(baseColorHex);
    if (mobileBaseRgb) {
      baseColorHueDegrees = rgbNormalizedToHueDegrees(mobileBaseRgb);
      baseColorRgb = hsvToRgbNormalized(baseColorHueDegrees, BASE_COLOR_SATURATION, BASE_COLOR_VALUE);
      baseColorHex = rgbNormalizedToHex(baseColorRgb);
    }
    maxStepsValue = MOBILE_DEFAULTS.maxSteps;
    mbItersValue = MOBILE_DEFAULTS.mbIters;
    lowPowerModeValue = 1;
    renderScaleValue = MOBILE_DEFAULTS.renderScale;
    targetFrameDelta = 1.0 / MOBILE_DEFAULTS.targetFps;

    minHitSlider.value = String(minHitExponentToSlider(minHitExponent));
    maxDistSlider.value = String(maxDistValue);
    glowSlider.value = String(glowStrengthValue);
    stepTintSlider.value = String(stepTintValue);
    exposureSlider.value = String(exposureValue);
    contrastSlider.value = String(contrastValue);
    saturationSlider.value = String(saturationValue);
    sunAzimuthSlider.value = String(sunAzimuthDegrees);
    sunElevationSlider.value = String(sunElevationDegrees);
    sunIntensitySlider.value = String(sunIntensityValue);
    fogDensitySlider.value = String(fogDensityValue);
    roughnessSlider.value = String(roughnessValue);
    baseHueSlider.value = baseColorHueDegrees.toFixed(0);
    baseColorValueEl.textContent = baseColorHueDegrees.toFixed(0) + "\u00b0";
    visualPresetSelect.value = "custom";
  }

  function setTouchKeyState(keyCode, pressed) {
    if (!Number.isInteger(keyCode) || keyCode < 0 || keyCode >= KEYBOARD_TEX_WIDTH) {
      return;
    }

    if (pressed) {
      touchPressCount[keyCode] = Math.min(255, touchPressCount[keyCode] + 1);
    } else if (touchPressCount[keyCode] > 0) {
      touchPressCount[keyCode] -= 1;
    }

    touchState[keyCode] = touchPressCount[keyCode] > 0 ? 255 : 0;
    syncKeyState();

    if (pressed && MOVEMENT_HINT_KEYCODES.has(keyCode)) {
      dismissMovementHint();
    }
    if (pressed && TURN_HINT_KEYCODES.has(keyCode)) {
      dismissTurnHint();
    }
  }

  function releaseTouchPointer(pointerId) {
    const keyCode = pointerToKeyCode.get(pointerId);
    if (typeof keyCode !== "number") {
      return;
    }

    pointerToKeyCode.delete(pointerId);
    setTouchKeyState(keyCode, false);
  }

  function bindMobileControls() {
    for (let i = 0; i < mobileKeyButtons.length; i += 1) {
      const button = mobileKeyButtons[i];
      const keyCode = Number(button.dataset.touchKeycode);
      if (!Number.isInteger(keyCode)) {
        continue;
      }

      button.addEventListener("pointerdown", function onPointerDown(event) {
        if (!isMobileClient || isAnyModalOpen()) {
          return;
        }

        event.preventDefault();
        if (pointerToKeyCode.has(event.pointerId)) {
          return;
        }

        pointerToKeyCode.set(event.pointerId, keyCode);
        if (button.setPointerCapture) {
          button.setPointerCapture(event.pointerId);
        }
        setTouchKeyState(keyCode, true);
      });

      button.addEventListener("pointerup", function onPointerUp(event) {
        releaseTouchPointer(event.pointerId);
      });

      button.addEventListener("pointercancel", function onPointerCancel(event) {
        releaseTouchPointer(event.pointerId);
      });

      button.addEventListener("lostpointercapture", function onPointerCaptureLost(event) {
        releaseTouchPointer(event.pointerId);
      });
    }
  }

  function openHelp() {
    dismissHelpPointerHint(true);
    paywallOpen = false;
    paywallDialog.hidden = true;
    settingsOpen = false;
    settingsDialog.hidden = true;
    helpOpen = true;
    clearKeys();
    helpDialog.hidden = false;
    closeHelpButton.focus();
    updateAdVisibility();
  }

  function closeHelp() {
    helpOpen = false;
    clearKeys();
    helpDialog.hidden = true;
    helpButton.focus();
    updateAdVisibility();
  }

  function openSettings() {
    helpOpen = false;
    helpDialog.hidden = true;
    paywallOpen = false;
    paywallDialog.hidden = true;
    settingsOpen = true;
    clearKeys();
    settingsDialog.hidden = false;
    minHitSlider.focus();
    updateAdVisibility();
  }

  function closeSettings() {
    settingsOpen = false;
    clearKeys();
    settingsDialog.hidden = true;
    settingsButton.focus();
    updateAdVisibility();
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
    if (isMobileClient) {
      return;
    }

    if (!turnHint.hidden) {
      return;
    }

    turnHint.hidden = false;
  }

  function showHelpPointerHint() {
    if (isMobileClient) {
      return;
    }

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

  function hexToRgbNormalized(hexColor) {
    if (typeof hexColor !== "string") {
      return null;
    }
    const match = /^#([0-9a-fA-F]{6})$/.exec(hexColor.trim());
    if (!match) {
      return null;
    }
    const value = match[1];
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  function rgbNormalizedToHueDegrees(rgb) {
    const r = clamp(rgb[0], 0.0, 1.0);
    const g = clamp(rgb[1], 0.0, 1.0);
    const b = clamp(rgb[2], 0.0, 1.0);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta < 1e-6) {
      return baseColorHueDegrees;
    }

    let hue;
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
    return hue;
  }

  function hsvToRgbNormalized(hueDegrees, saturation, value) {
    const h = ((hueDegrees % 360) + 360) % 360;
    const s = clamp(saturation, 0.0, 1.0);
    const v = clamp(value, 0.0, 1.0);
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let rgbPrime;
    if (h < 60) {
      rgbPrime = [c, x, 0];
    } else if (h < 120) {
      rgbPrime = [x, c, 0];
    } else if (h < 180) {
      rgbPrime = [0, c, x];
    } else if (h < 240) {
      rgbPrime = [0, x, c];
    } else if (h < 300) {
      rgbPrime = [x, 0, c];
    } else {
      rgbPrime = [c, 0, x];
    }

    return [rgbPrime[0] + m, rgbPrime[1] + m, rgbPrime[2] + m];
  }

  function rgbNormalizedToHex(rgb) {
    const r = Math.round(clamp(rgb[0], 0.0, 1.0) * 255)
      .toString(16)
      .padStart(2, "0");
    const g = Math.round(clamp(rgb[1], 0.0, 1.0) * 255)
      .toString(16)
      .padStart(2, "0");
    const b = Math.round(clamp(rgb[2], 0.0, 1.0) * 255)
      .toString(16)
      .padStart(2, "0");
    return ("#" + r + g + b).toUpperCase();
  }

  function minHitSliderToExponent(sliderValue) {
    const slider = clamp(sliderValue, MIN_HIT_SLIDER_MIN, MIN_HIT_SLIDER_MAX);
    const normalized = (slider - MIN_HIT_SLIDER_MIN) / (MIN_HIT_SLIDER_MAX - MIN_HIT_SLIDER_MIN);
    return MIN_HIT_EXP_MAX + (MIN_HIT_EXP_MIN - MIN_HIT_EXP_MAX) * normalized;
  }

  function minHitExponentToSlider(exponentValue) {
    const exponent = clamp(exponentValue, MIN_HIT_EXP_MIN, MIN_HIT_EXP_MAX);
    const normalized = (MIN_HIT_EXP_MAX - exponent) / (MIN_HIT_EXP_MAX - MIN_HIT_EXP_MIN);
    return MIN_HIT_SLIDER_MIN + normalized * (MIN_HIT_SLIDER_MAX - MIN_HIT_SLIDER_MIN);
  }

  function formatScientific(value, digits) {
    return value.toExponential(digits);
  }

  function updateMinHitFromSlider() {
    const parsed = Number(minHitSlider.value);
    if (!Number.isFinite(parsed)) {
      minHitSlider.value = String(minHitExponentToSlider(minHitExponent));
      minHitValueEl.textContent = formatScientific(minHitValue, 2);
      return;
    }

    const sliderValue = clamp(parsed, MIN_HIT_SLIDER_MIN, MIN_HIT_SLIDER_MAX);
    minHitSlider.value = sliderValue.toFixed(2);
    minHitExponent = minHitSliderToExponent(sliderValue);
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

  function updateExposureFromSlider() {
    const parsed = Number(exposureSlider.value);
    if (!Number.isFinite(parsed)) {
      exposureSlider.value = String(exposureValue);
      exposureValueEl.textContent = exposureValue.toFixed(2);
      return;
    }

    exposureValue = clamp(parsed, 0.4, 2.6);
    exposureValueEl.textContent = exposureValue.toFixed(2);
  }

  function updateContrastFromSlider() {
    const parsed = Number(contrastSlider.value);
    if (!Number.isFinite(parsed)) {
      contrastSlider.value = String(contrastValue);
      contrastValueEl.textContent = contrastValue.toFixed(2);
      return;
    }

    contrastValue = clamp(parsed, 0.7, 1.7);
    contrastValueEl.textContent = contrastValue.toFixed(2);
  }

  function updateSaturationFromSlider() {
    const parsed = Number(saturationSlider.value);
    if (!Number.isFinite(parsed)) {
      saturationSlider.value = String(saturationValue);
      saturationValueEl.textContent = saturationValue.toFixed(2);
      return;
    }

    saturationValue = clamp(parsed, 0.0, 2.0);
    saturationValueEl.textContent = saturationValue.toFixed(2);
  }

  function updateSunAzimuthFromSlider() {
    const parsed = Number(sunAzimuthSlider.value);
    if (!Number.isFinite(parsed)) {
      sunAzimuthSlider.value = String(sunAzimuthDegrees);
      sunAzimuthValueEl.textContent = sunAzimuthDegrees.toFixed(0) + "\u00b0";
      return;
    }

    sunAzimuthDegrees = clamp(parsed, -180.0, 180.0);
    sunAzimuthValueEl.textContent = sunAzimuthDegrees.toFixed(0) + "\u00b0";
  }

  function updateSunElevationFromSlider() {
    const parsed = Number(sunElevationSlider.value);
    if (!Number.isFinite(parsed)) {
      sunElevationSlider.value = String(sunElevationDegrees);
      sunElevationValueEl.textContent = sunElevationDegrees.toFixed(0) + "\u00b0";
      return;
    }

    sunElevationDegrees = clamp(parsed, 2.0, 88.0);
    sunElevationValueEl.textContent = sunElevationDegrees.toFixed(0) + "\u00b0";
  }

  function updateSunIntensityFromSlider() {
    const parsed = Number(sunIntensitySlider.value);
    if (!Number.isFinite(parsed)) {
      sunIntensitySlider.value = String(sunIntensityValue);
      sunIntensityValueEl.textContent = sunIntensityValue.toFixed(2);
      return;
    }

    sunIntensityValue = clamp(parsed, 0.0, 2.8);
    sunIntensityValueEl.textContent = sunIntensityValue.toFixed(2);
  }

  function updateFogDensityFromSlider() {
    const parsed = Number(fogDensitySlider.value);
    if (!Number.isFinite(parsed)) {
      fogDensitySlider.value = String(fogDensityValue);
      fogDensityValueEl.textContent = fogDensityValue.toFixed(3);
      return;
    }

    fogDensityValue = clamp(parsed, 0.0, 0.08);
    fogDensityValueEl.textContent = fogDensityValue.toFixed(3);
  }

  function updateRoughnessFromSlider() {
    const parsed = Number(roughnessSlider.value);
    if (!Number.isFinite(parsed)) {
      roughnessSlider.value = String(roughnessValue);
      roughnessValueEl.textContent = roughnessValue.toFixed(2);
      return;
    }

    roughnessValue = clamp(parsed, 0.08, 0.95);
    roughnessValueEl.textContent = roughnessValue.toFixed(2);
  }

  function updateBaseColorFromInput() {
    const parsed = Number(baseHueSlider.value);
    if (!Number.isFinite(parsed)) {
      baseHueSlider.value = baseColorHueDegrees.toFixed(0);
      baseColorValueEl.textContent = baseColorHueDegrees.toFixed(0) + "\u00b0";
      return;
    }

    baseColorHueDegrees = clamp(parsed, 0.0, 360.0);
    baseHueSlider.value = baseColorHueDegrees.toFixed(0);
    baseColorRgb = hsvToRgbNormalized(baseColorHueDegrees, BASE_COLOR_SATURATION, BASE_COLOR_VALUE);
    baseColorHex = rgbNormalizedToHex(baseColorRgb);
    baseColorValueEl.textContent = baseColorHueDegrees.toFixed(0) + "\u00b0";
  }

  function updateVisualControlOutputs() {
    updateGlowFromSlider();
    updateStepTintFromSlider();
    updateExposureFromSlider();
    updateContrastFromSlider();
    updateSaturationFromSlider();
    updateSunAzimuthFromSlider();
    updateSunElevationFromSlider();
    updateSunIntensityFromSlider();
    updateFogDensityFromSlider();
    updateRoughnessFromSlider();
    updateBaseColorFromInput();
  }

  function applyVisualPreset(presetName, persistChoice) {
    const preset = VISUAL_PRESETS[presetName];
    if (!preset) {
      return;
    }

    glowSlider.value = String(preset.glowStrength);
    stepTintSlider.value = String(preset.stepTint);
    exposureSlider.value = String(preset.exposure);
    contrastSlider.value = String(preset.contrast);
    saturationSlider.value = String(preset.saturation);
    sunAzimuthSlider.value = String(preset.sunAzimuthDegrees);
    sunElevationSlider.value = String(preset.sunElevationDegrees);
    sunIntensitySlider.value = String(preset.sunIntensity);
    fogDensitySlider.value = String(preset.fogDensity);
    roughnessSlider.value = String(preset.roughness);
    const presetBaseRgb = hexToRgbNormalized(preset.baseColorHex);
    if (presetBaseRgb) {
      baseHueSlider.value = String(rgbNormalizedToHueDegrees(presetBaseRgb));
    }
    updateVisualControlOutputs();

    visualPresetSelect.value = presetName;
    if (persistChoice) {
      localStorage.setItem(VISUAL_PRESET_KEY, presetName);
    }
  }

  function setVisualPresetCustom() {
    if (visualPresetSelect.value !== "custom") {
      visualPresetSelect.value = "custom";
      localStorage.setItem(VISUAL_PRESET_KEY, "custom");
    }
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

  function updateMobileFovFromInput() {
    const parsed = Number(mobileFovSlider.value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = clamp(parsed, 0.35, 1.2);
    mobileFovSlider.value = clamped.toFixed(2);
    mobileFovValue.textContent = clamped.toFixed(2);
    fovOverrideValue = isMobileClient ? clamped : -1.0;
  }

  function syncMobileFovValue() {
    if (!isMobileClient || mobileFovControl.hidden) {
      return;
    }
    updateMobileFovFromInput();
  }

  applyMobileProfile();
  bindMobileControls();

  const storedPreset = localStorage.getItem(PREMIUM_PRESET_KEY);
  if (storedPreset === "ultra" || storedPreset === "balanced") {
    premiumPresetSelect.value = storedPreset;
  }

  const storedVisualPreset = localStorage.getItem(VISUAL_PRESET_KEY);
  if (storedVisualPreset && (storedVisualPreset in VISUAL_PRESETS || storedVisualPreset === "custom")) {
    visualPresetSelect.value = storedVisualPreset;
  }

  helpButton.addEventListener("click", openHelp);
  document.addEventListener("contextmenu", suppressLongPressUi);
  document.addEventListener("selectstart", suppressLongPressUi);
  document.addEventListener("dragstart", suppressLongPressUi);
  document.addEventListener("pointerdown", markInteractionForAds);
  document.addEventListener("keydown", markInteractionForAds);
  settingsButton.addEventListener("click", openSettings);
  closeHelpButton.addEventListener("click", closeHelp);
  closeSettingsButton.addEventListener("click", closeSettings);
  closePaywallButton.addEventListener("click", closePaywall);
  unlockPremiumButton.addEventListener("click", openPaywall);
  checkoutPremiumButton.addEventListener("click", function onCheckoutClick() {
    startCheckoutFlow();
  });
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
  paywallDialog.addEventListener("click", function onPaywallBackdropClick(event) {
    if (event.target === paywallDialog) {
      closePaywall();
    }
  });
  canvas.addEventListener("pointerdown", function onCanvasPointerDown(event) {
    beginPointerLook(event);
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointermove", function onCanvasPointerMove(event) {
    updatePointerLook(event);
    if (isPointerLooking && event.pointerType !== "mouse") {
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointerup", function onCanvasPointerUp(event) {
    endPointerLook(event.pointerId);
  });
  canvas.addEventListener("pointercancel", function onCanvasPointerCancel(event) {
    endPointerLook(event.pointerId);
  });
  canvas.addEventListener("lostpointercapture", function onCanvasPointerCaptureLost(event) {
    endPointerLook(event.pointerId);
  });

  minHitSlider.addEventListener("input", updateMinHitFromSlider);
  minHitSlider.addEventListener("change", updateMinHitFromSlider);
  modeSelect.addEventListener("change", updateModeFromInput);
  mobileFovSlider.addEventListener("input", updateMobileFovFromInput);
  mobileFovSlider.addEventListener("change", updateMobileFovFromInput);
  maxDistSlider.addEventListener("input", updateMaxDistFromSlider);
  maxDistSlider.addEventListener("change", updateMaxDistFromSlider);
  glowSlider.addEventListener("input", updateGlowFromSlider);
  glowSlider.addEventListener("change", updateGlowFromSlider);
  stepTintSlider.addEventListener("input", updateStepTintFromSlider);
  stepTintSlider.addEventListener("change", updateStepTintFromSlider);
  exposureSlider.addEventListener("input", updateExposureFromSlider);
  exposureSlider.addEventListener("change", updateExposureFromSlider);
  contrastSlider.addEventListener("input", updateContrastFromSlider);
  contrastSlider.addEventListener("change", updateContrastFromSlider);
  saturationSlider.addEventListener("input", updateSaturationFromSlider);
  saturationSlider.addEventListener("change", updateSaturationFromSlider);
  sunAzimuthSlider.addEventListener("input", updateSunAzimuthFromSlider);
  sunAzimuthSlider.addEventListener("change", updateSunAzimuthFromSlider);
  sunElevationSlider.addEventListener("input", updateSunElevationFromSlider);
  sunElevationSlider.addEventListener("change", updateSunElevationFromSlider);
  sunIntensitySlider.addEventListener("input", updateSunIntensityFromSlider);
  sunIntensitySlider.addEventListener("change", updateSunIntensityFromSlider);
  fogDensitySlider.addEventListener("input", updateFogDensityFromSlider);
  fogDensitySlider.addEventListener("change", updateFogDensityFromSlider);
  roughnessSlider.addEventListener("input", updateRoughnessFromSlider);
  roughnessSlider.addEventListener("change", updateRoughnessFromSlider);
  const visualCustomInputs = [
    glowSlider,
    stepTintSlider,
    exposureSlider,
    contrastSlider,
    saturationSlider,
    sunAzimuthSlider,
    sunElevationSlider,
    sunIntensitySlider,
    fogDensitySlider,
    roughnessSlider,
    baseHueSlider,
  ];
  for (let i = 0; i < visualCustomInputs.length; i += 1) {
    visualCustomInputs[i].addEventListener("input", setVisualPresetCustom);
  }
  baseHueSlider.addEventListener("input", updateBaseColorFromInput);
  baseHueSlider.addEventListener("change", updateBaseColorFromInput);
  visualPresetSelect.addEventListener("change", function onVisualPresetChange() {
    const value = visualPresetSelect.value;
    if (value === "custom") {
      localStorage.setItem(VISUAL_PRESET_KEY, "custom");
      return;
    }
    applyVisualPreset(value, true);
  });
  premiumPresetSelect.addEventListener("change", function onPresetChange() {
    localStorage.setItem(PREMIUM_PRESET_KEY, getSelectedPremiumPreset());
  });

  updateMinHitFromSlider();
  updateModeFromInput();
  updateMobileFovFromInput();
  updateMaxDistFromSlider();
  updateVisualControlOutputs();
  if (visualPresetSelect.value in VISUAL_PRESETS) {
    applyVisualPreset(visualPresetSelect.value, false);
  } else {
    visualPresetSelect.value = "custom";
  }
  setPremiumUnlocked(false);
  initializeMonetization().catch(function onInitMonetizationError(error) {
    showError("Monetization initialization failed.", error);
  });

  window.addEventListener("keydown", function onKeyDown(event) {
    if (event.key === "Escape" && isAnyModalOpen()) {
      event.preventDefault();
      if (paywallOpen) {
        closePaywall();
      } else if (settingsOpen) {
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

    if (isAnyModalOpen()) {
      return;
    }

    if (keyCode !== null && MOVEMENT_HINT_KEYCODES.has(keyCode)) {
      dismissMovementHint();
    }

    if (keyCode !== null && TURN_HINT_KEYCODES.has(keyCode)) {
      dismissTurnHint();
    }

    if (keyCode !== null) {
      keyboardState[keyCode] = 255;
      syncKeyState();
    }
  });

  window.addEventListener("keyup", function onKeyUp(event) {
    const keyCode = getLegacyKeyCode(event);
    if (keyCode !== null) {
      keyboardState[keyCode] = 0;
      syncKeyState();
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
      uExposure: gl.getUniformLocation(program, "uExposure"),
      uContrast: gl.getUniformLocation(program, "uContrast"),
      uSaturation: gl.getUniformLocation(program, "uSaturation"),
      uSunAzimuth: gl.getUniformLocation(program, "uSunAzimuth"),
      uSunElevation: gl.getUniformLocation(program, "uSunElevation"),
      uSunIntensity: gl.getUniformLocation(program, "uSunIntensity"),
      uFogDensity: gl.getUniformLocation(program, "uFogDensity"),
      uRoughness: gl.getUniformLocation(program, "uRoughness"),
      uBaseColor: gl.getUniformLocation(program, "uBaseColor"),
      uMaxSteps: gl.getUniformLocation(program, "uMaxSteps"),
      uMbIters: gl.getUniformLocation(program, "uMbIters"),
      uLowPowerMode: gl.getUniformLocation(program, "uLowPowerMode"),
      uFovOverride: gl.getUniformLocation(program, "uFovOverride"),
      uLookDelta: gl.getUniformLocation(program, "uLookDelta"),
      channels: channels,
    };
  }

  function setUniforms(gl, bundle, width, height, time, delta, frame, lookYawDelta, lookPitchDelta) {
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
    if (bundle.uExposure !== null) {
      gl.uniform1f(bundle.uExposure, exposureValue);
    }
    if (bundle.uContrast !== null) {
      gl.uniform1f(bundle.uContrast, contrastValue);
    }
    if (bundle.uSaturation !== null) {
      gl.uniform1f(bundle.uSaturation, saturationValue);
    }
    if (bundle.uSunAzimuth !== null) {
      gl.uniform1f(bundle.uSunAzimuth, (sunAzimuthDegrees * Math.PI) / 180.0);
    }
    if (bundle.uSunElevation !== null) {
      gl.uniform1f(bundle.uSunElevation, (sunElevationDegrees * Math.PI) / 180.0);
    }
    if (bundle.uSunIntensity !== null) {
      gl.uniform1f(bundle.uSunIntensity, sunIntensityValue);
    }
    if (bundle.uFogDensity !== null) {
      gl.uniform1f(bundle.uFogDensity, fogDensityValue);
    }
    if (bundle.uRoughness !== null) {
      gl.uniform1f(bundle.uRoughness, roughnessValue);
    }
    if (bundle.uBaseColor !== null) {
      gl.uniform3f(bundle.uBaseColor, baseColorRgb[0], baseColorRgb[1], baseColorRgb[2]);
    }
    if (bundle.uMaxSteps !== null) {
      gl.uniform1i(bundle.uMaxSteps, maxStepsValue);
    }
    if (bundle.uMbIters !== null) {
      gl.uniform1i(bundle.uMbIters, mbItersValue);
    }
    if (bundle.uLowPowerMode !== null) {
      gl.uniform1i(bundle.uLowPowerMode, lowPowerModeValue);
    }
    if (bundle.uFovOverride !== null) {
      gl.uniform1f(bundle.uFovOverride, fovOverrideValue);
    }
    if (bundle.uLookDelta !== null) {
      gl.uniform2f(bundle.uLookDelta, lookYawDelta, lookPitchDelta);
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
    const dpr = Math.min(window.devicePixelRatio || 1, devicePixelRatioCap);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr * renderScaleValue));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr * renderScaleValue));

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

  async function startCheckoutFlow() {
    if (!publicConfig.paymentsEnabled) {
      showError("Checkout is not configured on this deployment.");
      return;
    }

    checkoutPremiumButton.disabled = true;
    checkoutPremiumButton.textContent = "Redirecting...";

    try {
      const payload = await postJson("/api/create-checkout-session", {
        successPath: getCurrentPathWithHash(),
        cancelPath: getCurrentPathWithHash(),
      });

      if (!payload || typeof payload.url !== "string") {
        throw new Error("Checkout response missing redirect URL.");
      }

      window.location.href = payload.url;
    } catch (error) {
      showError("Could not start checkout.", error);
      checkoutPremiumButton.disabled = false;
      checkoutPremiumButton.textContent = "Unlock Now";
    }
  }

  async function initializeMonetization() {
    await loadPublicConfig();
    await validateStoredUnlockToken();
    await tryCompleteCheckoutFromUrl();

    if (!publicConfig.paymentsEnabled) {
      unlockPremiumButton.disabled = true;
      unlockPremiumButton.textContent = "Checkout unavailable";
      premiumStatusText.textContent = "Premium checkout is not configured for this deployment.";
      paywallDialog.hidden = true;
    } else {
      checkoutPremiumButton.textContent = "Unlock for " + publicConfig.priceLabel;
    }

    updateAdVisibility();
  }

  function buildScreenshotFileName() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return "mandelbulb-" + stamp + ".png";
  }

  async function renderScreenshotInWorker(payload) {
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are not supported in this browser.");
    }

    return new Promise(function workerPromise(resolve, reject) {
      const worker = new Worker("./screenshot-worker.js", { type: "module" });

      function cleanup() {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      }

      worker.onmessage = function onWorkerMessage(event) {
        const data = event.data || {};
        cleanup();

        if (!data.ok) {
          reject(new Error(data.error || "Screenshot worker failed."));
          return;
        }

        resolve(data);
      };

      worker.onerror = function onWorkerError(event) {
        cleanup();
        reject(new Error(event.message || "Screenshot worker crashed."));
      };

      worker.postMessage(payload, [payload.stateBuffer]);
    });
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
    let lastPresentTime = lastTime;
    let currentTimeSec = lastTime;

    async function handleScreenshotClick() {
      if (screenshotInProgress) {
        return;
      }

      setScreenshotBusy(true);

      try {
        const statePixels = new Float32Array(STATE_WIDTH * STATE_HEIGHT * 4);
        const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.FRAMEBUFFER, readState.framebuffer);
        gl.readPixels(0, 0, STATE_WIDTH, STATE_HEIGHT, gl.RGBA, gl.FLOAT, statePixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

        const dims = getScreenshotDimensions();
        const premiumProfile = isPremiumUnlocked ? getPremiumScreenshotProfile() : null;
        const screenshotPayload = {
          width: dims.width,
          height: dims.height,
          fileName: buildScreenshotFileName(),
          mainImageSource: rawMainImage,
          stateBuffer: statePixels.buffer,
          watermarkText: isPremiumUnlocked ? "" : WATERMARK_TEXT,
          uniforms: {
            iTime: currentTimeSec,
            iTimeDelta: 1.0 / 60.0,
            iFrame: frame,
            uMinHit: premiumProfile ? premiumProfile.uMinHit : minHitValue,
            uEps: premiumProfile ? premiumProfile.uEps : minHitValue * 5.0,
            uMode: modeValue,
            uMaxDist: premiumProfile ? premiumProfile.uMaxDist : maxDistValue,
            uGlowStrength: glowStrengthValue,
            uStepTint: stepTintValue,
            uExposure: exposureValue,
            uContrast: contrastValue,
            uSaturation: saturationValue,
            uSunAzimuth: (sunAzimuthDegrees * Math.PI) / 180.0,
            uSunElevation: (sunElevationDegrees * Math.PI) / 180.0,
            uSunIntensity: sunIntensityValue,
            uFogDensity: fogDensityValue,
            uRoughness: roughnessValue,
            uBaseColor: baseColorRgb,
            uMaxSteps: premiumProfile ? premiumProfile.uMaxSteps : maxStepsValue,
            uMbIters: premiumProfile ? premiumProfile.uMbIters : mbItersValue,
            uLowPowerMode: premiumProfile ? premiumProfile.uLowPowerMode : lowPowerModeValue,
            uFovOverride: fovOverrideValue,
          },
        };

        const result = await renderScreenshotInWorker(screenshotPayload);
        const blob = new Blob([result.blobBuffer], { type: "image/png" });
        downloadBlob(blob, result.fileName || screenshotPayload.fileName);
      } catch (error) {
        showError("Screenshot failed. See console for details.", error);
      } finally {
        setScreenshotBusy(false);
      }
    }

    screenshotButton.addEventListener("click", function onScreenshotClick() {
      handleScreenshotClick();
    });

    function render(nowMillis) {
      const now = nowMillis * 0.001;
      if (targetFrameDelta > 0.0 && now - lastPresentTime < targetFrameDelta) {
        requestAnimationFrame(render);
        return;
      }

      const delta = Math.max(1.0 / 240.0, Math.min(0.25, now - lastTime));
      lastTime = now;
      lastPresentTime = now;
      currentTimeSec = now;

      syncMobileFovValue();
      const lookYawDelta = pendingLookYawDelta;
      const lookPitchDelta = pendingLookPitchDelta;
      pendingLookYawDelta = 0.0;
      pendingLookPitchDelta = 0.0;

      resizeCanvasToDisplaySize(gl, canvas);
      updateKeyboardTexture(gl, keyboardTexture);

      gl.useProgram(bufferProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeState.framebuffer);
      gl.viewport(0, 0, STATE_WIDTH, STATE_HEIGHT);
      setUniforms(gl, bufferUniforms, STATE_WIDTH, STATE_HEIGHT, now, delta, frame, lookYawDelta, lookPitchDelta);
      bindTextureAt(gl, 0, readState.texture, bufferUniforms.channels[0]);
      bindTextureAt(gl, 1, keyboardTexture, bufferUniforms.channels[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(imageProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      setUniforms(gl, imageUniforms, canvas.width, canvas.height, now, delta, frame, 0.0, 0.0);
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
