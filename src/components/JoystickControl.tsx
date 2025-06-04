// JoystickControl.tsx
import React, { FC, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  PanResponder,
  PanResponderInstance,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
} from 'react-native';
import { colors } from '../styles/colors';

type DirectionCommand = 'F' | 'B' | 'L' | 'R' | 'S';

interface JoystickControlProps {
  axis: 'vertical' | 'horizontal';
  onMove: (direction: DirectionCommand) => void;
  padSize?: number;
  knobSize?: number;
  threshold?: number;
}

export const JoystickControl: FC<JoystickControlProps> = ({
  axis,
  onMove,
  padSize = 150,
  knobSize = 50,
  threshold = 30,
}) => {
  // Animated value drives the “knob” position
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastSent = useRef<DirectionCommand | null>(null);

  // distancia maxima a la que se puede mover lejos de la base
  const maxRadius = (padSize - knobSize) / 2;

  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        // cambia al arrastrar
        pan.setValue({ x: 0, y: 0 });
        lastSent.current = null;
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gs: PanResponderGestureState
      ) => {
        let x = gs.dx;
        let y = gs.dy;


        if (axis === 'vertical') {
          x = 0;
          if (y < -maxRadius) y = -maxRadius;
          if (y > maxRadius) y = maxRadius;
          pan.setValue({ x: 0, y });
        } else {
          y = 0;
          if (x < -maxRadius) x = -maxRadius;
          if (x > maxRadius) x = maxRadius;
          pan.setValue({ x, y: 0 });
        }

        // verifica para enviar direccion
        if (axis === 'vertical') {
          if (y < -threshold && lastSent.current !== 'F') {
            lastSent.current = 'F';
            onMove('F');
          } else if (y > threshold && lastSent.current !== 'B') {
            lastSent.current = 'B';
            onMove('B');
          } else if (Math.abs(y) < threshold) {
            lastSent.current = null;
          }
        } else {
          if (x < -threshold && lastSent.current !== 'L') {
            lastSent.current = 'L';
            onMove('L');
          } else if (x > threshold && lastSent.current !== 'R') {
            lastSent.current = 'R';
            onMove('R');
          } else if (Math.abs(x) < threshold) {
            lastSent.current = null;
          }
        }
      },

      onPanResponderRelease: () => {
        // regresa al centro
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          tension: 120,
          friction: 8,
          useNativeDriver: false,
        }).start();
        lastSent.current = null;
        onMove('S'); // send stop
      },

      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          tension: 120,
          friction: 8,
          useNativeDriver: false,
        }).start();
        lastSent.current = null;
        onMove('S');
      },

      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  return (
    <View
      style={[
        styles.padContainer,
        {
          width: padSize,
          height: padSize,
          borderRadius: padSize / 2,
        },
      ]}>
      <Image
        source={require('../assets/bg-button.png')}
        style={{
          position: 'absolute',
          width: padSize,
          height: padSize,
          borderRadius: padSize / 2,
        }}
        resizeMode="contain"
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            width: knobSize,
            height: knobSize,
            borderRadius: knobSize / 2,
            transform: pan.getTranslateTransform(),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  padContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  knob: {
    backgroundColor: colors.primaryDarkG,
    borderWidth: 2,
    borderColor: colors.accentP,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    position: 'absolute',
  },
});

