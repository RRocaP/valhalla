// STUB — replaced wholesale by the AUDIO worker (docs/AUDIO.md is the contract).
export function createAudio() {
  let enabled = false;
  let muted = false;
  return {
    enable() { enabled = true; },
    get enabled() { return enabled; },
    setMuted(b) { muted = !!b; },
    get muted() { return muted; },
    ui() {},
    motif() {},
    drone: { start() {}, stop() {}, intensity() {} },
  };
}
