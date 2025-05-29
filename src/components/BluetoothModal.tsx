import React from 'react';
import {View, Text, Modal, FlatList, TouchableOpacity, ActivityIndicator} from 'react-native';
import {globalStyles} from '../styles/globalStyles';
export const colors = {
  primary: '#6200ee',
  primaryDark: '#3700b3',
  secondary: '#03dac6',
  background: '#f5f5f5',
  surface: '#ffffff',
  error: '#b00020',
  text: '#000000',
  textSecondary: '#757575',
  disabled: '#9e9e9e',
};

interface BluetoothModalProps {
  visible: boolean;
  devices: Array<{id: string; name: string | null}>;
  isScanning: boolean;
  onSelectDevice: (device: {id: string; name: string | null}) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const BluetoothModal: React.FC<BluetoothModalProps> = ({
  visible,
  devices,
  isScanning,
  onSelectDevice,
  onClose,
  onRefresh,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}>
      <View style={[globalStyles.container, {padding: 20}]}>
        <Text style={globalStyles.title}>Dispositivos Bluetooth</Text>

        {isScanning ? (
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{marginTop: 10}}>Buscando dispositivos...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[globalStyles.button, {marginBottom: 20}]}
              onPress={onRefresh}>
              <Text style={globalStyles.buttonText}>Buscar de nuevo</Text>
            </TouchableOpacity>

            <FlatList
              data={devices}
              keyExtractor={item => item.id}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={{
                    padding: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.disabled,
                  }}
                  onPress={() => onSelectDevice(item)}>
                  <Text style={{fontSize: 16}}>
                    {item.name || 'Dispositivo desconocido'}
                  </Text>
                  <Text style={{color: colors.textSecondary, fontSize: 12}}>
                    {item.id}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{textAlign: 'center', marginTop: 20}}>
                  No se encontraron dispositivos
                </Text>
              }
            />
          </>
        )}

        <TouchableOpacity
          style={[
            globalStyles.button,
            {backgroundColor: colors.error, marginTop: 20},
          ]}
          onPress={onClose}>
          <Text style={globalStyles.buttonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default BluetoothModal;