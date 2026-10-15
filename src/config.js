/**
 * Central tuning knobs. Everything "feel" related lives here so you can tweak
 * the vibe without digging through systems.
 */
export const CONFIG = {
  render: {
    width: 320, // initial internal width (it follows the window aspect)
    height: 240, // internal line count
    colorBits: 5, // 15-bit colour (5 bits per channel)
    dither: 1,
    jitter: 0.6, // vertex snapping strength (0..1). 1 = raw PS1, very crawly
    wobble: 0, // baseline vertex wobble; only drinking turns it on
    affine: 0.55, // 0 = perspective-correct UVs, 1 = full PS1 texture warp
    bloom: 0.3,
    bloomThreshold: 0.62,
    fov: 70,
    maxPointLights: 8, // see render/PSXMaterial.js (MAX_LIGHTS)
  },

  fog: {
    color: 0x101018,
    near: 4,
    far: 30,
  },

  time: {
    startMinutes: 3 * 60, // 3:00 a.m.
    minutesPerSecond: 0.5, // 1 in-game hour = 2 real minutes
  },

  player: {
    radius: 0.32,
    height: 1.7,
    eyeHeight: 1.58,
    walkSpeed: 3.2,
    sprintSpeed: 5.4,
    jumpSpeed: 4.6,
    gravity: -22,
    mouseSensitivity: 0.0022,
    interactRange: 2.4,
  },

  vehicle: {
    maxSpeed: 24, // m/s (~54 mph)
    maxReverse: 6,
    acceleration: 7,
    brakeDecel: 16,
    drag: 0.35,
    rolling: 1.2,
    steerMax: 0.6, // radians at the wheels
    steerSpeed: 2.6,
    wheelBase: 3.0,
    radius: 1.05, // collision capsule radius
  },

  economy: {
    startMoney: 50,
  },
};
