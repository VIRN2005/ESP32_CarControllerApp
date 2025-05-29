import {useState, useEffect, useCallback} from 'react';
import {BleManager, Device, State} from 'react-native-ble-plx';
import {PermissionsAndroid, Platform} from 'react-native';

const useBluetooth = () => {
  const [manager] = useState<BleManager>(() => new BleManager());
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        
        return (
          granted['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (error) {
        console.error('Permission error:', error);
        return false;
      }
    }
    return true;
  };

  const scanDevices = useCallback(async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      console.log('Bluetooth permissions not granted');
      return;
    }

    setIsScanning(true);
    setDevices([]);

    const subscription = manager.onStateChange((state: State) => {
      if (state === 'PoweredOn') {
        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            setIsScanning(false);
            subscription.remove();
            return;
          }

          if (device?.name) {
            setDevices(prevDevices => {
              const deviceExists = prevDevices.some(d => d.id === device.id);
              return deviceExists ? prevDevices : [...prevDevices, device];
            });
          }
        });

        setTimeout(() => {
          manager.stopDeviceScan();
          subscription.remove();
          setIsScanning(false);
        }, 5000);
      }
    }, true);
  }, [manager]);

  const connectToDevice = async (device: Device): Promise<boolean> => {
    if (!device) return false;
    
    setIsConnecting(true);
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectDevice = async (): Promise<void> => {
    if (!connectedDevice) return;
    
    try {
      await connectedDevice.cancelConnection();
    } catch (error) {
      console.error('Disconnection error:', error);
    } finally {
      setConnectedDevice(null);
    }
  };

  const sendCommand = async (command: string): Promise<void> => {
    if (!connectedDevice) {
      console.warn('No device connected');
      return;
    }

    console.log(`Sending command: ${command}`);
    // Implementación real necesitaría:
    // 1. El UUID del servicio Bluetooth del ESP32
    // 2. El UUID de la característica para enviar comandos
    // Ejemplo:
    /*
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        Base64.encode(command)
      );
    } catch (error) {
      console.error('Failed to send command:', error);
    }
    */
  };

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  return {
    devices,
    connectedDevice,
    isScanning,
    isConnecting,
    scanDevices,
    connectToDevice,
    disconnectDevice,
    sendCommand,
  };
};

export default useBluetooth;