import type { Plan } from "../planning";

export interface DeviceInfo {
  path: string;
}

export interface Driver {
  onprogress: (motionIdx: number) => void | null;
  oncancelled: () => void | null;
  onfinished: () => void | null;
  ondevinfo: (devInfo: DeviceInfo) => void | null;
  onpause: (paused: boolean) => void | null;
  onconnectionchange: (connected: boolean) => void | null;
  onplan: (plan: Plan) => void | null;

  plot(plan: Plan): void;

  cancel(immediate?: boolean): void;
  pause(): void;
  resume(): void;
  setPenHeight(height: number, rate: number): void;
  limp(): void;

  goHome(penUpHeight?: number, penUpRate?: number): void;

  name(): string;
  close(): Promise<void>;
}
