export type ConnectionType = "bluetooth" | "usb";

type Props = {
  onConnectBluetooth: () => void;
  onConnectUsb: () => void;
  onDisconnect: () => void;
  isConnected: boolean;
  connectionType: ConnectionType | null;
};

export default function Connect({
  onConnectBluetooth,
  onConnectUsb,
  onDisconnect,
  isConnected,
  connectionType,
}: Props) {
  if (isConnected) {
    return (
      <div className="connection-status">
        <span className="connected-badge">
          {connectionType === "usb" ? "USB" : "BLE"} Connected
        </span>
        <button onClick={onDisconnect} className="action disconnect">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="connection-buttons">
      <button onClick={onConnectUsb} className="action usb">
        USB
      </button>
      <button onClick={onConnectBluetooth} className="action bluetooth">
        Bluetooth
      </button>
    </div>
  );
}
