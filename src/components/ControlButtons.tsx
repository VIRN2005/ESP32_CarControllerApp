import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
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

interface ControlButtonsProps {
  onPress: (command: string) => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({onPress}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.primary}]}
          onPress={() => onPress('F')}>
          <Text style={globalStyles.buttonText}>Adelante</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.primary}]}
          onPress={() => onPress('L')}>
          <Text style={globalStyles.buttonText}>Izquierda</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.error}]}
          onPress={() => onPress('S')}>
          <Text style={globalStyles.buttonText}>Parar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.primary}]}
          onPress={() => onPress('R')}>
          <Text style={globalStyles.buttonText}>Derecha</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.primary}]}
          onPress={() => onPress('B')}>
          <Text style={globalStyles.buttonText}>Atrás</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  row: {
    flexDirection: 'row',
    marginVertical: 5,
  },
  button: {
    width: 100,
    height: 80,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ControlButtons;