// import React from 'react';
// import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';

// const NAVY = '#1034A6';
// const NAVY_DARK = '#0B2678';
// const LIGHT_BLUE_TINT = '#E8ECF9';

// const STATUS_ICON = {
//   PENDING: 'time-outline',
//   VERIFIED: 'shield-checkmark-outline',
//   DISPATCHED: 'car-outline',
//   RESOLVED: 'checkmark-done-circle-outline',
//   REJECTED: 'close-circle-outline',
// };

// export default function StatusUpdateModal({ visible, update, onClose }) {
//   if (!update) return null;

//   const iconName = STATUS_ICON[update.status] || 'notifications-outline';

//   return (
//     <Modal
//       visible={visible}
//       transparent
//       animationType="fade"
//       onRequestClose={onClose}
//     >
//       <View style={styles.backdrop}>
//         <View style={styles.card}>
//           <View style={styles.iconCircle}>
//             <Ionicons name={iconName} size={34} color="#FFFFFF" />
//           </View>

//           <Text style={styles.statusLabel}>{update.status}</Text>
//           <Text style={styles.message}>{update.message}</Text>

//           <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
//             <Text style={styles.buttonText}>OK, Got It</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// const styles = StyleSheet.create({
//   backdrop: {
//     flex: 1,
//     backgroundColor: 'rgba(11, 38, 120, 0.55)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 24,
//   },
//   card: {
//     width: '100%',
//     maxWidth: 340,
//     backgroundColor: '#FFFFFF',
//     borderRadius: 24,
//     paddingVertical: 32,
//     paddingHorizontal: 24,
//     alignItems: 'center',
//     shadowColor: NAVY_DARK,
//     shadowOffset: { width: 0, height: 12 },
//     shadowOpacity: 0.25,
//     shadowRadius: 24,
//     elevation: 10,
//   },
//   iconCircle: {
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//     backgroundColor: NAVY,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 18,
//   },
//   statusLabel: {
//     fontFamily: 'SpaceGrotesk_700Bold',
//     fontSize: 20,
//     color: NAVY_DARK,
//     letterSpacing: 0.5,
//     marginBottom: 8,
//   },
//   message: {
//     fontSize: 14,
//     color: '#4B5563',
//     textAlign: 'center',
//     lineHeight: 20,
//     marginBottom: 24,
//   },
//   button: {
//     backgroundColor: NAVY,
//     borderRadius: 999,
//     paddingVertical: 14,
//     paddingHorizontal: 36,
//     width: '100%',
//     alignItems: 'center',
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.3,
//   },
// });

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * SOSLoadingScreen
 * Full-screen radar/status view shown immediately after "Send SOS" is
 * pressed. Purely presentational — pass `incidentStatus` in from wherever
 * your backend polling / realtime subscription already lives.
 *
 * incidentStatus: null | 'PENDING' | 'VERIFIED' | 'DISPATCHED' | 'RESOLVED' | 'REJECTED'
 *   - null / 'PENDING' -> radar scans, loading messages rotate
 *   - anything else     -> radar settles, screen tints to match status,
 *                          a themed icon + message takes over the center
 */

const { width: SCREEN_W } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_W * 0.72, 300);

const NAVY = '#1034A6';
const NAVY_DARK = '#0B2678';
const LIGHT_TINT = '#EAF3FF';
const CYAN = '#6BB8FF';

const LOADING_MESSAGES = [
  { icon: 'location-outline', text: 'Detecting your location...' },
  { icon: 'hardware-chip-outline', text: 'AI analyzing emergency details...' },
  { icon: 'medkit-outline', text: 'Finding nearest rescue team...' },
  { icon: 'radio-outline', text: 'Contacting emergency responders...' },
  { icon: 'shield-checkmark-outline', text: 'Sending secure SOS signal...' },
  { icon: 'flash-outline', text: 'Calculating fastest response route...' },
  { icon: 'checkmark-circle-outline', text: 'Emergency request verified...' },
];

