import {EBB} from "../ebb";
import SerialPort from "serialport";
import MockBinding from "@serialport/binding-mock";
import { SerialPortSerialPort } from "../serialport-serialport";

// (() => {
//   let oldBinding: any;
//   beforeAll(() => {
//     oldBinding = SerialPort.Binding;
//     SerialPort.Binding = MockBinding.createPort();
//   });
//   afterAll(() => {
//     SerialPort.Binding = oldBinding;
//     MockBinding.reset();
//   });
// })();

describe("EBB", () => {
  afterEach(() => {
    MockBinding.reset();
  })

  type TestPort = SerialPortSerialPort & {
    binding: SerialPort.BaseBinding & {
      recording: Buffer;
      emitData: (data: Buffer) => void;
    };
  };

  async function openTestPort(path = '/dev/ebb'): Promise<TestPort> {
    MockBinding.createPort(path, {record: true});
    const port = new SerialPortSerialPort(path, MockBinding as any);
    await port.open({ baudRate: 9600 });
    return port as TestPort;
  }

  it("firmware version", async () => {
    const port = await openTestPort();
    const ebb = new EBB(port);
    
    port.binding.emitData(Buffer.from('aoeu\r\n'));
    expect(await ebb.firmwareVersion()).toEqual('aoeu');
    expect(port.binding.recording).toEqual(Buffer.from("V\r"));
  })

  it("enable motors", async () => {
    const port = await openTestPort();
    const ebb = new EBB(port);
    const oldWrite = port.serialPort.write;
    port.serialPort.write = (data: string | Buffer | number[], ...args: any[]) => {
      if (data.toString().startsWith('V\r')) {
        port.binding.emitData(Buffer.from('test 2.5.3\r\n'))
      }
      return oldWrite.apply(port.serialPort, [data, ...args])
    }
    port.binding.emitData(Buffer.from('OK\r\n'));
    await ebb.enableMotors(2);
    expect(port.binding.recording).toEqual(Buffer.from("EM,2,2\rV\r"));
  })
})
