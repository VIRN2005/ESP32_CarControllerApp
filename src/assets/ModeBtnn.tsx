// TrapezoidButton.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

interface TrapezoidButtonProps {
  width?: number;  
  height?: number;  
  strokeColor?: string;
  strokeWidth?: number;
}

export const TrapezoidButton: React.FC<TrapezoidButtonProps> = ({
  width = 200,
  height = 80,
  strokeColor = '#00FFAA',
  strokeWidth = 2,
}) => {
  const inset = 20;

  const points = `${inset},0 ${width },0 ${width - inset},${height} 0,${height}`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <Polygon
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
