import {
    MATERIAL_PRESETS
} from "../materials/MaterialPresets.js";


export class MaterialPanel {

    constructor(container, materialManager, {

        onApplied = null

    } = {}) {

        if (!container || !materialManager) {

            throw new TypeError(
                "Container and MaterialManager are required."
            );
        }

        this.container = container;

        this.materialManager = materialManager;

        this.onApplied = onApplied;

        this.target = null;

        this.element = document.createElement("section");

        this.element.className =
            "phase7-panel material-panel";

        this.render();

        container.appendChild(this.element);
    }


    setTarget(target) {

        this.target = target;
    }


    render() {

        this.element.replaceChildren();


        const heading = document.createElement("h3");

        heading.textContent = "Material";


        const select = document.createElement("select");

        select.setAttribute(
            "aria-label",
            "Material preset"
        );


        // Material-Presets hinzufügen

        for (const [id, preset] of Object.entries(MATERIAL_PRESETS)) {

            const option = document.createElement("option");

            option.value = id;

            option.textContent = preset.name;

            select.append(option);
        }


        // Anwenden-Button

        const apply = document.createElement("button");

        apply.type = "button";

        apply.textContent = "Apply";


        apply.addEventListener("click", () => {

            if (!this.target) return;

            const count = this.materialManager.apply(
                this.target,
                select.value
            );

            this.onApplied?.({

                preset: select.value,

                meshCount: count

            });
        });


        this.element.append(
            heading,
            select,
            apply
        );


        this.select = select;
    }


    dispose() {

        this.element.remove();
    }

}