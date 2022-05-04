import { EBB } from "../ebb";
import { Device, Motion } from "../planning";
import { setTimeout } from 'timers/promises';
import { off } from "process";
import { runInThisContext } from "vm";

export interface Plotter {
  prePlot: (initialPenHeight: number) => Promise<void>;
  executeMotion: (m: Motion, progress: [number, number]) => Promise<void>;
  preCancel: (immediate?: boolean) => Promise<void>;
  postCancel: (immediate?: boolean) => Promise<void>;
  postPlot: () => Promise<void>;
}

export class RealPlotter implements Plotter { 
  constructor(private factory: () => EBB | null) { 

  }

  public get ebb() { 
    return this.factory();
  }

  async prePlot(initialPenHeight: number): Promise<void> {
    await this.ebb.enableMotors(2);
    await this.ebb.setPenHeight(initialPenHeight, 1000, 1000);
  }

  async executeMotion(motion: Motion, _progress: [number, number]): Promise<void> {
    await this.ebb.executeMotion(motion);
  }

  async preCancel(immediate?: boolean) : Promise<void> { 
    if(immediate) { 
      await this.ebb.stop();
    }
  }

  async postCancel(): Promise<void> {
    await this.ebb.setPenHeight(Device.Axidraw.penPctToPos(0), 1000);
  }

  async postPlot(): Promise<void> {
    await this.ebb.goHome();
    await this.ebb.waitUntilMotorsIdle();
    await this.ebb.disableMotors();
  }
}

export class SimPlotter implements Plotter { 

  private abort : AbortController | undefined;

  prePlot(_initialPenHeight: number): Promise<void> {
    this.abort = new AbortController();
    return Promise.resolve();
  }

  async executeMotion(motion: Motion, progress: [number, number]): Promise<void> {
    console.log(`Motion ${progress[0] + 1}/${progress[1]}`);

    this.abort = new AbortController();
    await setTimeout(motion.duration() * 1000, null, { signal: this.abort?.signal })
  }

  async preCancel(immediate?: boolean): Promise<void> {
    if(immediate) {
      console.log(`Aborting simulated plot`)
      this.abort?.abort();
    }
    else { 
      console.log(`Canceling simulated plot`);
    }
  }

  postCancel() { 
    return Promise.resolve();
  }

  postPlot(): Promise<void> {
    this.abort = undefined;
    return Promise.resolve();
  }
}