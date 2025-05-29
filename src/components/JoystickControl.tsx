import React from 'react';
import {View, StyleSheet, PanResponder} from 'react-native';
import {colors} from '../styles/colors';

interface JoystickControlProps {
  onMove: (direction: string) => void;
}

const JoystickControl: React.FC<JoystickControlProps> = ({onMove}) => {
  const [stickPosition, setStickPosition] = React.useState({x: 0, y: 0});
  const joystickRadius = 75;
  const stickRadius = 25;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // Limitar el movimiento al área del joystick
        const distance = Math.sqrt(
          Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2)
        );
        
        const limitedDistance = Math.min(distance, joystickRadius - stickRadius);
        const angle = Math.atan2(gestureState.dy, gestureState.dx);
        
        const x = limitedDistance * Math.cos(angle);
        const y = limitedDistance * Math.sin(angle);
        
        setStickPosition({x, y});

        // Determinar dirección
        if (y < -0.5 * (joystickRadius - stickRadius)) {
          onMove('F');
        } else if (y > 0.5 * (joystickRadius - stickRadius)) {
          onMove('B');
        } else if (x < -0.5 * (joystickRadius - stickRadius)) {
          onMove('L');
        } else if (x > 0.5 * (joystickRadius - stickRadius)) {
          onMove('R');
        }
      },
      onPanResponderRelease: () => {
        setStickPosition({x: 0, y: 0});
        onMove('S');
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View 
        style={[
          styles.joystickBase, 
          {backgroundColor: colors.primaryDark}
        ]}
        {...panResponder.panHandlers}
      >
        <View 
          style={[
            styles.joystickStick, 
            {
              backgroundColor: colors.primary,
              transform: [
                {translateX: stickPosition.x},
                {translateY: stickPosition.y}
              ]
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  joystickBase: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickStick: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: 'absolute',
  },
});

export default JoystickControl;