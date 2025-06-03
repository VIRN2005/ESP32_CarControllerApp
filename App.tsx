/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {BleManager, Device, State} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import styles from './src/styles/styles';
import LinearGradient from 'react-native-linear-gradient';
import MotionGradientBackground from './src/assets/MotionGradientBackground';


// Tipos mejorados para TypeScript
interface BluetoothDevice {
  id: string;
  name: string;
  address?: string;
  lastSeen?: string;
  deviceType?: string;
  icon?: string;
}

type ControlMode = 'buttons' | 'joystick';
type DirectionCommand = 'F' | 'B' | 'L' | 'R' | 'S';
type SpeedCommand = `SPEED:${number}`;

// Paleta de colores verde elegante
const colors = {
  primary: '#2E7D32',
  primaryLight: '#81C784',
  primaryDark: '#1B5E20',
  secondary: '#AED581',
  background: '#E8F5E9',
  surface: '#FFFFFF',
  accent: '#4CAF50',
  error: '#C62828',
  text: '#212121',
  textSecondary: '#757575',
  white: '#FFFFFF',
};
// UUIDs del servicio y característica
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// Constantes
const SCAN_DURATION = 5000; // 5 segundos
const MIN_SPEED = 100;
const MAX_SPEED = 255;
const SPEED_INCREMENT = 20;

const prueba = true;

