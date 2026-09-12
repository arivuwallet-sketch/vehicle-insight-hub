/**
 * Hardware transport layer for ELM327-style OBD adapters.
 * Uses real Web Bluetooth / Web Serial APIs where the browser supports them.
 */

export const ELM327_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
export const ELM327_NOTIFY_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
export const ELM327_WRITE_UUID = "0000fff2-0000-1000-8000-00805f9b34fb";

export const BAUD_RATES = [38400, 115200, 230400, 500000] as const;
export type BaudRate = (typeof BAUD_RATES)[number];

export interface Transport {
  kind: "bluetooth" | "serial";
  label: string;
  send(command: string): Promise<string>;
  close(): Promise<void>;
}

export function bluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function serialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function connectBluetooth(): Promise<Transport> {
  const nav = navigator as any;
  if (!nav.bluetooth) throw new Error("Web Bluetooth is not available in this browser.");

  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: [ELM327_SERVICE_UUID] }, { namePrefix: "OBD" }, { namePrefix: "VEEPEAK" }],
    optionalServices: [ELM327_SERVICE_UUID],
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(ELM327_SERVICE_UUID);
  const notify = await service.getCharacteristic(ELM327_NOTIFY_UUID);
  const write = await service.getCharacteristic(ELM327_WRITE_UUID);

  let buffer = "";
  let resolveLine: ((value: string) => void) | null = null;
  const decoder = new TextDecoder();

  await notify.startNotifications();
  notify.addEventListener("characteristicvaluechanged", (event: any) => {
    buffer += decoder.decode(event.target.value);
    if (buffer.includes(">")) {
      const payload = buffer.replace(/>/g, "").trim();
      buffer = "";
      resolveLine?.(payload);
      resolveLine = null;
    }
  });

  const encoder = new TextEncoder();

  return {
    kind: "bluetooth",
    label: device.name || "BLE OBD adapter",
    async send(command: string) {
      await write.writeValue(encoder.encode(`${command}\r`));
      return new Promise<string>((resolve) => {
        resolveLine = resolve;
        setTimeout(() => {
          if (resolveLine) {
            resolveLine = null;
            resolve("NO DATA");
          }
        }, 4000);
      });
    },
    async close() {
      try {
        await notify.stopNotifications();
      } catch {
        /* ignore */
      }
      device.gatt?.disconnect();
    },
  };
}

export async function connectSerial(baudRate: BaudRate): Promise<Transport> {
  const nav = navigator as any;
  if (!nav.serial) throw new Error("Web Serial is not available in this browser.");

  const port = await nav.serial.requestPort();
  await port.open({ baudRate });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();

  return {
    kind: "serial",
    label: `USB OBD cable @ ${baudRate} baud`,
    async send(command: string) {
      await writer.write(encoder.encode(`${command}\r`));
      let out = "";
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        out += decoder.decode(value);
        if (out.includes(">")) break;
      }
      return out.replace(/>/g, "").trim() || "NO DATA";
    },
    async close() {
      try {
        reader.releaseLock();
        writer.releaseLock();
        await port.close();
      } catch {
        /* ignore */
      }
    },
  };
}
