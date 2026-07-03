import type { Station } from "./types";

export const stationConfig: Record<Station, { label: string; dot: string }> = {
  cutter: { label: "Cutter", dot: "bg-cyan-500" },
  stitcher: { label: "Stitcher", dot: "bg-violet-500" },
  packer: { label: "Packer", dot: "bg-amber-500" },
};
