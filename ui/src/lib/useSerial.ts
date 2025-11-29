import * as React from "react";
import Message, { messageSchema, Mode } from "../types/Message";

export interface Serial {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  setDeviceMode: (mode: Mode) => Promise<void>;
}

export const useSerial = (eventHandler: (x: Message) => void): Serial => {
  const [isConnected, setIsConnected] = React.useState(false);
  const portRef = React.useRef<SerialPort | null>(null);
  const readerRef = React.useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const eventHandlerRef = React.useRef<(x: Message) => void>();

  React.useEffect(() => {
    eventHandlerRef.current = eventHandler;
  });

  const connect = async () => {
    try {
      // Request a port and open a connection
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      portRef.current = port;
      setIsConnected(true);

      // Start reading from the port
      readLoop(port);
    } catch (e) {
      console.error("Serial connection error:", e);
      setIsConnected(false);
    }
  };

  const readLoop = async (port: SerialPort) => {
    const decoder = new TextDecoder();
    let buffer = "";

    while (port.readable) {
      const reader = port.readable.getReader();
      readerRef.current = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (JSON messages end with newline)
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith("{") && trimmedLine.endsWith("}")) {
                try {
                  const data = messageSchema.parse(JSON.parse(trimmedLine));
                  eventHandlerRef.current && eventHandlerRef.current(data);
                } catch (parseError) {
                  // Not a valid JSON message, ignore (could be debug output)
                  console.log("Serial (non-JSON):", trimmedLine);
                }
              } else if (trimmedLine) {
                console.log("Serial:", trimmedLine);
              }
            }
          }
        }
      } catch (error) {
        console.error("Serial read error:", error);
      } finally {
        reader.releaseLock();
      }
    }

    setIsConnected(false);
    portRef.current = null;
  };

  const disconnect = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch (e) {
      console.error("Serial disconnect error:", e);
    }
    setIsConnected(false);
  };

  const setDeviceMode = async (mode: Mode) => {
    if (!portRef.current || !portRef.current.writable) {
      console.error("Serial port not writable");
      return;
    }

    const writer = portRef.current.writable.getWriter();
    try {
      const command = mode === Mode.SINGLE_POINT ? "MODE:1\n" : "MODE:2\n";
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(command));
    } finally {
      writer.releaseLock();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return { setDeviceMode, connect, disconnect, isConnected };
};
