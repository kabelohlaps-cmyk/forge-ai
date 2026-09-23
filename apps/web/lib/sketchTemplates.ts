export interface SketchTemplate {
  id: string;
  label: string;
  description: string;
  url: string;
}

export const SKETCH_TEMPLATES: SketchTemplate[] = [
  {
    id: "none",
    label: "No Template",
    description: "Start with a blank canvas.",
    url: "",
  },
  {
    id: "humanoid-gesture",
    label: "Humanoid Gesture",
    description: "Basic standing pose skeleton for characters or mecha.",
    url: "/sketch-templates/humanoid-gesture.svg",
  },
  {
    id: "perspective-grid",
    label: "Perspective Grid",
    description: "Single vanishing-point grid for environments and props.",
    url: "/sketch-templates/perspective-grid.svg",
  },
  {
    id: "head-proportions",
    label: "Head Proportions",
    description: "Cranium guide with standard facial proportion lines.",
    url: "/sketch-templates/head-proportions.svg",
  },
  {
    id: "vehicle-box",
    label: "Vehicle Box",
    description: "3D construction box for vehicles and hard-surface tech.",
    url: "/sketch-templates/vehicle-box.svg",
  },
];
