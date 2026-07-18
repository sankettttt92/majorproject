import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  surface: '#FFFFFF',
  border: '#EFEFEF',
  textPrimary: '#111111',
  textMuted: '#9CA3AF',
  green: '#10B981',
  red: '#E5484D',
  blue: '#2F6FED',
};

export default function StatusBarWidget({ ping, accuracy, battery, dbm, networkType }) {
  const lteLabel = networkType === 'wifi' ? 'WiFi' : networkType === 'cellular' ? 'LTE' : 'NET';
  const pingLabel = ping !== null ? `${ping}ms` : '---';
  const accLabel = accuracy ? `${Math.round(accuracy)}m` : '--';
  const batLabel = battery !== null ? `${battery}%` : '---%';

  const signalBars = dbm > -60 ? 4 : dbm > -75 ? 3 : dbm > -90 ? 2 : 1;
  const isLowBattery = battery !== null && battery < 20;

  return (
    <View style={styles.row}>
      <StatusItem
        icon={<Ionicons name="battery-full-outline" size={18} color={isLowBattery ? COLORS.red : COLORS.green} />}
        value={batLabel}
        label={isLowBattery ? 'LOW' : 'OK'}
        valueColor={isLowBattery ? COLORS.red : COLORS.textPrimary}
      />
      <StatusItem
        icon={<MaterialCommunityIcons name={`signal-cellular-${signalBars}`} size={18} color={COLORS.textPrimary} />}
        value={lteLabel}
        label="SIGNAL"
      />
      <StatusItem
        icon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.green} />}
        value="Safe"
        label={pingLabel}
      />
      <StatusItem
        icon={<Ionicons name="navigate-circle-outline" size={18} color={COLORS.blue} />}
        value="Active"
        label={accLabel}
      />
    </View>
  );
}

function StatusItem({ icon, value, label, valueColor }) {
  return (
    <View style={styles.item}>
      {icon}
      <Text style={[styles.value, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});