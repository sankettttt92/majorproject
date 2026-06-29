import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useLocation, useBattery, useNetwork, useClock, useSignalStrength, usePing } from '@/hooks/useLiveData';
import { fetchWeather, seedIncidentsFromWeather } from '@/services/weatherService';
import { useIncidents } from '@/services/Incidentstore';
import StatusBarWidget from '@/components/StatusBarWidget';
import SOSButton from '@/components/SOSButton';
import IncidentLog from '@/components/IncidentLog';
import { COLORS } from '@/utils/theme';
import { formatTime, formatDate } from '@/utils/time';

const SECTOR = 'DELHI SECTOR 4';

// Use your laptop's LAN IP when testing on a physical phone.
// e.g. "http://192.168.1.42:8000"
const API_BASE = 'http://192.168.0.100:8000';

export default function HomeScreen({ navigation }) {
  const { location, address } = useLocation();
  const battery = useBattery();
  const network = useNetwork();
  const clock = useClock();
  const dbm = useSignalStrength(-72);
  const ping = usePing('https://1.1.1.1');

  const { incidents, addIncident } = useIncidents();
  const [weather, setWeather] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [sendingSOS, setSendingSOS] = useState(false);

  const loadWeather = useCallback(async (lat, lon) => {
    const w = await fetchWeather(lat ?? 28.5852, lon ?? 77.31);
    if (w) {
      setWeather(w);
      seedIncidentsFromWeather(w, address);
    }
    setLastSync(new Date());
  }, [address]);

  useEffect(() => {
    const lat = location?.coords?.latitude;
    const lon = location?.coords?.longitude;
    loadWeather(lat, lon);
    const id = setInterval(() => loadWeather(lat, lon), 60000);
    return () => clearInterval(id);
  }, [location]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWeather(location?.coords?.latitude, location?.coords?.longitude);
    setRefreshing(false);
  }, [location, loadWeather]);

  const syncSeconds = Math.round((Date.now() - lastSync.getTime()) / 1000);
  const syncLabel = syncSeconds < 60 ? `${syncSeconds}s ago` : `${Math.floor(syncSeconds / 60)}m ago`;

  const areaLabel = address
    ? [address.district || address.subregion, address.region].filter(Boolean).join(', ')
    : 'Locating…';
  const coordLabel = location
    ? `${location.coords.latitude.toFixed(4)}° N, ${location.coords.longitude.toFixed(4)}° E`
    : '-- N, -- E';

  const handleSOS = async () => {
    if (sendingSOS) return;
    setSendingSOS(true);

    const lat = location?.coords?.latitude;
    const lon = location?.coords?.longitude;

    if (!lat || !lon) {
      Alert.alert(
        'Location not ready',
        'Still trying to get your GPS location. Please wait a moment and try again.'
      );
      setSendingSOS(false);
      return;
    }

    // Log locally first — victim sees instant feedback.
    addIncident({
      title: 'SOS ACTIVATED',
      severity: 'CRITICAL',
      type: 'DEFAULT',
      detail: `SOS triggered at ${areaLabel}`,
      eta: 'Active',
    });

    try {
      const res = await fetch(`${API_BASE}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:         'guest',
          device_id:       'unknown_device',
          auth_token:      'guest_token',
          latitude:        lat,
          longitude:       lon,
          accuracy_meters: location?.coords?.accuracy ?? null,
          incident_type:   'SOS',
          detail:          `SOS triggered at ${areaLabel}`,
        }),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      Alert.alert('SOS Sent', 'Your emergency alert has been sent to the sector team.');
    } catch (err) {
      console.warn('SOS network send failed:', err.message);
      Alert.alert(
        'SOS Sent (offline)',
        'Logged on your device but could not reach the server.'
      );
    } finally {
      setSendingSOS(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="medical" size={20} color={COLORS.blue} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Command Center</Text>
              <Text style={styles.headerSub}>{SECTOR}</Text>
            </View>
          </View>
        </View>

        {/* ── Clock ── */}
        <View style={styles.operatorRow}>
          <View>
            <Text style={styles.clockText}>{formatTime(clock)}</Text>
            <Text style={styles.dateText}>{formatDate(clock)}</Text>
          </View>
          {weather && (
            <Text style={styles.weatherText}>{weather.temp}°C · {weather.humidity}% RH</Text>
          )}
        </View>

        {/* ── SOS ── */}
        <SOSButton onPress={handleSOS} disabled={sendingSOS} />

        {/* ── Live Status Pills ── */}
        <StatusBarWidget
          ping={ping}
          accuracy={location?.coords?.accuracy}
          battery={battery.level}
          dbm={dbm}
          networkType={network.type}
        />

        {/* ── Current Operational Area ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Current Area</Text>
            <Text style={styles.syncLabel}>Synced {syncLabel}</Text>
          </View>
          <Text style={styles.locationMain}>{areaLabel || 'Resolving…'}</Text>
          <Text style={styles.locationCoord}>{coordLabel}</Text>
          {weather && (
            <Text style={styles.weatherDetail}>
              Rain {weather.rain}mm · Wind {weather.windSpeed}km/h
            </Text>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="add-circle-outline"
            label="Log Medical Incident"
            onPress={() => navigation.navigate('LogMedical')}
          />
        </View>

        {/* ── Incident Log ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Incident Log</Text>
          <View style={{ height: 8 }} />
          <IncidentLog
            incidents={incidents}
            onPress={(inc) => navigation.navigate('IncidentDetail', { incident: inc })}
          />
        </View>

        {/* ── Advisory ── */}
        <View style={styles.advisory}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.blue} />
          <Text style={styles.advisoryText}>
            {weather
              ? weather.floodRisk === 'CRITICAL'
                ? 'Flood risk critical — avoid low-lying areas.'
                : `Weather normal. ${weather.temp}°C, wind ${weather.windSpeed} km/h.`
              : 'Maintain constant radio contact.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={COLORS.blue} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  header: { marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: {},
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },

  operatorRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  clockText: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '300', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  dateText: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  weatherText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderColor: COLORS.bgCardBorder, borderRadius: 12,
    padding: 14, marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  syncLabel: { color: COLORS.textMuted, fontSize: 11 },

  locationMain: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  locationCoord: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  weatherDetail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },

  actionsGrid: { gap: 10, marginBottom: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.bgCardBorder,
    borderRadius: 12, padding: 14,
  },
  actionLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' },

  advisory: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 4,
  },
  advisoryText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },
});