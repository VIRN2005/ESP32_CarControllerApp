import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {BleManager, Device, State} from 'react-native-ble-plx';
import {Buffer} from 'buffer';

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
  primary: '#00FFFF', // Cyan eléctrico
  primaryLight: '#64FFDA', // Aqua brillante
  primaryDark: '#00BCD4', // Cyan profundo
  secondary: '#FF1744', // Rojo neón
  background: '#0A0A0A', // Negro profundo
  surface: '#1A1A2E', // Azul oscuro
  accent: '#E91E63', // Rosa eléctrico
  error: '#FF073A', // Rojo intenso
  success: '#00E676', // Verde neón
  warning: '#FFD600', // Amarillo eléctrico
  text: '#FFFFFF', // Blanco puro
  textSecondary: '#B0BEC5', // Gris claro
  white: '#FFFFFF',
  neonGlow: '#00FFFF',
  purpleNeon: '#9C27B0',
  orangeNeon: '#FF6D00',
};

// UUIDs del servicio y característica
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// Constantes
const SCAN_DURATION = 5000; // 5 segundos
const MIN_SPEED = 100;
const MAX_SPEED = 255;
const SPEED_INCREMENT = 20;

const App = () => {
  const [controlMode, setControlMode] = useState<ControlMode>('buttons');
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  const bleManager = useRef<BleManager>(new BleManager()).current;
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceConnectionRef = useRef<Device | null>(null);

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

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient}>
        <View style={styles.animatedBackground}>
          <View style={[styles.floatingOrb, styles.orb1]} />
          <View style={[styles.floatingOrb, styles.orb2]} />
          <View style={[styles.floatingOrb, styles.orb3]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.headerGlow}>
              <Text style={styles.headerTitle}>⚡ CAR REMOTE⚡</Text>
              <Text style={styles.headerSubtitle}>ESP32 REMOTER CAR CONTROLLER</Text>
              <View style={styles.headerLine} />
              <View style={styles.bluetoothStatus}>
                <View style={styles.statusIndicator}>
                  <Text style={styles.bluetoothStatusText}>
                    BLUETOOTH: {bluetoothEnabled ? '🟢 ONLINE' : '🔴 OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {connectedDevice ? (
            <>
              {/* Panel de estado futurista */}
              <View style={styles.statusPanel}>
                <View style={styles.hologramEffect}>
                  <Text style={styles.statusTitle}>🎯 DEVICE LOCKED</Text>
                  <Text style={styles.deviceName}>
                    TARGET: {connectedDevice.name}
                  </Text>

                  <View style={styles.speedDisplay}>
                    <Text style={styles.speedLabel}>POWER LEVEL</Text>
                    <View style={styles.speedMeter}>
                      <Text style={styles.speedValue}>{speed}</Text>
                      <View style={styles.speedVisualizer}>
                        <View
                          style={[
                            styles.speedBar,
                            {width: `${(speed / MAX_SPEED) * 100}%`},
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.speedControls}>
                      <TouchableOpacity
                        style={styles.neonButton}
                        onPress={decreaseSpeed}>
                        <Text style={styles.neonButtonText}>▼</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.neonButton}
                        onPress={increaseSpeed}>
                        <Text style={styles.neonButtonText}>▲</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Selector de modo futurista */}
              <TouchableOpacity
                style={styles.modeToggle}
                onPress={toggleControlMode}>
                <View style={styles.modeGlow}>
                  <Text style={styles.modeText}>
                    {controlMode === 'buttons'
                      ? '🎮 SWITCH TO NEURAL'
                      : '⚡ SWITCH TO MANUAL'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Controles épicos */}
              {controlMode === 'buttons' ? (
                <View style={styles.controlMatrix}>
                  <View style={styles.matrixGlow}>
                    <TouchableOpacity
                      style={[styles.controlButton, styles.forwardButton]}
                      onPress={() => handleCommand('F')}>
                      <View style={styles.buttonInner}>
                        <Text style={styles.controlIcon}>⬆</Text>
                        <Text style={styles.controlText}>FORWARD</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.middleRow}>
                      <TouchableOpacity
                        style={[styles.controlButton, styles.leftButton]}
                        onPress={() => handleCommand('L')}>
                        <View style={styles.buttonInner}>
                          <Text style={styles.controlIcon}>⬅</Text>
                          <Text style={styles.controlText}>LEFT</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.controlButton, styles.stopButton]}
                        onPress={() => handleCommand('S')}>
                        <View style={styles.buttonInner}>
                          <Text style={styles.controlIcon}>⏹</Text>
                          <Text style={styles.controlText}>STOP</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.controlButton, styles.rightButton]}
                        onPress={() => handleCommand('R')}>
                        <View style={styles.buttonInner}>
                          <Text style={styles.controlIcon}>➡</Text>
                          <Text style={styles.controlText}>RIGHT</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.controlButton, styles.backwardButton]}
                      onPress={() => handleCommand('B')}>
                      <View style={styles.buttonInner}>
                        <Text style={styles.controlIcon}>⬇</Text>
                        <Text style={styles.controlText}>REVERSE</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.neuralInterface}>
                  <View style={styles.neuralGlow}>
                    <Text style={styles.neuralTitle}>🧠 NEURAL INTERFACE</Text>
                    <Text style={styles.neuralSubtext}>
                      Mind control coming soon...
                    </Text>
                    <View style={styles.neuralOrb}>
                      <View style={styles.neuralCore} />
                    </View>
                  </View>
                </View>
              )}

              {/* Botón de desconexión épico */}
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={disconnectDevice}>
                <View style={styles.disconnectGlow}>
                  <Text style={styles.disconnectText}>
                    🔥 TERMINATE CONNECTION 🔥
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.connectionHub}>
              <View style={styles.hubGlow}>
                <Text style={styles.hubTitle}>🛸 SCANNING MATRIX</Text>
                <Text style={styles.hubSubtitle}>
                  Connect to your cybernetic vehicle
                </Text>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={openBluetoothModal}>
                  <View style={styles.scanGlow}>
                    <Text style={styles.scanText}>🔍 INITIATE SCAN</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Modal futurista */}
        {showBluetoothModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalGlow}>
                <Text style={styles.modalTitle}>🌐 DEVICE MATRIX</Text>

                {isScanning ? (
                  <View style={styles.scanningInterface}>
                    <ActivityIndicator size="large" color={colors.neonGlow} />
                    <Text style={styles.scanningText}>SCANNING NETWORK...</Text>
                    <Text style={styles.scanningSubtext}>
                      Detecting cybernetic signatures
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.deviceMatrix}>
                    {devices.length > 0 ? (
                      devices.map((device, index) => (
                        <TouchableOpacity
                          key={device.id || index}
                          style={styles.deviceNode}
                          onPress={() => connectToDevice(device)}>
                          <View style={styles.deviceGlow}>
                            <View style={styles.deviceIcon}>
                              <Text style={styles.deviceIconText}>
                                {device.icon || '🤖'}
                              </Text>
                            </View>
                            <View style={styles.deviceData}>
                              <Text style={styles.deviceNameText}>
                                {device.name}
                              </Text>
                              <Text style={styles.deviceIdText}>
                                {device.id}
                              </Text>
                            </View>
                            {isConnecting && (
                              <ActivityIndicator color={colors.neonGlow} />
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.noDevicesFound}>
                        <Text style={styles.noDevicesText}>
                          NO SIGNALS DETECTED
                        </Text>
                        <Text style={styles.noDevicesSubtext}>
                          Check your cybernetic implants
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={scanDevices}>
                    <Text style={styles.modalButtonText}>🔄 RESCAN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.closeButton]}
                    onPress={() => setShowBluetoothModal(false)}>
                    <Text style={styles.modalButtonText}>❌ DISCONNECT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Estilos épicos cyberpunk
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundGradient: {
    flex: 1,
    backgroundColor: `linear-gradient(135deg, ${colors.background} 0%, ${colors.surface} 100%)`,
  },
  animatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  orb1: {
    width: 200,
    height: 200,
    backgroundColor: colors.primary,
    top: 100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: colors.secondary,
    bottom: 200,
    left: -30,
  },
  orb3: {
    width: 100,
    height: 100,
    backgroundColor: colors.purpleNeon,
    top: 300,
    left: 100,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  headerGlow: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.neonGlow,
    textAlign: 'center',
    textShadowColor: colors.neonGlow,
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 15,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.primaryLight,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 3,
    fontWeight: '600',
  },
  headerLine: {
    height: 2,
    backgroundColor: colors.neonGlow,
    marginVertical: 15,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  bluetoothStatus: {
    alignItems: 'center',
  },
  statusIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.success,
  },
  bluetoothStatusText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  statusPanel: {
    marginBottom: 25,
  },
  hologramEffect: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    shadowColor: colors.primaryLight,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
  },
  statusTitle: {
    fontSize: 18,
    color: colors.success,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 2,
  },
  deviceName: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  speedDisplay: {
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
    fontWeight: '600',
  },
  speedMeter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  speedValue: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.warning,
    textShadowColor: colors.warning,
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
    marginBottom: 15,
  },
  speedVisualizer: {
    width: 200,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neonGlow,
  },
  speedBar: {
    height: '100%',
    backgroundColor: colors.warning,
    shadowColor: colors.warning,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  speedControls: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 20,
  },
  neonButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 23, 68, 0.2)',
    borderWidth: 2,
    borderColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.secondary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  neonButtonText: {
    color: colors.secondary,
    fontSize: 20,
    fontWeight: '900',
  },
  modeToggle: {
    marginVertical: 20,
  },
  modeGlow: {
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 25,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.purpleNeon,
    shadowColor: colors.purpleNeon,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  modeText: {
    color: colors.purpleNeon,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: 1,
  },
  controlMatrix: {
    marginVertical: 20,
  },
  matrixGlow: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  controlButton: {
    marginVertical: 8,
    borderRadius: 15,
    borderWidth: 2,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
  },
  forwardButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderColor: colors.primary,
    shadowColor: colors.primary,
  },
  backwardButton: {
    backgroundColor: 'rgba(0, 188, 212, 0.2)',
    borderColor: colors.primaryDark,
    shadowColor: colors.primaryDark,
  },
  leftButton: {
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    borderColor: colors.accent,
    shadowColor: colors.accent,
    flex: 1,
    marginRight: 8,
  },
  rightButton: {
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    borderColor: colors.accent,
    shadowColor: colors.accent,
    flex: 1,
    marginLeft: 8,
  },
  stopButton: {
    backgroundColor: 'rgba(255, 7, 58, 0.2)',
    borderColor: colors.error,
    shadowColor: colors.error,
    width: 80,
  },
  buttonInner: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 5,
  },
  controlText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  neuralInterface: {
    marginVertical: 20,
  },
  neuralGlow: {
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    borderRadius: 25,
    padding: 40,
    borderWidth: 2,
    borderColor: colors.purpleNeon,
    shadowColor: colors.purpleNeon,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 20,
    alignItems: 'center',
  },
  neuralTitle: {
    fontSize: 20,
    color: colors.purpleNeon,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 2,
  },
  neuralSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 30,
    fontStyle: 'italic',
  },
  neuralOrb: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
    borderWidth: 3,
    borderColor: colors.purpleNeon,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.purpleNeon,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  neuralCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.purpleNeon,
    shadowColor: colors.purpleNeon,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  disconnectButton: {
    marginTop: 30,
  },
  disconnectGlow: {
    backgroundColor: 'rgba(255, 7, 58, 0.2)',
    borderRadius: 25,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.error,
    shadowColor: colors.error,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  disconnectText: {
    color: colors.error,
    fontWeight: '900',
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: 1,
  },
  connectionHub: {
    marginTop: 50,
  },
  hubGlow: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 25,
    padding: 40,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 20,
    alignItems: 'center',
  },
  hubTitle: {
    fontSize: 24,
    color: colors.neonGlow,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: 2,
  },
  hubSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  scanButton: {
    width: '100%',
  },
  scanGlow: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  scanText: {
    color: colors.neonGlow,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 1,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalGlow: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 25,
    padding: 25,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  modalTitle: {
    fontSize: 22,
    color: colors.neonGlow,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 2,
  },
  scanningInterface: {
    padding: 40,
    alignItems: 'center',
  },
  scanningText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    letterSpacing: 1,
  },
  scanningSubtext: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  deviceMatrix: {
    maxHeight: 300,
  },
  deviceNode: {
    marginBottom: 15,
  },
  deviceGlow: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    shadowColor: colors.primaryLight,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  deviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: colors.neonGlow,
  },
  deviceIconText: {
    fontSize: 20,
  },
  deviceData: {
    flex: 1,
  },
  deviceNameText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  deviceIdText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  noDevicesFound: {
    padding: 40,
    alignItems: 'center',
  },
  noDevicesText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
  },
  noDevicesSubtext: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 25,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
    borderColor: colors.neonGlow,
    shadowColor: colors.neonGlow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 7, 58, 0.2)',
    borderColor: colors.error,
    shadowColor: colors.error,
  },
  modalButtonText: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default App;
