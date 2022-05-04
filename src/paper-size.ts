import {Vec2, vmul} from "./vec";

export class PaperSize {

  private static vround(v: Vec2, digits: number = 2): Vec2 {
    return { x: Number(v.x.toFixed(digits)), y: Number(v.y.toFixed(digits)) };
  }

  private static INCH_TO_MM = 25.4;

  private static fromInches(v: Vec2) : PaperSize { 
    return new PaperSize(PaperSize.vround(vmul(v, PaperSize.INCH_TO_MM)));
  }

  private static fromMillimeters(v: Vec2) { 
    return new PaperSize(v);
  }

  public get landscape(): PaperSize {
    return new PaperSize({
      x: Math.max(this.size.x, this.size.y),
      y: Math.min(this.size.x, this.size.y),
    });
  }

  public get portrait(): PaperSize {
    return new PaperSize({
      x: Math.min(this.size.x, this.size.y),
      y: Math.max(this.size.x, this.size.y),
    });
  }

  public get isLandscape(): boolean {
    return this.size.x === Math.max(this.size.x, this.size.y);
  }

  public static standard: Record<string, PaperSize> = {
    "USLetter": PaperSize.fromInches({x: 8.5, y: 11}),
    "USLegal": PaperSize.fromInches({x: 8.5, y: 14}),
    "ArchA": PaperSize.fromInches({x: 9, y: 12}),
    "A3": PaperSize.fromMillimeters({x: 297, y: 420}),
    "A4": PaperSize.fromMillimeters({x: 210, y: 297}),
    "A5": PaperSize.fromMillimeters({x: 148, y: 210}),
    "A6": PaperSize.fromMillimeters({x: 105, y: 148}),
    "6x8": PaperSize.fromInches({x: 6, y: 8}),
    "5x7": PaperSize.fromInches({x: 5, y: 7}),
    "11x14": PaperSize.fromInches({x: 11, y: 14}),
  };

  public readonly size: Vec2;
  
  public constructor(size: Vec2) {
    this.size = size;
  }
}
