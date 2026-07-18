// import React, { useEffect, useRef, useState } from 'react';
// import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
// import { COLORS } from '@/utils/theme';

// const COUNTDOWN_SECONDS = 5;

// /**
//  * SOSCountdown
//  * Shown immediately after a shake is detected. Gives the person a short
//  * window to cancel a false trigger (e.g. jogging, phone dropped).
//  *
//  * IMPORTANT: if the countdown reaches zero without any interaction, that is
//  * treated as CONFIRMATION, not cancellation — the victim may not be able to
//  * safely interact with the phone. Only an explicit tap on "cancel" stops it.
//  */
// export default function SOSCountdown({ visible, onConfirm, onCancel }) {
//   const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
//   const intervalRef = useRef(null);
//   const hasResolvedRef = useRef(false);

//   useEffect(() => {
//     if (!visible) return;

//     setSecondsLeft(COUNTDOWN_SECONDS);
//     hasResolvedRef.current = false;

//     intervalRef.current = setInterval(() => {
//       setSecondsLeft((prev) => {
//         if (prev <= 1) {
//           clearInterval(intervalRef.current);
//           if (!hasResolvedRef.current) {
//             hasResolvedRef.current = true;
//             onConfirm();
//           }
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);

//     return () => {
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     };
//   }, [visible]);

//   const handleCancel = () => {
//     if (hasResolvedRef.current) return;
//     hasResolvedRef.current = true;
//     if (intervalRef.current) clearInterval(intervalRef.current);
//     onCancel();
//   };

//   if (!visible) return null;

//   return (
//     <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
//       <View style={styles.overlay}>
//         <View style={styles.card}>
//           <View style={styles.countCircle}>
//             <Text style={styles.countText}>{secondsLeft}</Text>
//           </View>

//           <Text style={styles.title}>SOS triggering</Text>
//           <Text style={styles.subtitle}>
//             Shake detected. Alert and recording will start automatically
//             unless cancelled.
//           </Text>

//           <TouchableOpacity
//             style={styles.cancelBtn}
//             onPress={handleCancel}
//             activeOpacity={0.7}
//           >
//             <Text style={styles.cancelText}>This was accidental — cancel</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 24,
//   },
//   card: {
//     width: '100%',
//     maxWidth: 320,
//     backgroundColor: COLORS.bgCard,
//     borderRadius: 20,
//     borderWidth: 1,
//     borderColor: COLORS.bgCardBorder,
//     padding: 24,
//     alignItems: 'center',
//     gap: 16,
//   },
//   countCircle: {
//     width: 64,
//     height: 64,
//     borderRadius: 32,
//     backgroundColor: 'rgba(220,53,69,0.15)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   countText: {
//     fontSize: 22,
//     fontWeight: '600',
//     color: '#dc3545',
//   },
//   title: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: COLORS.textPrimary,
//     textAlign: 'center',
//   },
//   subtitle: {
//     fontSize: 13,
//     color: COLORS.textSecondary,
//     textAlign: 'center',
//     lineHeight: 19,
//   },
//   cancelBtn: {
//     width: '100%',
//     backgroundColor: COLORS.bg,
//     borderWidth: 1,
//     borderColor: COLORS.bgCardBorder,
//     borderRadius: 10,
//     paddingVertical: 12,
//     alignItems: 'center',
//   },
//   cancelText: {
//     fontSize: 14,
//     fontWeight: '500',
//     color: COLORS.textPrimary,
//   },
// });

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/utils/theme';

const COUNTDOWN_SECONDS = 3; // spec: 3-second countdown with cancel

export default function SOSCountdown({ visible, onConfirm, onCancel }) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      // Reset for next time this modal opens
      setSecondsLeft(COUNTDOWN_SECONDS);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setSecondsLeft(COUNTDOWN_SECONDS);
    Vibration.vibrate(100); // short buzz when countdown starts

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onConfirm(); // countdown expired without cancellation
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="warning" size={36} color={COLORS.red || '#E5484D'} />
          <Text style={styles.title}>SOS Triggered</Text>
          <Text style={styles.subtitle}>
            Sending emergency alert in {secondsLeft}...
          </Text>

          <View style={styles.countdownRing}>
            <Text style={styles.countdownNumber}>{secondsLeft}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.bgCard || '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    width: '80%',
    alignItems: 'center',
  },
  title: {
    color: COLORS.textPrimary || '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  subtitle: {
    color: COLORS.textSecondary || '#aaa',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  countdownRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.red || '#E5484D',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  countdownNumber: {
    color: COLORS.textPrimary || '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: COLORS.bgCardBorder || '#333',
  },
  cancelText: {
    color: COLORS.textPrimary || '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});