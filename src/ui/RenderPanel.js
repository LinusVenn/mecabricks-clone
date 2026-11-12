export class RenderPanel {

    constructor(container, settings) {

        if (!container || !settings) {

            throw new TypeError(
                "Container and RenderSettings are required."
            );
        }

        this.settings = settings;

        this.element = document.createElement("section");

        this.element.className =
            "phase7-panel render-panel";


        const heading = document.createElement("h3");

        heading.textContent = "Rendering";

        this.element.append(heading);


        // Tone Mapping

        this.addSelect(
            "Tone mapping",
            "toneMapping",
            [

                ["None", "None"],
                ["Linear", "Linear"],
                ["Reinhard", "Reinhard"],
                ["Cineon", "Cineon"],
                ["ACESFilmic", "ACES Filmic"],
                ["AgX", "AgX"],
                ["Neutral", "Neutral"]

            ]
        );


        // Belichtung

        this.addRange(
            "Exposure",
            "exposure",
            0.1,
            3,
            0.05
        );


        // Pixel Ratio

        this.addRange(
            "Pixel Ratio",
            "pixelRatio",
            1,
            3,
            0.25
        );


        // Schatten

        this.addCheckbox(
            "Shadows",
            "shadows"
        );


        container.append(this.element);
    }


    addSelect(label, key, options) {

        const row = document.createElement("label");

        row.className = "phase7-control";


        const caption = document.createElement("span");

        caption.textContent = label;


        const select = document.createElement("select");


        for (const [value, text] of options) {

            const option = document.createElement("option");

            option.value = value;

            option.textContent = text;

            select.append(option);
        }


        select.value = String(
            this.settings.get(key)
        );


        select.addEventListener("change", () => {

            this.settings.set(
                key,
                select.value
            );
        });


        row.append(caption, select);

        this.element.append(row);
    }


    addRange(label, key, min, max, step) {

        const row = document.createElement("label");

        row.className = "phase7-control";


        const caption = document.createElement("span");

        caption.textContent = label;


        const input = document.createElement("input");

        input.type = "range";

        input.min = String(min);

        input.max = String(max);

        input.step = String(step);

        input.value = String(
            this.settings.get(key)
        );


        input.addEventListener("input", () => {

            this.settings.set(
                key,
                Number(input.value)
            );
        });


        row.append(caption, input);

        this.element.append(row);
    }


    addCheckbox(label, key) {

        const row = document.createElement("label");

        row.className = "phase7-control";


        const caption = document.createElement("span");

        caption.textContent = label;


        const input = document.createElement("input");

        input.type = "checkbox";

        input.checked = Boolean(
            this.settings.get(key)
        );


        input.addEventListener("change", () => {

            this.settings.set(
                key,
                input.checked
            );
        });


        row.append(caption, input);

        this.element.append(row);
    }


    dispose() {

        this.element.remove();
    }

}