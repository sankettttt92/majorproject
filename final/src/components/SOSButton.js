import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  red: '#E5484D',
  redRing: '#FCE4E4',
  white: '#FFFFFF',
  textMuted: '#9CA3AF',
  accent: '#E5484D',
};

export default function SOSButton({ onPress, disabled }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Sends immediately — no confirmation dialog, no phone dialer
  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled}>
        <Animated.View style={[styles.outerRing, { opacity: ringOpacity }]}>
          <Animated.View
            style={[
              styles.circle,
              disabled && styles.circleDisabled,
              { transform: [{ scale: pulse }] },
            ]}
          >
            <Ionicons name="location" size={30} color={COLORS.white} />
            <Text style={styles.sos}>SOS</Text>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
      <Text style={styles.sub}>Shake phone or tap for emergency response</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 16 },
  outerRing: {
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: COLORS.redRing,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  circle: {
    width: 176, height: 176, borderRadius: 88,
    backgroundColor: COLORS.red,
    borderWidth: 6, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.red, shadowOpacity: 0.3,
    shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  circleDisabled: { opacity: 0.6 },
  sos: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 6,
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});