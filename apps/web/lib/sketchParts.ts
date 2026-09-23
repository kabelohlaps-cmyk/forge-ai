export interface SketchPart {
  id: string;
  label: string;
  category: string;
  url: string;
}

export const SKETCH_PARTS: SketchPart[] = [
  {
    id: "mecha-arm",
    label: "Arm",
    category: "mecha",
    url: "/sketch-parts/mecha-arm.svg",
  },
  {
    id: "mecha-head",
    label: "Head",
    category: "mecha",
    url: "/sketch-parts/mecha-head.svg",
  },
  {
    id: "mecha-thruster",
    label: "Thruster",
    category: "mecha",
    url: "/sketch-parts/mecha-thruster.svg",
  },
  {
    id: "wheel",
    label: "Wheel",
    category: "vehicle",
    url: "/sketch-parts/wheel.svg",
  },
  {
    id: "vehicle-panel",
    label: "Body Panel",
    category: "vehicle",
    url: "/sketch-parts/vehicle-panel.svg",
  },
  {
    id: "vehicle-window",
    label: "Window",
    category: "vehicle",
    url: "/sketch-parts/vehicle-window.svg",
  },
  {
    id: "character-hand",
    label: "Hand",
    category: "character",
    url: "/sketch-parts/character-hand.svg",
  },
  {
    id: "character-eye",
    label: "Eye",
    category: "character",
    url: "/sketch-parts/character-eye.svg",
  },
  {
    id: "tree-simple",
    label: "Tree",
    category: "environment",
    url: "/sketch-parts/tree-simple.svg",
  },
  {
    id: "crate",
    label: "Crate",
    category: "environment",
    url: "/sketch-parts/crate.svg",
  },
];
