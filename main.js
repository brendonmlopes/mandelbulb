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
    glowStrength: 0.6,
    stepTint: 0.65,
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
  let glowStrengthValue = 1.0;
  let stepTintValue = 1.0;
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
    maxStepsValue = MOBILE_DEFAULTS.maxSteps;
    mbItersValue = MOBILE_DEFAULTS.mbIters;
    lowPowerModeValue = 1;
    renderScaleValue = MOBILE_DEFAULTS.renderScale;
    targetFrameDelta = 1.0 / MOBILE_DEFAULTS.targetFps;

    minHitSlider.value = String(minHitExponentToSlider(minHitExponent));
    maxDistSlider.value = String(maxDistValue);
    glowSlider.value = String(glowStrengthValue);
    stepTintSlider.value = String(stepTintValue);
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
  premiumPresetSelect.addEventListener("change", function onPresetChange() {
    localStorage.setItem(PREMIUM_PRESET_KEY, getSelectedPremiumPreset());
  });

  updateMinHitFromSlider();
  updateModeFromInput();
  updateMobileFovFromInput();
  updateMaxDistFromSlider();
  updateGlowFromSlider();
  updateStepTintFromSlider();
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
