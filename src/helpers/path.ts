import { Vec2 } from "../vec";

export const setPaths = (paths: Vec2[][]) => {
  const strokes = new Set();
  const groups = new Set();
  for (const path of paths) {
    strokes.add((path as any).stroke);
    groups.add((path as any).groupId);
  }
  const layerMode = groups.size > 1 ? 'group' : 'stroke'
  const groupLayers = Array.from(groups).sort()
  const strokeLayers = Array.from(strokes).sort()
  return {type: "SET_PATHS", paths, groupLayers, strokeLayers, selectedGroupLayers: new Set(groupLayers), selectedStrokeLayers: new Set(strokeLayers), layerMode};
};