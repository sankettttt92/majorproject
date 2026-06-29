import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/utils/theme';

export default function StatusBarWidget({ ping, accuracy, battery, dbm, networkType }) {
  const lteLabel = networkType === 'wifi' ? 'WiFi' : networkType === 'cellular' ? 'LTE' : 'NET';
  const pingLabel = ping !== null ? `${ping}ms` : '---';
  const accLabel = accuracy ? `${Math.round(accuracy)}m ACC` : '-- ACC';
  const batLabel = battery !== null ? `${battery}%` : '---%';

  const dbmLabel = dbm !== null ? `${dbm} dBm` : '--- dBm';
  const signalBars = dbm > -60 ? 4 : dbm > -75 ? 3 : dbm > -90 ? 2 : 1;

  return (
    <View style={styles.row}>
      {/* Network / ping */}
      <View style={styles.pill}>
        <Ionicons name="radio-outline" size={14} color={COLORS.textMono} />
        <Text style={styles.label}>
          {lteLabel} – {pingLabel}
        </Text>
      </View>

      {/* GPS accuracy */}
      <View style={styles.pill}>
        <Ionicons name="location-outline" size={14} color={COLORS.textMono} />
        <Text style={styles.label}>{accLabel}</Text>
      </View>

      {/* Battery */}
      <View style={styles.pill}>
        <Ionicons
          name={battery > 20 ? 'battery-half-outline' : 'battery-dead-outline'}
          size={14}
          color={battery !== null && battery < 20 ? COLORS.critical : COLORS.textMono}
        />
        <Text style={[styles.label, battery !== null && battery < 20 && { color: COLORS.critical }]}>
          {batLabel}
        </Text>
      </View>

      {/* Signal dBm */}
      <View style={styles.pill}>
        <MaterialCommunityIcons
          name={`signal-cellular-${signalBars}`}
          size={14}
          color={COLORS.textMono}
        />
        <Text style={styles.label}>{dbmLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flex: 1,
    minWidth: 80,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});