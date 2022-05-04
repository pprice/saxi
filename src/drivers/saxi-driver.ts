import { Plan } from "../planning";
import type { Driver, DeviceInfo } from "./driver";

export class SaxiDriver implements Driver {

  public static connect(): Driver {
    const d = new SaxiDriver();
    d.connect();
    return d;
  }

  public onprogress: (motionIdx: number) => void | null;
  public oncancelled: () => void | null;
  public onfinished: () => void | null;
  public ondevinfo: (devInfo: DeviceInfo) => void | null;
  public onpause: (paused: boolean) => void | null;
  public onconnectionchange: (connected: boolean) => void | null;
  public onplan: (plan: Plan) => void | null;

  private socket: WebSocket;
  private connected: boolean;
  private pingInterval: number;

  public name() {
    return 'Saxi Server'
  }

  public close() {
    this.socket.close()
    return Promise.resolve()
  }

  public connect() {

    console.log("Creating new connection...")

    const websocketProtocol = document.location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${websocketProtocol}://${document.location.host}/chat`);
    
    this.socket.addEventListener("open", () => {
      console.log(`Connected to EBB server.`);
      this.connected = true;
      if (this.onconnectionchange) {
        this.onconnectionchange(true);
      }
      this.pingInterval = window.setInterval(() => this.ping(), 30000);
    });
    this.socket.addEventListener("message", (e: MessageEvent) => {
      if (typeof e.data === "string") {
        const msg = JSON.parse(e.data);
        switch (msg.c) {
          case "pong": {
            // nothing
          } break;
          case "progress": {
            if (this.onprogress != null) {
              this.onprogress(msg.p.motionIdx);
            }
          } break;
          case "cancelled": {
            if (this.oncancelled != null) {
              this.oncancelled();
            }
          } break;
          case "finished": {
            if (this.onfinished != null) {
              this.onfinished();
            }
          } break;
          case "dev": {
            if (this.ondevinfo != null) {
              this.ondevinfo(msg.p);
            }
          } break;
          case "pause": {
            if (this.onpause != null) {
              this.onpause(msg.p.paused)
            }
          } break;
          case "plan": {
            if (this.onplan != null) {
              this.onplan(Plan.deserialize(msg.p.plan))
            }
          } break;
          default: {
            console.log("Unknown message from server:", msg);
          } break;
        }
      }
    });
    this.socket.addEventListener("error", () => {
      // TODO: something
    });
    this.socket.addEventListener("close", () => {
      console.log(`Disconnected from EBB server, reconnecting in 5 seconds.`);
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
      this.connected = false;
      if (this.onconnectionchange) { this.onconnectionchange(false); }
      this.socket = null;
      setTimeout(() => this.connect(), 5000);
    });
  }

  private objectToJson<T>(obj: T) { 
    return new Blob([ JSON.stringify(obj) ], { type: 'application/json' }) 
  }

  public plot(plan: Plan) {
    fetch("/plot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.objectToJson(plan.serialize()),
    });
  }

  public cancel(immediate?: boolean) {
    fetch("/cancel", { 
      method: "POST", 
      body: this.objectToJson({ immediate: immediate ? true : false }) 
    });
  }

  public pause() {
    fetch("/pause", { method: "POST" });
  }

  public resume() {
    fetch("/resume", { method: "POST" });
  }

  public send(msg: object) {
    if (!this.connected) {
      throw new Error(`Can't send message: not connected`);
    }
    this.socket.send(JSON.stringify(msg));
  }

  public setPenHeight(height: number, rate: number) {
    this.send({ c: "setPenHeight", p: {height, rate} });
  }

  public goHome(penUpHeight?: number, penUpRate?: number): void {
    this.send({ c: "goHome", p: { penUpHeight, penUpRate } });
  }

  public limp() { this.send({ c: "limp" }); }
  public ping() { this.send({ c: "ping" }); }
}