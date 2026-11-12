export const DEFAULT_RENDER_SETTINGS = Object.freeze({
    shadows: true,
    antialias: true,
    toneMapping: "ACESFilmic",
    exposure: 1,
    outputColorSpace: "SRGB",
    physicallyCorrectLights: true,
    pixelRatio: 2,
    clearColor: 0x20242b,
    clearAlpha: 1
});

export class RenderSettings {

    constructor(initial = {}) {
        this.values = {
            ...DEFAULT_RENDER_SETTINGS,
            ...initial
        };

        this.listeners = new Set();
    }

    get(key) {
        return this.values[key];
    }

    getAll() {
        return { ...this.values };
    }

    set(key, value) {

        if (!(key in DEFAULT_RENDER_SETTINGS)) {
            throw new Error(`Unknown render setting: ${key}`);
        }

        if (Object.is(this.values[key], value)) {
            return;
        }

        this.values[key] = value;

        for (const listener of this.listeners) {
            listener(this.getAll(), key, value);
        }
    }

    update(values = {}) {

        for (const [key, value] of Object.entries(values)) {
            this.set(key, value);
        }
    }

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("listener must be a function");
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }
}