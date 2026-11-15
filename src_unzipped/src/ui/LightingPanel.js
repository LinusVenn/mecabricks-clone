export class LightingPanel {

    constructor(container, lightingManager) {

        if (!container || !lightingManager) {

            throw new TypeError(
                "Container and LightingManager are required."
            );
        }

        this.manager = lightingManager;

        this.element = document.createElement("section");

        this.element.className =
            "phase7-panel lighting-panel";


        const heading = document.createElement("h3");

        heading.textContent = "Lighting";

        this.element.append(heading);


        const lightOptions = [

            ["ambient", "Ambient"],
            ["key", "Key"],
            ["fill", "Fill"],
            ["rim", "Rim"]

        ];


        for (const [name, label] of lightOptions) {

            const row = document.createElement("label");

            row.className = "phase7-control";


            const text = document.createElement("span");

            text.textContent = label;


            const range = document.createElement("input");

            range.type = "range";

            range.min = "0";

            range.max = "5";

            range.step = "0.05";

            range.value = String(
                lightingManager.lights[name].intensity
            );


            range.addEventListener("input", () => {

                lightingManager.setIntensity(
                    name,
                    Number(range.value)
                );
            });


            row.append(text, range);

            this.element.append(row);
        }


        container.append(this.element);
    }


    dispose() {

        this.element.remove();
    }

}