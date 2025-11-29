import { useContext, useEffect, useState } from "react";
import "./App.css";
import AddSpeed from "./components/AddSpeed";
import Conditional from "./components/Conditional";
import Connect, { ConnectionType } from "./components/Connect";
import DirectionControl from "./components/DirectionControl";
import ModeControl from "./components/ModeControl";
import { Context } from "./components/SettingsContext";
import ShotByShotView from "./components/ShotByShotView";
import ShutterTimingView from "./components/ShutterTimingView";
import SinglePointMeasurements from "./components/SinglePointMeasurements";
import TestShot from "./components/TestShot";
import ThreePointMeasurements from "./components/ThreePointMeasurements";
import { defaultSpeeds } from "./lib/defaults";
import messageHandler from "./lib/internalMessageBus";
import { useBluetooth } from "./lib/useBluetooth";
import { useSerial } from "./lib/useSerial";
import { formatSpeed, sortSpeeds } from "./lib/utils";
import { InternalMessage, InternalMessageType } from "./types/InternalMessage";
import {
  SinglePointMeasurement,
  ThreePointMeasurement,
} from "./types/Measurement";
import Message, { MetadataMessage, Mode } from "./types/Message";
import ShutterDirection from "./types/ShutterDirection";
import { ViewMode } from "./types/ViewMode";

const isDemo = (): boolean =>
  new URLSearchParams(window.location.search).get("demo") === "true";

function App() {
  const { settings, setSettings } = useContext(Context);
  const [speeds, setSpeeds] = useState(defaultSpeeds);
  const [selectedSpeed, setSelectedSpeed] = useState(speeds[0]);

  const removeSpeed = (speed: string) => {
    setSpeeds(speeds.filter((existingSpeed) => existingSpeed !== speed));
  };

  const addSpeed = (speed: string) => {
    setSpeeds([...speeds, formatSpeed(speed)].sort(sortSpeeds));
  };

  const reset = () => {
    messageHandler.emit({ type: InternalMessageType.Reset });
  };

  const handleMetadataMessage = (_: MetadataMessage) => {};

  const updateShutterDirection = (message: ThreePointMeasurement) => {
    if(settings.shutterDirection === ShutterDirection.Auto){
      if(message.sensor1.open < message.sensor3.open){
        setSettings({...settings, shutterDirection: ShutterDirection.Vertical})
      }else{
        setSettings({...settings, shutterDirection: ShutterDirection.Horizontal})
      }
    }
  }

  const handleMessage = ({ type, ...measurement }: Message) => {
    console.log({ type, ...measurement });
    if (type === "metadata") {
      handleMetadataMessage({ type, ...measurement } as MetadataMessage);
    } else if (type === "single_point") {
      messageHandler.emit({
        type: InternalMessageType.SinglePointMeasurement,
        data: measurement as SinglePointMeasurement,
      });
    } else {
      updateShutterDirection(measurement as ThreePointMeasurement)
      messageHandler.emit({
        type: InternalMessageType.ThreePointMeasurement,
        data: measurement as ThreePointMeasurement,
      });
    }
  };

  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);

  const bluetooth = useBluetooth(handleMessage);
  const serial = useSerial(handleMessage);

  const isConnected = bluetooth.isConnected || serial.isConnected;

  const setMode = (mode: ViewMode) => {
    const deviceMode = [ViewMode.THREE_POINT, ViewMode.SHUTTER_TIMING].includes(mode)
      ? Mode.THREE_POINT
      : Mode.SINGLE_POINT;

    if (bluetooth.isConnected) {
      bluetooth.setDeviceMode(deviceMode);
    } else if (serial.isConnected) {
      serial.setDeviceMode(deviceMode);
    }
  };

  const connectBluetooth = () => {
    bluetooth.subscribe();
    setConnectionType("bluetooth");
  };

  const connectUsb = () => {
    serial.connect();
    setConnectionType("usb");
  };

  const disconnect = () => {
    if (serial.isConnected) {
      serial.disconnect();
    }
    setConnectionType(null);
  };

  useEffect(() => {
    const handleSelectSpeed = (message: InternalMessage) => {
      if (message.type !== InternalMessageType.SelectSpeed) {
        return;
      }
      setSelectedSpeed(message.data);
    };

    messageHandler.on(InternalMessageType.SelectSpeed, handleSelectSpeed);

    return () => {
      messageHandler.off(InternalMessageType.SelectSpeed, handleSelectSpeed);
    };
  }, []);

  return (
    <>
      <header>
        <div className="connect">
          <DirectionControl />
          <ModeControl onChange={setMode} />
          <AddSpeed onAddSpeed={addSpeed} />
          <div className="control">
            <button onClick={reset}>Reset data</button>
          </div>
          {isDemo() ? (
            <TestShot
              onClick={handleMessage}
              selectedSpeed={selectedSpeed}
              mode={settings.mode}
            />
          ) : (
            <Connect
              onConnectBluetooth={connectBluetooth}
              onConnectUsb={connectUsb}
              onDisconnect={disconnect}
              isConnected={isConnected}
              connectionType={connectionType}
            />
          )}
        </div>
        <h1>
          <span className="icon">📷</span> Shutter Tester
        </h1>
      </header>
      <Conditional display={settings.mode === ViewMode.THREE_POINT}>
        <ThreePointMeasurements onRemoveSpeed={removeSpeed} speeds={speeds} />
      </Conditional>
      <Conditional display={settings.mode === ViewMode.SINGLE_POINT}>
        <SinglePointMeasurements onRemoveSpeed={removeSpeed} speeds={speeds} />
      </Conditional>
      <Conditional display={settings.mode === ViewMode.SHUTTER_TIMING}>
        <ShutterTimingView />
      </Conditional>
      <Conditional display={settings.mode === ViewMode.SHOT_BY_SHOT}>
        <ShotByShotView />
      </Conditional>
    </>
  );
}

export default App;
