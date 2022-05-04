import { EBB } from "../ebb";
import { Device, PenMotion, Plan } from "../planning";
import type { DeviceInfo, Driver } from "./driver";

export class WebSerialDriver implements Driver {
  public onprogress: (motionIdx: number) => void;
  public oncancelled: () => void;
  public onfinished: () => void;
  public ondevinfo: (devInfo: DeviceInfo) => void;
  public onpause: (paused: boolean) => void;
  public onconnectionchange: (connected: boolean) => void;
  public onplan: (plan: Plan) => void;

  private _unpaused: Promise<void> = null;
  private _signalUnpause: () => void = null;
  private _cancelRequested: boolean = false;

  public static async connect(port?: SerialPort) {
    if (!port)
      port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x04D8, usbProductId: 0xFD92 }] })
    // baudRate ref: https://github.com/evil-mad/plotink/blob/a45739b7d41b74d35c1e933c18949ed44c72de0e/plotink/ebb_serial.py#L281
    // (doesn't specify baud rate)
    // and https://pyserial.readthedocs.io/en/latest/pyserial_api.html#serial.Serial.__init__
    // (pyserial defaults to 9600)
    await port.open({ baudRate: 9600 })
    const { usbVendorId, usbProductId } = port.getInfo()
    return new WebSerialDriver(new EBB(port), `${usbVendorId.toString(16).padStart(4, '0')}:${usbProductId.toString(16).padStart(4, '0')}`)
  }

  private _name: string
  public name(): string {
    return this._name
  }

  private ebb: EBB
  private constructor(ebb: EBB, name: string) {
    this.ebb = ebb
    this._name = name
  }

  public close(): Promise<void> {
    return this.ebb.close()
  }

  public async plot(plan: Plan): Promise<void> {
    const microsteppingMode = 2
    this._unpaused = null;
    this._cancelRequested = false;
    await this.ebb.enableMotors(microsteppingMode);

    let motionIdx = 0
    let penIsUp = true;
    for (const motion of plan.motions) {
      if (this.onprogress) this.onprogress(motionIdx)
      await this.ebb.executeMotion(motion);
      if (motion instanceof PenMotion) {
        penIsUp = motion.initialPos < motion.finalPos;
      }
      if (this._unpaused && penIsUp) {
        await this._unpaused
        if (this.onpause) this.onpause(false)
      }
      if (this._cancelRequested) { break; }
      motionIdx += 1
    }

    if (this._cancelRequested) {
      await this.ebb.setPenHeight(Device.Axidraw.penPctToPos(0), 1000);
      if (this.oncancelled) this.oncancelled()
    } else {
      if (this.onfinished) this.onfinished()
    }

    await this.ebb.waitUntilMotorsIdle();
    await this.ebb.disableMotors();
  }

  public cancel(immediate?: boolean): void {

    if(immediate) {
      this.ebb.stop();
    }

    this._cancelRequested = true
  }

  public pause(): void {
    this._unpaused = new Promise(resolve => {
      this._signalUnpause = resolve
    })
    if (this.onpause) this.onpause(true)
  }

  public resume(): void {
    const signal = this._signalUnpause
    this._unpaused = null
    this._signalUnpause = null
    signal()
  }

  public async setPenHeight(height: number, rate: number): Promise<void> {
    if (await this.ebb.supportsSR()) {
      await this.ebb.setServoPowerTimeout(10000, true)
    }
    await this.ebb.setPenHeight(height, rate)
  }

  public limp(): void {
    this.ebb.disableMotors()
  }

  public stop(): void { 
    this.ebb.stop();
  }

  public async goHome(penUpHeight?: number, penUpRate?: number): Promise<void> { 
    if(penUpHeight && penUpRate) { 
      await this.setPenHeight(penUpHeight, penUpRate);
    }

    await this.ebb.goHome(undefined);
  }
}