// Status → theme. Keeps the same royal-blue / white family for everything
// except RESOLVED (calming green) and REJECTED (a warm, non-alarming red),
// so the app still reads as "premium safety product," not "danger klaxon."
const STATUS_THEME = {
  PENDING: {
    primary: NAVY,
    accent: CYAN,
    tint: LIGHT_TINT,
    icon: 'radio-outline',
    title: 'AI is locating nearby\nemergency responders',
  },
  VERIFIED: {
    primary: NAVY,
    accent: CYAN,
    tint: LIGHT_TINT,
    icon: 'shield-checkmark-outline',
    title: 'Incident Verified',
    subtitle: 'AI has confirmed your emergency and is dispatching help.',
  },
  DISPATCHED: {
    primary: NAVY_DARK,
    accent: CYAN,
    tint: '#E4ECFC',
    icon: 'car-outline',
    title: 'Responders En Route',
    subtitle: 'A rescue team has been assigned and is on the way.',
  },
  RESOLVED: {
    primary: '#0E9F6E',
    accent: '#86EFC4',
    tint: '#E7FBF3',
    icon: 'checkmark-done-circle-outline',
    title: 'Incident Resolved',
    subtitle: 'This emergency has been marked as resolved. Stay safe.',
  },
  REJECTED: {
    primary: '#C2410C',
    accent: '#FDBA74',
    tint: '#FFF4EC',
    icon: 'alert-circle-outline',
    title: 'Request Needs Attention',
    subtitle: 'We could not verify this automatically. Please try again or call your contact.',
  },
};

// Responder dots placed around the radar ring at fixed angles/radii,
// each twinkling independently.
const RESPONDER_DOTS = [
  { angle: 35, radius: 0.82 },
  { angle: 120, radius: 0.62 },
  { angle: 200, radius: 0.9 },
  { angle: 290, radius: 0.7 },
  { angle: 320, radius: 0.45 },
];

