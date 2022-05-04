import {flattenSVG} from "flatten-svg";
import { Vec2 } from "../vec";

function withSVG<T>(svgString: string, fn: (svg: SVGSVGElement) => T): T {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.left = "99999px";
  document.body.appendChild(div);
  try {
    div.innerHTML = svgString;
    const svg = div.querySelector("svg") as SVGSVGElement;
    return fn(svg);
  } finally {
    div.remove();
  }
}

export function readSvg(svgString: string): Vec2[][] {
  return withSVG(svgString, flattenSVG).map((line) => {
    const a = line.points.map(([x, y]: [number, number]) => ({x, y}));
    (a as any).stroke = line.stroke;
    (a as any).groupId = line.groupId;
    return a;
  });
}