const App = () => {
  const [controlMode, setControlMode] = useState<ControlMode>('buttons');
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  //para editar vista
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(
    prueba
      ? ({ id: 'dev', name: 'ESP32-Simulado' } as Device)
      : null
  )
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(!prueba && false);
  const [pulseAnim] = useState(new Animated.Value(1));

  const bleManager = useRef<BleManager>(new BleManager()).current;
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceConnectionRef = useRef<Device | null>(null);

  const { width, height } = useWindowDimensions();

  // Verificar estado del Bluetooth al iniciar y configurar listeners
  useEffect(() => {
    const subscription = bleManager.onStateChange((state: State) => {
      const isEnabled = state === 'PoweredOn';
      setBluetoothEnabled(isEnabled);
      console.log('Estado Bluetooth cambiado:', state);

      if (!isEnabled && connectedDevice) {
        // Si Bluetooth se apaga mientras estamos conectados
        setConnectedDevice(null);
        deviceConnectionRef.current = null;
        Alert.alert(
          'Bluetooth Desactivado',
          'Se ha perdido la conexión porque el Bluetooth fue desactivado',
        );
      }
    }, true);

    return () => {
      subscription.remove();
      bleManager.destroy();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (deviceConnectionRef.current) {
        deviceConnectionRef.current.cancelConnection().catch(() => {});
      }
    };
  }, [bleManager, connectedDevice]);

  // Animación de pulso para botones
  const animatePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.05,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseAnim]);

  // Método para verificar el estado del Bluetooth
  const checkBluetoothStatus = useCallback(async (): Promise<boolean> => {
    try {
      const state = await bleManager.state();
      const isEnabled = state === 'PoweredOn';
      setBluetoothEnabled(isEnabled);
      console.log('Bluetooth habilitado:', isEnabled);
      return isEnabled;
    } catch (error) {
      console.error('Error verificando estado de Bluetooth:', error);
      setBluetoothEnabled(false);
      return false;
    }
  }, [bleManager]);

  // Solicitar permisos de Bluetooth en Android
  const requestBluetoothPermissions =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        return true; // En iOS no necesitamos estos permisos específicos
      }

      try {
        console.log('Solicitando permisos de Android...');

        let permissions;
        if (Number(Platform.Version) >= 31) {
          permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
        } else {
          permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log('Permisos concedidos:', granted);

        return Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED,
        );
      } catch (error) {
        console.error('Error solicitando permisos:', error);
        return false;
      }
    }, []);

  // Método para escanear dispositivos BLE
  const scanDevices = useCallback(async () => {
    if (isScanning) return;

    setIsScanning(true);
    setDevices([]);

    try {
      console.log('Iniciando escaneo de dispositivos BLE...');

      // Verificar si Bluetooth está habilitado
      const isEnabled = await checkBluetoothStatus();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Desactivado',
          'Por favor activa el Bluetooth para continuar',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => setIsScanning(false),
            },
            {
              text: 'Activar',
              onPress: () => {
                Alert.alert(
                  'Activar Bluetooth',
                  'Por favor activa el Bluetooth manualmente en Configuración',
                  [{text: 'OK'}],
                );
              },
            },
          ],
        );
        return;
      }

      // Solicitar permisos
      const permissionsGranted = await requestBluetoothPermissions();
      if (!permissionsGranted) {
        setIsScanning(false);
        Alert.alert(
          'Permisos Requeridos',
          'La aplicación necesita permisos de Bluetooth y ubicación para funcionar correctamente.',
          [{text: 'OK'}],
        );
        return;
      }

      // Escanear dispositivos
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Error en escaneo:', error);
          setIsScanning(false);
          bleManager.stopDeviceScan();
          return;
        }

        if (device?.name || device?.localName) {
          setDevices(prevDevices => {
            // Evitar duplicados
            const deviceExists = prevDevices.some(d => d.id === device.id);
            if (!deviceExists) {
              return [
                ...prevDevices,
                {
                  id: device.id,
                  name:
                    device.name ||
                    device.localName ||
                    'Dispositivo Desconocido',
                  address: device.id,
                  lastSeen: new Date().toISOString(),
                  deviceType: 'ble',
                  icon: getDeviceIcon(device.name || device.localName || ''),
                },
              ];
            }
            return prevDevices;
          });
        }
      });

      // Detener el escaneo después del tiempo definido
      scanTimeoutRef.current = setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsScanning(false);

        if (devices.length === 0) {
          Alert.alert(
            'No hay dispositivos',
            'No se encontraron dispositivos BLE.\n\nPara conectar tu ESP32:\n1. Asegúrate que esté encendido\n2. Que sea visible/discoverable',
            [
              {
                text: 'OK',
              },
              {
                text: 'Buscar nuevamente',
                onPress: () => scanDevices(),
              },
            ],
          );
        }
      }, SCAN_DURATION);
    } catch (error: any) {
      console.error('Error en scanDevices:', error);
      handleBluetoothError(error);
      setIsScanning(false);
    }
  }, [
    bleManager,
    checkBluetoothStatus,
    isScanning,
    requestBluetoothPermissions,
    devices.length,
  ]);

  // Función auxiliar para obtener icono del dispositivo
  const getDeviceIcon = (deviceName: string): string => {
    if (!deviceName) return '📱';
    const lowerName = deviceName.toLowerCase();
    if (lowerName.includes('esp')) return '🚗';
    if (lowerName.includes('hc')) return '📡';
    return '📱';
  };

  // Manejo de errores de Bluetooth
  const handleBluetoothError = (error: any) => {
    let errorMessage = 'Error desconocido al buscar dispositivos';
    let errorTitle = 'Error de Bluetooth';

    if (error.message) {
      if (
        error.message.includes('not enabled') ||
        error.message.includes('disabled')
      ) {
        errorTitle = 'Bluetooth Desactivado';
        errorMessage = 'Por favor activa el Bluetooth e inténtalo de nuevo';
      } else if (
        error.message.includes('permission') ||
        error.message.includes('denied')
      ) {
        errorTitle = 'Permisos Insuficientes';
        errorMessage =
          'La aplicación necesita permisos de Bluetooth para continuar. Ve a Configuración > Aplicaciones > Permisos';
      } else if (
        error.message.includes('not available') ||
        error.message.includes('not supported')
      ) {
        errorTitle = 'Bluetooth No Disponible';
        errorMessage =
          'Este dispositivo no soporta Bluetooth o no está disponible';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }

    Alert.alert(errorTitle, errorMessage, [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Reintentar',
        onPress: () => scanDevices(),
      },
    ]);
  };

  // Método para conectar a dispositivo BLE
  const connectToDevice = useCallback(
    async (device: BluetoothDevice) => {
      if (!device?.id || isConnecting) return;

      setIsConnecting(true);

      try {
        console.log(`Intentando conectar a ${device.name} (${device.id})`);

        // Verificar que Bluetooth esté habilitado antes de conectar
        const isEnabled = await checkBluetoothStatus();
        if (!isEnabled) {
          Alert.alert('Error', 'Bluetooth no está habilitado');
          setIsConnecting(false);
          return;
        }

        // Intentar conexión con timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de conexión')), 10000),
        );

        const connectionPromise = bleManager.connectToDevice(device.id, {
          autoConnect: false,
          requestMTU: 128,
        });

        const connectedDevice = (await Promise.race([
          connectionPromise,
          timeoutPromise,
        ])) as Device;
        deviceConnectionRef.current = connectedDevice;

        // Descubrir servicios y características
        await connectedDevice.discoverAllServicesAndCharacteristics();

        setConnectedDevice(connectedDevice);
        setShowBluetoothModal(false);

        Alert.alert(
          '¡Conectado!',
          `Control remoto conectado exitosamente a ${device.name}`,
          [{text: 'OK'}],
        );

        console.log(`Conectado exitosamente a ${device.name}`);

        // Escuchar desconexiones
        connectedDevice.onDisconnected(() => {
          console.log('Dispositivo desconectado');
          handleDisconnection();
        });
      } catch (error: any) {
        console.error('Error conectando dispositivo:', error);
        handleConnectionError(error, device);
      } finally {
        setIsConnecting(false);
      }
    },
    [bleManager, checkBluetoothStatus, isConnecting],
  );

  // Manejo de errores de conexión
  const handleConnectionError = (error: any, device: BluetoothDevice) => {
    let errorMessage = 'No se pudo conectar al dispositivo';
    if (error.message) {
      if (
        error.message.includes('timeout') ||
        error.message.includes('Timeout')
      ) {
        errorMessage =
          'Tiempo de conexión agotado. Asegúrate de que el dispositivo esté cerca y encendido.';
      } else if (error.message.includes('not found')) {
        errorMessage =
          'Dispositivo no encontrado. Verifica que esté encendido y en rango.';
      } else {
        errorMessage = `Error de conexión: ${error.message}`;
      }
    }

    Alert.alert('Error de Conexión', errorMessage, [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Reintentar',
        onPress: () => connectToDevice(device),
      },
    ]);
  };

  // Manejo de desconexión
  const handleDisconnection = useCallback(() => {
    setConnectedDevice(null);
    deviceConnectionRef.current = null;
    Alert.alert('Desconectado', 'El dispositivo se ha desconectado');
  }, []);

  // Enviar comando al dispositivo
  const handleCommand = useCallback(
    async (command: DirectionCommand | SpeedCommand) => {
      animatePulse();

      if (!connectedDevice || !deviceConnectionRef.current) {
        Alert.alert(
          'Conectar Dispositivo',
          'Por favor conecta tu carrito primero',
          [
            {
              text: 'Conectar',
              onPress: () => {
                setShowBluetoothModal(true);
                scanDevices();
              },
              style: 'default',
            },
            {
              text: 'Cancelar',
              style: 'cancel',
            },
          ],
        );
        return;
      }

      console.log(`Comando enviado: ${command}`);

      try {
        // Convertir el comando a un ArrayBuffer
        const buffer = Buffer.from(command, 'utf-8');
        const base64Value = buffer.toString('base64');

        // Escribir en la característica
        await deviceConnectionRef.current.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          base64Value,
        );

        console.log(`Comando ${command} enviado exitosamente`);
      } catch (error) {
        console.error('Error enviando comando:', error);
        Alert.alert('Error', 'No se pudo enviar el comando al dispositivo');

        // Si hay error al enviar comando, asumimos desconexión
        handleDisconnection();
      }
    },
    [animatePulse, connectedDevice, handleDisconnection, scanDevices],
  );

  // Ajustar velocidad
  const adjustSpeed = useCallback(
    async (increment: boolean) => {
      const newSpeed = Math.min(
        MAX_SPEED,
        Math.max(
          MIN_SPEED,
          increment ? speed + SPEED_INCREMENT : speed - SPEED_INCREMENT,
        ),
      );
      setSpeed(newSpeed);
      await handleCommand(`SPEED:${newSpeed}` as SpeedCommand);
    },
    [handleCommand, speed],
  );

  const increaseSpeed = useCallback(() => adjustSpeed(true), [adjustSpeed]);
  const decreaseSpeed = useCallback(() => adjustSpeed(false), [adjustSpeed]);

  const toggleControlMode = useCallback(() => {
    animatePulse();
    setControlMode(prev => (prev === 'buttons' ? 'joystick' : 'buttons'));
  }, [animatePulse]);

  const disconnectDevice = useCallback(async () => {
    try {
      if (deviceConnectionRef.current) {
        await deviceConnectionRef.current.cancelConnection();
      }
      handleDisconnection();
    } catch (error) {
      console.error('Error desconectando:', error);
      handleDisconnection();
    }
  }, [handleDisconnection]);

  const openBluetoothModal = useCallback(() => {
    setShowBluetoothModal(true);
    scanDevices();
  }, [scanDevices]);