export default function SOSLoadingScreen({ incidentStatus = null }) {
  const isSettled = !!incidentStatus && incidentStatus !== 'PENDING';
  const theme = STATUS_THEME[incidentStatus] || STATUS_THEME.PENDING;

  // ── message rotation (only while pending) ──
  const [msgIndex, setMsgIndex] = useState(0);
  const msgOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSettled) return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(msgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(msgOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 220);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSettled]);

  // ── continuous radar sweep ──
  const sweepAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── expanding pulse rings (3, staggered) ──
  const pulseAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = pulseAnims.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 900),
          Animated.timing(val, {
            toValue: 1,
            duration: 2700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  // ── periodic ripple burst ──
  const rippleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2600),
        Animated.timing(rippleAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── center icon breathing glow ──
  const breatheAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const breatheScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  // ── responder dot twinkle ──
  const dotAnims = useRef(RESPONDER_DOTS.map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = dotAnims.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.timing(val, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  // ── settle transition: fade the color tint + swap center content ──
  const settleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(settleAnim, {
      toValue: isSettled ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // driving colors, not transforms
    }).start();
  }, [isSettled]);

  const activeMessage = LOADING_MESSAGES[msgIndex];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[theme.tint, '#FFFFFF']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* soft top brand mark */}
      <View style={styles.brandRow}>
        <Ionicons name="shield-half-outline" size={18} color={theme.primary} />
        <Text style={[styles.brandText, { color: theme.primary }]}>RAKSHAK</Text>
      </View>

      <View style={styles.radarWrap}>
        {/* outer glow */}
        <View
          style={[
            styles.glow,
            { backgroundColor: theme.accent, opacity: isSettled ? 0.18 : 0.28 },
          ]}
        />

        {/* radar grid rings */}
        <View style={[styles.gridRing, { width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_SIZE / 2, borderColor: theme.primary + '22' }]} />
        <View style={[styles.gridRing, { width: RADAR_SIZE * 0.72, height: RADAR_SIZE * 0.72, borderRadius: (RADAR_SIZE * 0.72) / 2, borderColor: theme.primary + '22' }]} />
        <View style={[styles.gridRing, { width: RADAR_SIZE * 0.44, height: RADAR_SIZE * 0.44, borderRadius: (RADAR_SIZE * 0.44) / 2, borderColor: theme.primary + '22' }]} />

        {/* expanding pulse waves */}
        {!isSettled &&
          pulseAnims.map((val, i) => {
            const scale = val.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
            const opacity = val.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.15, 0] });
            return (
              <Animated.View
                key={`pulse-${i}`}
                style={[
                  styles.pulseRing,
                  {
                    width: RADAR_SIZE,
                    height: RADAR_SIZE,
                    borderRadius: RADAR_SIZE / 2,
                    borderColor: theme.accent,
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              />
            );
          })}

        {/* periodic ripple burst */}
        {!isSettled && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                width: RADAR_SIZE,
                height: RADAR_SIZE,
                borderRadius: RADAR_SIZE / 2,
                borderColor: theme.primary,
                borderWidth: 1.5,
                transform: [
                  {
                    scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.05] }),
                  },
                ],
                opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              },
            ]}
          />
        )}

        {/* rotating scan beam */}
        {!isSettled && (
          <Animated.View
            style={[
              styles.sweepWrap,
              { width: RADAR_SIZE, height: RADAR_SIZE, transform: [{ rotate: sweepRotate }] },
            ]}
          >
            <LinearGradient
              colors={[theme.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sweepBeam}
            />
          </Animated.View>
        )}

        {/* responder dots */}
        {!isSettled &&
          RESPONDER_DOTS.map((dot, i) => {
            const rad = (dot.angle * Math.PI) / 180;
            const r = (RADAR_SIZE / 2) * dot.radius;
            const x = RADAR_SIZE / 2 + r * Math.cos(rad) - 5;
            const y = RADAR_SIZE / 2 + r * Math.sin(rad) - 5;
            return (
              <Animated.View
                key={`dot-${i}`}
                style={[
                  styles.responderDot,
                  { left: x, top: y, backgroundColor: theme.primary, opacity: dotAnims[i] },
                ]}
              />
            );
          })}

        {/* center icon */}
        <Animated.View
          style={[
            styles.centerIconCircle,
            {
              backgroundColor: theme.primary,
              transform: [{ scale: isSettled ? 1 : breatheScale }],
              shadowColor: theme.primary,
            },
          ]}
        >
          <Ionicons name={theme.icon} size={40} color="#FFFFFF" />
        </Animated.View>
      </View>

      {/* status text block */}
      <View style={styles.textBlock}>
        {isSettled ? (
          <>
            <Text style={[styles.settledTitle, { color: theme.primary }]}>{theme.title}</Text>
            {!!theme.subtitle && <Text style={styles.settledSubtitle}>{theme.subtitle}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.mainTitle}>AI is locating nearby{'\n'}emergency responders</Text>
            <Animated.View style={[styles.loadingRow, { opacity: msgOpacity }]}>
              <Ionicons name={activeMessage.icon} size={16} color={theme.primary} />
              <Text style={styles.loadingText}>{activeMessage.text}</Text>
            </Animated.View>
          </>
        )}
      </View>

      {/* footer reassurance strip */}
      <View style={styles.footerRow}>
        <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
        <Text style={styles.footerText}>Your location is encrypted and shared only with verified responders</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  brandRow: {
    position: 'absolute',
    top: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    letterSpacing: 2,
  },

  radarWrap: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  glow: {
    position: 'absolute',
    width: RADAR_SIZE * 1.15,
    height: RADAR_SIZE * 1.15,
    borderRadius: (RADAR_SIZE * 1.15) / 2,
  },
  gridRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  sweepWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: RADAR_SIZE / 2,
  },
  sweepBeam: {
    position: 'absolute',
    width: RADAR_SIZE / 2,
    height: RADAR_SIZE / 2,
    top: 0,
    left: RADAR_SIZE / 2,
    opacity: 0.55,
  },
  responderDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#1034A6',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  centerIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  textBlock: {
    alignItems: 'center',
    minHeight: 90,
  },
  mainTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F6FD',
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  settledTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    textAlign: 'center',
    marginBottom: 8,
  },
  settledSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },

  footerRow: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    flexShrink: 1,
  },
});