import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { COLORS } from '@/utils/theme';

export default function SOSButton({ onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Sends immediately — no confirmation dialog, no phone dialer
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Animated.View
        style={[styles.container, { transform: [{ scale: pulse }] }]}
      >
        <Animated.View style={[styles.glow, { opacity }]} />
        <Text style={styles.sos}>SOS</Text>
        <Text style={styles.sub}>Tap to send emergency alert</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderColor: COLORS.sosBorder,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.sosBg,
    position: 'relative',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(224,38,63,0.05)',
    borderRadius: 12,
  },
  sos: {
    color: COLORS.critical,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 6,
  },
  sub: {
    color: COLORS.critical,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});