const isConnected = prueba || Boolean(connectedDevice);
  return (
     <MotionGradientBackground loopDurationMs={8000} motionOpacity={0.08}>
    
      
        {/* Header elegante */}
        <View style={styles.header}>
         
        <View style={[ connectedDevice?styles.nav: styles.nav_disconnected]}> 
          <LinearGradient colors={['#00ff75', '#005b5d']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.nav_bg} />
               
          <View style={styles.status}> 
            <Image
                  source={require('./src/assets/bluetooth.png')}
                  style={styles.bth_icon}
                  resizeMode="contain"/>
            
              {connectedDevice? (
              <Text style={styles.statusText}>Conectado a:{' '}
                <Text style={styles.deviceName}>{connectedDevice?connectedDevice.name:''}</Text>
              </Text>
              ):(
                <Text style={styles.statusText}>Sin conexión</Text>
              )}
                
          </View>          
              <Text style={styles.headerTitle}>CAR REMOTE CONTROLLER</Text>
        </View>
         {connectedDevice && isConnected ? (
          <>

            {/* Botón de desconexión */}
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={disconnectDevice}>
              <Text style={styles.disconnectButtonText}>
                DESCONECTAR
              </Text>
            </TouchableOpacity>
          </>
        ):
          <>
          </>}
        </View>{/* quitar isConnected */}
        { (connectedDevice && isConnected )? (
        <ImageBackground
                  source={require('./src/assets/bg-box.png')}
                  style={styles.circleBackground}
                  resizeMode="contain"
                >
        <View style={styles.container}>  
           <View style={styles.buttonsContainer}>
            <View style={styles.circularButtonWrapper}>
              <Image
                source={require('./src/assets/bg-button.png')}
                style={styles.circleImage}
                resizeMode="contain"
              />

              <View style={styles.dividerLineL} />

              {/* 3) avanzar */}
              <TouchableOpacity
                onPress={() => handleCommand('F')}
                style={[styles.arrowTouchArea, styles.arrowUp]}
              >
                <Image
                  source={require('./src/assets/arrow-up.png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* 4) Retroceder */}
              <TouchableOpacity
                onPress={() => handleCommand('B')}
                style={[styles.arrowTouchArea, styles.arrowDown]}
              >
                
                <Image
                  source={require('./src/assets/arrow-down.png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                  
                />
              </TouchableOpacity>
            </View>
            <View style= {styles.speedContainer}>
               <Image
                source={require('./src/assets/speedometer.png')}
                style={styles.speedLabel}
                resizeMode="contain"            
              />
              <Text style={styles.speedValue}>
                200
              </Text>
            </View>
              
            {/* derecha */}
            <View style={styles.circularButtonWrapper}>
              <Image
                source={require('./src/assets/bg-button.png')}
                style={styles.circleImage}
                resizeMode="contain"
              />

              <View style={styles.dividerLineR} />

              {/* izquierda*/}
              <TouchableOpacity
                onPress={() => handleCommand('L')}
                style={[styles.arrowTouchArea, styles.arrowLeft]}
              >
                <Image
                  source={require('./src/assets/arrow-left.png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* Right arrow */}
              <TouchableOpacity
                onPress={() => handleCommand('R')}
                style={[styles.arrowTouchArea, styles.arrowRight]}
              >
                <Image
                  source={require('./src/assets/arrow-right.png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
      </View>
       <View style={styles.speedControls}>           
            <View style={styles.speedBarContainer}>
                    <View
                      style={[
                        styles.speedBar,
                        {width: `${(speed / MAX_SPEED) * 100}%`},
                      ]}
                    />
                  </View>
            </View>     
      </ImageBackground>
    ): (
          <View style={styles.connectContainer}>
            <Text style={styles.connectTitle}>🚗 No conectado</Text>
            <Text style={styles.connectMessage}>
              Conéctate a tu carrito ESP32 para comenzar la diversión
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={openBluetoothModal}>
              <Text style={styles.connectButtonText}>
                🔍 BUSCAR DISPOSITIVOS
              </Text>
            </TouchableOpacity>
          </View>
        )}

    {/* Modal de Bluetooth mejorado */}
      {showBluetoothModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📡 Dispositivos Bluetooth</Text>

            {isScanning ? (
              <View style={styles.scanningContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.scanningText}>
                  Buscando dispositivos...
                </Text>
                <Text style={styles.scanningSubtext}>
                  Asegúrate de que tu ESP32 esté encendido
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.devicesList}
                showsVerticalScrollIndicator={false}>
                {devices.length > 0 ? (
                  devices.map((device, index) => (
                    <TouchableOpacity
                      key={device.id || index}
                      style={styles.deviceItem}
                      onPress={() => connectToDevice(device)}
                      disabled={isConnecting}>
                      <View style={styles.deviceIcon}>
                        <Text style={styles.deviceIconText}>
                          {device.icon || '📱'}
                        </Text>
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceNameText}>{device.name}</Text>
                        <Text style={styles.deviceIdText}>{device.id}</Text>
                        {device.lastSeen && (
                          <Text style={styles.deviceLastSeen}>
                            Última vez visto:{' '}
                            {new Date(device.lastSeen).toLocaleTimeString()}
                          </Text>
                        )}
                      </View>
                      {isConnecting && (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noDevicesContainer}>
                    <Text style={styles.noDevicesText}>
                      No se encontraron dispositivos emparejados
                    </Text>
                    <Text style={styles.noDevicesSubtext}>
                      Ve a Configuración → Bluetooth y empareja tu ESP32
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={scanDevices}
                disabled={isScanning}>
                <Text style={styles.scanAgainText}>
                  {isScanning ? 'BUSCANDO...' : '🔄 BUSCAR DE NUEVO'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowBluetoothModal(false)}>
                <Text style={styles.closeModalText}>❌ CERRAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </MotionGradientBackground>
  );
};

export default App;
