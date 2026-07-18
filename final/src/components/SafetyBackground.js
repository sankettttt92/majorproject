import { useEffect, useRef } from "react";
import { StyleSheet, Animated, Easing, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line } from "react-native-svg";

const SIZE = 400;
const CENTER = SIZE / 2;

export default function SafetyBackground() {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, [rotation, pulse]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 2.4] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 0.1, 0] });

  const rings = [50, 100, 150, 190];

  return (
    <View style={styles.wrap}>
      {/* static grid + range rings, drawn once, no animation needed */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {rings.map((r) => (
          <Circle
            key={r}
            cx={CENTER}
            cy={CENTER}
            r={r}
            stroke="#FFFFFF"
            strokeOpacity={0.28}
            strokeWidth={1.2}
            strokeDasharray="4 6"
            fill="none"
          />
        ))}
        <Line x1={CENTER} y1={CENTER - 190} x2={CENTER} y2={CENTER + 190} stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="1" />
        <Line x1={CENTER - 190} y1={CENTER} x2={CENTER + 190} y2={CENTER} stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="1" />
      </Svg>

      {/* pulsing detection ring, expands outward from center */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* rotating radar sweep, plain View so rotation is dead simple + reliable */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sweepContainer, { transform: [{ rotate: spin }] }]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={styles.sweepLine}
        />
      </Animated.View>

      {/* center dot, always on top */}
      <View style={styles.centerDot} />

      {/* static blips */}
      <View style={[styles.blip, { top: CENTER - 40, left: CENTER + 70, opacity: 0.55 }]} />
      <View style={[styles.blip, { top: CENTER + 60, left: CENTER - 112, opacity: 0.4 }]} />
      <View style={[styles.blip, { top: CENTER + 128, left: CENTER + 30, opacity: 0.3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  sweepContainer: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    justifyContent: "flex-start",
    alignItems: "center",
    // default RN rotation pivots around the element's own center,
    // and this container IS centered on the radar center — so it rotates correctly
  },
  sweepLine: {
    width: 3,
    height: CENTER, // reaches from center to edge
  },
  pulseRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  centerDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    opacity: 0.7,
  },
  blip: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
  },
});