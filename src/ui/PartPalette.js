
import { PART_DEFINITIONS } from "../objects/PartDefinitions.js";

export class PartPalette {

  constructor(editor) {

    this.editor = editor;

    this.container = document.getElementById("part-palette");

    this.render();

  }

  render() {

    if (!this.container) {
      console.error("Element #part-palette wurde nicht gefunden.");
      return;
    }

    this.container.innerHTML = "";

    Object.values(PART_DEFINITIONS).forEach(part => {

      const button = document.createElement("button");

      button.textContent = part.name;

      button.addEventListener("click", () => {

        this.editor.placementManager.setSelectedPart(
          part.id
        );

      });

      this.container.appendChild(button);

    });

  }

}
