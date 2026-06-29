import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/utils/theme';
import { formatTime, formatDate } from '@/utils/time';
import { useIncidents } from '@/services/Incidentstore';

export default function IncidentDetailScreen({ route, navigation }) {
  const { incident } = route.params;
  const { clearIncident } = useIncidents();

  const isC = incident.severity === 'CRITICAL';
  const color = isC ? COLORS.critical : COLORS.warning;
  const bg = isC ? COLORS.criticalBg : COLORS.warningBg;

  const dismiss = () => {
    clearIncident(incident.id);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.severityBanner, { backgroundColor: bg, borderColor: color + '66' }]}>
          <Ionicons name="alert-circle" size={24} color={color} />
          <Text style={[styles.severityText, { color }]}>{incident.severity}</Text>
        </View>

        <Text style={styles.title}>{incident.title}</Text>
        <Text style={styles.type}>Type: {incident.type ?? 'General'}</Text>

        <View style={styles.card}>
          <Row label="ID" value={incident.id} />
          <Row label="Time" value={incident.timestamp ? formatTime(incident.timestamp) : 'N/A'} />
          <Row label="Date" value={incident.timestamp ? formatDate(incident.timestamp) : 'N/A'} />
          <Row label="ETA" value={incident.eta ?? '—'} />
          {incident.source && <Row label="Source" value={incident.source} />}
        </View>

        {incident.detail && (
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>DETAILS</Text>
            <Text style={styles.detailText}>{incident.detail}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
          <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
          <Text style={styles.dismissText}>Mark as Resolved</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  severityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  severityText: { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  type: { color: COLORS.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderColor: COLORS.bgCardBorder, borderRadius: 12, padding: 14, gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textMuted, fontSize: 12 },
  rowValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  detailCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderColor: COLORS.bgCardBorder, borderRadius: 12, padding: 14,
  },
  detailLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  detailText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.successBg, borderWidth: 1,
    borderColor: COLORS.success + '55', borderRadius: 12, padding: 16,
  },
  dismissText: { color: COLORS.success, fontSize: 14, fontWeight: '700' },
});