import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/utils/theme';
import { formatRelativeTime } from '@/utils/time';

const SEVERITY_CONFIG = {
  CRITICAL: { bg: COLORS.criticalBg, border: COLORS.criticalBorder, text: COLORS.critical, label: 'CRITICAL' },
  WARNING: { bg: COLORS.warningBg, border: COLORS.warningBorder, text: COLORS.warning, label: 'WARNING' },
  INFO: { bg: COLORS.infoBg, border: COLORS.blueBorder, text: COLORS.info, label: 'INFO' },
};

const TYPE_ICON = {
  FLOOD: 'water-outline',
  ROAD: 'car-outline',
  MEDICAL: 'medkit-outline',
  SEISMIC: 'pulse-outline',
  WIND: 'thunderstorm-outline',
  DEFAULT: 'warning-outline',
};

export default function IncidentLog({ incidents, onPress }) {
  if (!incidents || incidents.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active incidents</Text>
      </View>
    );
  }

  return (
    <View>
      {incidents.slice(0, 5).map((inc) => {
        const cfg = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.INFO;
        const icon = TYPE_ICON[inc.type] || TYPE_ICON.DEFAULT;

        return (
          <TouchableOpacity
            key={inc.id}
            style={[styles.row, { borderColor: cfg.border }]}
            onPress={() => onPress?.(inc)}
            activeOpacity={0.75}
          >
            <View style={styles.left}>
              <Ionicons name={icon} size={16} color={cfg.text} style={styles.icon} />
              <View style={styles.info}>
                <Text style={styles.title}>{inc.title}</Text>
                <Text style={styles.time}>
                  {inc.eta ?? formatRelativeTime(inc.timestamp)}
                </Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: COLORS.bgCard,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  icon: { marginRight: 2 },
  info: { flex: 1 },
  title: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  empty: { padding: 16, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
});