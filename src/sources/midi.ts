import { getSlidersInput, setSlidersActiveDevice } from "./gamepad.js";

let midiInitialized = false;

export async function initMidi(): Promise<void> {
  if (midiInitialized || typeof navigator === "undefined") return;
  midiInitialized = true;

  if (!navigator.requestMIDIAccess) return;

  try {
    const access = await navigator.requestMIDIAccess();
    const sliders = getSlidersInput();
    const ccValues = new Map<number, number>();

    for (const input of access.inputs.values()) {
      input.onmidimessage = (e) => {
        const data = e.data;
        if (!data || data.length < 3) return;
        const status = data[0];
        const cc = data[1];
        const value = data[2];
        if (status === undefined || cc === undefined || value === undefined) return;

        const isCC = (status & 0xf0) === 0xb0;
        if (!isCC) return;

        ccValues.set(cc, value / 127);
        setSlidersActiveDevice("midi");

        const ccs = [...ccValues.entries()].sort((a, b) => a[0] - b[0]);
        if (ccs[0]) sliders.x._setValue(ccs[0][1]);
        if (ccs[1]) sliders.y._setValue(ccs[1][1]);
        if (ccs[2]) sliders.rotation._setValue(ccs[2][1]);
      };
    }
  } catch {
    // MIDI unavailable — graceful no-op
  }
}
