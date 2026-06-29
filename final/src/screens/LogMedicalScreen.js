import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addIncident } from '@/services/Incidentstore';
import { useLocation } from '@/hooks/useLiveData';
import { COLORS } from '@/utils/theme';

const TYPES = ['Trauma', 'Cardiac', 'Respiratory', 'Drowning', 'Burns', 'Other'];

export default function LogMedicalScreen({ navigation }) {
  const { location } = useLocation();
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [severity, setSeverity] = useState('WARNING');
  const [victims, setVictims] = useState('1');

  const submit = () => {
    if (!selectedType || !description.trim()) {
      Alert.alert('Required', 'Please select a type and add a description.');
      return;
    }
    addIncident({
      title: `MEDICAL: ${selectedType.toUpperCase()}`,
      severity,
      type: 'MEDICAL',
      detail: `${victims} victim(s). ${description.trim()}`,
      coords: location
        ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
        : undefined,
    });
    Alert.alert('Logged', 'Medical incident has been logged and added to the incident feed.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>INCIDENT TYPE</Text>
        <View style={styles.typeGrid}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, selectedType === t && styles.typeBtnActive]}
              onPress={() => setSelectedType(t)}
            >
              <Text style={[styles.typeBtnText, selectedType === t && { color: COLORS.textPrimary }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>SEVERITY</Text>
        <View style={styles.severityRow}>
          {['INFO', 'WARNING', 'CRITICAL'].map((s) => {
            const color = s === 'CRITICAL' ? COLORS.critical : s === 'WARNING' ? COLORS.warning : COLORS.info;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.sevBtn, severity === s && { borderColor: color, backgroundColor: color + '22' }]}
                onPress={() => setSeverity(s)}
              >
                <Text style={[styles.sevText, { color: severity === s ? color : COLORS.textMuted }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>NUMBER OF VICTIMS</Text>
        <TextInput
          style={styles.input}
          value={victims}
          onChangeText={setVictims}
          keyboardType="number-pad"
          placeholderTextColor={COLORS.textMuted}
          placeholder="1"
        />

        <Text style={styles.fieldLabel}>DESCRIPTION</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor={COLORS.textMuted}
          placeholder="Describe the medical situation..."
        />

        <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.submitText}>LOG INCIDENT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  fieldLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '600',
    letterSpacing: 1, marginTop: 6, marginBottom: 4,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, backgroundColor: COLORS.bgCard,
  },
  typeBtnActive: { borderColor: COLORS.blue, backgroundColor: COLORS.blueDim },
  typeBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  severityRow: { flexDirection: 'row', gap: 8 },
  sevBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.bgCardBorder,
    backgroundColor: COLORS.bgCard, alignItems: 'center',
  },
  sevText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderColor: COLORS.bgCardBorder, borderRadius: 10,
    padding: 12, color: COLORS.textPrimary, fontSize: 14,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.critical, borderRadius: 12, padding: 16, marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});