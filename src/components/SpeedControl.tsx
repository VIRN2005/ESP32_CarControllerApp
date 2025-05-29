import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
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


interface SpeedControlProps {
  speed: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

const SpeedControl: React.FC<SpeedControlProps> = ({
  speed,
  onIncrease,
  onDecrease,
}) => {
  return (
    <View style={styles.container}>
      <Text style={globalStyles.subtitle}>Velocidad: {speed}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[globalStyles.button, styles.speedButton]}
          onPress={onDecrease}>
          <Text style={globalStyles.buttonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[globalStyles.button, styles.speedButton]}
          onPress={onIncrease}>
          <Text style={globalStyles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  speedButton: {
    width: 60,
    height: 60,
    marginHorizontal: 10,
  },
});

export default SpeedControl;