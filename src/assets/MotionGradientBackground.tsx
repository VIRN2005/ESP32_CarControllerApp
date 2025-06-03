import React, {
  ReactNode,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Animated,
  Easing,
  Dimensions,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  ScaledSize,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface MotionGradientBackgroundProps {
  children: ReactNode;
  loopDurationMs?: number; 
  motionOpacity?: number;    
  containerStyle?: StyleProp<ViewStyle>;
}

const MotionGradientBackground: React.FC<MotionGradientBackgroundProps> = ({
  children,
  loopDurationMs = 12000,
  motionOpacity =1,
  containerStyle,
}) => {
  const [screenDimensions, setScreenDimensions] = useState<ScaledSize>(
    Dimensions.get('window')
  );
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const restartAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    translateX.setValue(0);
    animationRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -screenDimensions.width,
        duration: loopDurationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animationRef.current.start();
  }, [loopDurationMs, screenDimensions.width, translateX]);

  useEffect(() => {
    restartAnimation();
    return () => {
      animationRef.current?.stop();
    };
  }, [restartAnimation]);

  useEffect(() => {
    const handleChange = ({ window }: { window: ScaledSize }) => {
      setScreenDimensions(window);
    };
    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Restart whenever width changes
  useEffect(() => {
    restartAnimation();
  }, [screenDimensions.width, restartAnimation]);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = screenDimensions;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* 1) Gradient base */}
      <LinearGradient
        colors={['#00ff75', '#005b5d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2) Motion-lines overlay */}
      {true && (
        <Animated.View
          style={{
            position: 'absolute',
            width: SCREEN_WIDTH * 2,
            height: SCREEN_HEIGHT,
            flexDirection: 'row',
            transform: [{ translateX }],
          }}
        >
          <Image
            source={require('../assets/bg-lines2.png')}
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              opacity: motionOpacity,
            } as ImageStyle}
            resizeMode="cover"
          />
          <Image
            source={require('../assets/bg-lines2.png')}
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              opacity: motionOpacity,
              transform: [
                { scaleX: -1 },
                /* { scaleY: -1 },  */
                ],
            } as ImageStyle}
            
            resizeMode="cover"
          />
        </Animated.View>
      )}

      <View style={styles.content}>{children}</View>
    </View>
  );
};

export default MotionGradientBackground;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
});

