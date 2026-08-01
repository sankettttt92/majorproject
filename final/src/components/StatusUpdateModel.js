import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#1034A6';
const NAVY_DARK = '#0B2678';
const LIGHT_BLUE_TINT = '#E8ECF9';

const STATUS_ICON = {
  PENDING: 'time-outline',
  VERIFIED: 'shield-checkmark-outline',
  DISPATCHED: 'car-outline',
  RESOLVED: 'checkmark-done-circle-outline',
  REJECTED: 'close-circle-outline',
};

export default function StatusUpdateModal({ visible, update, onClose }) {
  if (!update) return null;

  const iconName = STATUS_ICON[update.status] || 'notifications-outline';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name={iconName} size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.statusLabel}>{update.status}</Text>
          <Text style={styles.message}>{update.message}</Text>

          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.buttonText}>OK, Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 38, 120, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: NAVY_DARK,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  statusLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: NAVY_DARK,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});