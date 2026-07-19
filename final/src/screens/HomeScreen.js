

// //main code below 

// // 

// import React, { useEffect, useState, useCallback } from 'react';
// import {
//   View, Text, ScrollView, TouchableOpacity,
//   StyleSheet, Alert, RefreshControl,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import * as ImagePicker from 'expo-image-picker';
// import * as Crypto from 'expo-crypto';

// import { useLocation, useBattery, useNetwork, useClock, useSignalStrength, usePing } from '@/hooks/useLiveData';
// import { useShakeDetection } from '@/hooks/useShakeDetection';
// import { fetchWeather, seedIncidentsFromWeather } from '@/services/weatherService';
// import { useIncidents } from '@/services/Incidentstore';
// import { supabase } from '@/services/supabaseClient'; // adjust path if different
// import { runConfirmedIncidentTrigger, startLocationPingLoop } from '@/services/incidentTrigger';
// import StatusBarWidget from '@/components/StatusBarWidget';
// import SOSCountdown from '@/components/SOSCountdown';
// import { formatTime, formatDate } from '@/utils/time';

// const SECTOR = 'Sector 7';
// const USER_NAME = 'Sanket';

// // Use your laptop's LAN IP when testing on a physical phone.
// // NOTE: this can change whenever your laptop reconnects to Wi-Fi. If uploads
// // suddenly start failing with "network request failed" on the /media call,
// // check this IP first (run ipconfig / ifconfig on the laptop).
// const API_BASE = 'http:// 192.168.0.100:8000';

// const MEDIA_BUCKET = 'rakshak'; // Supabase Storage bucket name — adjust if different

// // RAKSHAK brand palette (navy) — kept aligned with Welcome / Login / Register screens.
// // Semantic colors (SOS red, weather green/orange/sky) are left untouched since they
// // carry meaning independent of brand color.
// const COLORS = {
//   appBg: '#F4F4FA',

//   cardPrimary: '#FFFFFF',
//   cardSecondary: '#F7F7FB',
//   cardHighlight: '#ECECF7',

//   border: '#E5E7EB',

//   blue: '#000080',
//   blueLight: '#E0E0F0',
//   blueDark: '#00005C',

//   sosRed: '#DC2626',
//   sosLightBg: '#FEE2E2',

//   green: '#16A34A',
//   greenLight: '#DCFCE7',

//   orange: '#EA580C',
//   orangeLight: '#FFEDD5',

//   sky: '#0284C7',
//   skyLight: '#E0F2FE',

//   textHeading: '#111827',
//   textPrimary: '#1F2937',
//   textSecondary: '#6B7280',
//   textPlaceholder: '#94A3B8',

//   iconBlue: '#000080',
//   iconSecondary: '#64748B',

//   shadow: 'rgba(15,23,42,0.08)',

//   areaCardBg: '#ECECF7',
//   areaCardBorder: '#C7C7E3',

//   advisoryBg: '#F0F9FF',
//   advisoryBorder: '#BAE6FD',
//   advisoryIcon: '#0284C7',
// };

// export default function HomeScreen({ navigation }) {
//   const { location, address } = useLocation();
//   const battery = useBattery();
//   const network = useNetwork();
//   const clock = useClock();
//   const dbm = useSignalStrength(-72);
//   const ping = usePing('https://1.1.1.1');

//   const { addIncident } = useIncidents();
//   const [weather, setWeather] = useState(null);
//   const [lastSync, setLastSync] = useState(new Date());
//   const [refreshing, setRefreshing] = useState(false);
//   const [sendingSOS, setSendingSOS] = useState(false);
//   const [uploadingPhoto, setUploadingPhoto] = useState(false);
//   const [showCountdown, setShowCountdown] = useState(false);
//   const [recordingStatus, setRecordingStatus] = useState('');

//   // Client-generated incident_id, shared between /media and /sos so photos
//   // and audio taken before or after SOS is pressed still get linked to the
//   // right incident once it's created (see backend models/media_upload.py).
//   const [incidentId, setIncidentId] = useState(() => Crypto.randomUUID());

//   const loadWeather = useCallback(async (lat, lon) => {
//     const w = await fetchWeather(lat ?? 28.5852, lon ?? 77.31);
//     if (w) {
//       setWeather(w);
//       seedIncidentsFromWeather(w, address);
//     }
//     setLastSync(new Date());
//   }, [address]);

//   useEffect(() => {
//     const lat = location?.coords?.latitude;
//     const lon = location?.coords?.longitude;
//     loadWeather(lat, lon);
//     const id = setInterval(() => loadWeather(lat, lon), 60000);
//     return () => clearInterval(id);
//   }, [location]);

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     await loadWeather(location?.coords?.latitude, location?.coords?.longitude);
//     setRefreshing(false);
//   }, [location, loadWeather]);

//   const syncSeconds = Math.round((Date.now() - lastSync.getTime()) / 1000);
//   const syncLabel = syncSeconds < 60 ? `${syncSeconds}s ago` : `${Math.floor(syncSeconds / 60)}m ago`;

//   const areaLabel = address
//     ? [address.district || address.subregion, address.region].filter(Boolean).join(', ')
//     : 'Locating…';
//   const coordLabel = location
//     ? `${location.coords.latitude.toFixed(4)}° N, ${location.coords.longitude.toFixed(4)}° E`
//     : '-- N, -- E';

//   // ── Core SOS logic (used by both the button and the confirmed shake trigger) ──
//   const handleSOS = async () => {
//     if (sendingSOS) return;
//     setSendingSOS(true);

//     // Log locally first — victim sees instant feedback.
//     addIncident({
//       title: 'SOS ACTIVATED',
//       severity: 'CRITICAL',
//       type: 'DEFAULT',
//       detail: `SOS triggered at ${areaLabel}`,
//       eta: 'Active',
//     });

//     await runConfirmedIncidentTrigger({
//       location,
//       incidentId,
//       apiBase: API_BASE,
//       areaLabel,
//       onStatus: (msg) => {
//         console.log('[incident]', msg);
//         setRecordingStatus(msg);
//       },
//     });

//     // Start sending GPS pings for this incident every ~7 sec, so the
//     // backend's incident_location_history table has data to predict an
//     // offline search area from, if this victim's phone loses signal.
//     // Uses the same incidentId captured by closure above, same pattern
//     // startChunkedRecording already relies on.
//     startLocationPingLoop(incidentId, API_BASE, (msg) => {
//       console.log('[location]', msg);
//     });

//     // Prepare a fresh id for the NEXT incident. Any chunks still uploading
//     // from this incident already captured the old id via closure when
//     // startChunkedRecording was called, so this doesn't affect them —
//     // it only affects what a future SOS press/shake will use.
//     setIncidentId(Crypto.randomUUID());

//     Alert.alert('SOS Sent', 'Your emergency alert has been sent to the sector team.');
//     setSendingSOS(false);
//   };

//   // ── Shake detection: never fires SOS directly, always shows the countdown first ──
//   useShakeDetection(() => {
//     if (!sendingSOS && !showCountdown) {
//       setShowCountdown(true);
//     }
//   }, true);

//   const handleCountdownConfirm = () => {
//     setShowCountdown(false);
//     handleSOS(); // countdown expired without cancellation — proceed
//   };

//   const handleCountdownCancel = () => {
//     setShowCountdown(false); // false trigger (e.g. jogging) — do nothing
//   };

//   const handleCapturePhoto = async () => {
//     if (uploadingPhoto) return;

//     const { status } = await ImagePicker.requestCameraPermissionsAsync();
//     if (status !== 'granted') {
//       Alert.alert('Camera permission needed', 'Enable camera access to attach a photo.');
//       return;
//     }

//     const result = await ImagePicker.launchCameraAsync({
//       quality: 0.7,
//       base64: false,
//     });

//     if (result.canceled || !result.assets?.length) return;

//     const asset = result.assets[0];
//     setUploadingPhoto(true);

//     try {
//       const response = await fetch(asset.uri);
//       const blob = await response.blob();
//       const ext = asset.uri.split('.').pop() || 'jpg';
//       const storagePath = `${incidentId}/${Date.now()}.${ext}`;

//       const { error: uploadError } = await supabase.storage
//         .from(MEDIA_BUCKET)
//         .upload(storagePath, blob, {
//           contentType: asset.mimeType || 'image/jpeg',
//           upsert: false,
//         });

//       if (uploadError) throw uploadError;

//       const { data: publicUrlData } = supabase.storage
//         .from(MEDIA_BUCKET)
//         .getPublicUrl(storagePath);

//       const registerRes = await fetch(`${API_BASE}/media`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           media_type: 'photo',
//           file_path: publicUrlData.publicUrl,
//           file_size_bytes: blob.size ?? null,
//           mime_type: asset.mimeType || 'image/jpeg',
//           uploaded_by: 'guest',
//           incident_id: incidentId,
//         }),
//       });

//       if (!registerRes.ok) throw new Error(`Server responded ${registerRes.status}`);

//       Alert.alert('Photo Attached', 'The photo has been uploaded and linked to this incident.');
//     } catch (err) {
//       console.warn('Photo upload failed:', err);
//       Alert.alert('Upload Failed', err.message || 'Could not upload the photo. Please try again.');
//     } finally {
//       setUploadingPhoto(false);
//     }
//   };

//   return (
//     <SafeAreaView style={styles.safe} edges={['top']}>
//       <ScrollView
//         style={styles.scroll}
//         contentContainerStyle={styles.content}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
//       >
//         {/* ── Header (transparent background) ── */}
//         <View style={styles.header}>
//           <View style={styles.headerLeft}>
//             <View style={styles.avatarCircle}>
//               <Ionicons name="person" size={20} color={COLORS.blue} />
//             </View>
//             <View>
//               <Text style={styles.greetingText}>Good Morning,</Text>
//               <Text style={styles.greetingName}>{USER_NAME}</Text>
//               <Text style={styles.headerSub}>Command Center · {SECTOR}</Text>
//             </View>
//           </View>

//           {weather && (
//             <View style={styles.weatherPill}>
//               <Ionicons name="cloud-outline" size={16} color={COLORS.blue} />
//               <View style={{ marginLeft: 6 }}>
//                 <Text style={styles.weatherPillTemp}>{weather.temp}°C</Text>
//                 <Text style={styles.weatherPillSub}>{weather.humidity}% HUMID</Text>
//               </View>
//             </View>
//           )}
//         </View>

//         {/* ── Clock & Weather card ── */}
//         <View style={styles.clockCard}>
//           <Text style={styles.dateText}>{formatDate(clock)}</Text>
//           <Text style={styles.clockText}>{formatTime(clock)}</Text>
//         </View>

//         {/* ── Live Status Pills ── */}
//         <View style={styles.statusWrap}>
//           <StatusBarWidget
//             ping={ping}
//             accuracy={location?.coords?.accuracy}
//             battery={battery.level}
//             dbm={dbm}
//             networkType={network.type}
//           />
//         </View>

//         {/* ── Current Operational Area (Highlight card) ── */}
//         <View style={styles.areaCard}>
//           <View style={styles.cardTopRow}>
//             <View style={styles.cardLabelRow}>
//               <Ionicons name="navigate-outline" size={13} color={COLORS.blue} />
//               <Text style={styles.cardLabelAccent}>CURRENT LOCATION</Text>
//             </View>
//             <View style={styles.weatherIconBox}>
//               <Ionicons name="sunny-outline" size={18} color={COLORS.orange} />
//             </View>
//           </View>

//           <Text style={styles.locationMain}>{areaLabel || 'Resolving…'}</Text>
//           <Text style={styles.locationCoord}>{coordLabel}</Text>

//           <View style={styles.cardDivider} />

//           <View style={styles.cardBottomRow}>
//             <View style={styles.syncRow}>
//               <Ionicons name="sync-outline" size={12} color={COLORS.textPlaceholder} />
//               <Text style={styles.syncLabel}>Last synced {syncLabel}</Text>
//             </View>
//             <TouchableOpacity onPress={onRefresh}>
//               <Text style={styles.refreshLabel}>REFRESH MAP</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* ── SOS Button (white card, red button, light-red glow) ── */}
//         <View style={styles.sosCard}>
//           <View style={styles.sosOuterRing}>
//             <TouchableOpacity
//               style={[styles.sosCircle, sendingSOS && styles.sosCircleDisabled]}
//               onPress={handleSOS}
//               disabled={sendingSOS}
//               activeOpacity={0.85}
//             >
//               <Ionicons name="location" size={30} color="#FFFFFF" />
//               <Text style={styles.sosLabel}>SOS</Text>
//             </TouchableOpacity>
//           </View>

//           {!!recordingStatus && (
//             <Text style={styles.recordingStatus}>
//               Recording status: <Text style={styles.recordingStatusHighlight}>{recordingStatus}</Text>
//             </Text>
//           )}

//           <Text style={styles.sosHint}>Shake phone or tap for emergency response</Text>
//           <Text style={styles.sosProtocol}>PROTOCOL ACTIVE</Text>
//         </View>

//         {/* ── Quick Actions (white card, blue-light icon circles) ── */}
//         <View style={styles.actionsRow}>
//           <TouchableOpacity
//             style={styles.actionCard}
//             onPress={() => navigation.navigate('LogMedical')}
//             activeOpacity={0.7}
//           >
//             <View style={styles.actionIconBox}>
//               <Ionicons name="briefcase-outline" size={20} color={COLORS.iconBlue} />
//             </View>
//             <Text style={styles.actionLabel}>Medical Log</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.actionCard, uploadingPhoto && styles.actionCardDisabled]}
//             onPress={handleCapturePhoto}
//             disabled={uploadingPhoto}
//             activeOpacity={0.7}
//           >
//             <View style={styles.actionIconBox}>
//               <Ionicons name="camera-outline" size={20} color={COLORS.iconBlue} />
//             </View>
//             <Text style={styles.actionLabel}>
//               {uploadingPhoto ? 'Uploading…' : 'Attach Photo'}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* ── Advisory Card ── */}
//         <View style={styles.advisoryCard}>
//           <View style={styles.advisoryIconBox}>
//             <Ionicons name="information-circle-outline" size={18} color={COLORS.advisoryIcon} />
//           </View>
//           <View style={{ flex: 1 }}>
//             <Text
//               style={[
//                 styles.advisoryTitle,
//                 weather?.floodRisk === 'CRITICAL' && { color: COLORS.sosRed },
//               ]}
//             >
//               {weather
//                 ? weather.floodRisk === 'CRITICAL'
//                   ? 'Flood risk critical'
//                   : `Weather normal — ${weather.temp}°C`
//                 : 'Maintain constant radio contact'}
//             </Text>
//             <Text style={styles.advisoryText}>
//               {weather
//                 ? weather.floodRisk === 'CRITICAL'
//                   ? 'Avoid low-lying areas. Emergency teams on standby.'
//                   : `Wind ${weather.windSpeed} km/h · Rain ${weather.rain}mm`
//                 : 'Emergency teams on standby.'}
//             </Text>
//           </View>
//         </View>
//       </ScrollView>

//       {/* ── Shake-triggered SOS confirmation ── */}
//       <SOSCountdown
//         visible={showCountdown}
//         onConfirm={handleCountdownConfirm}
//         onCancel={handleCountdownCancel}
//       />
//     </SafeAreaView>
//   );
// }

// const CARD_SHADOW = {
//   shadowColor: COLORS.shadow,
//   shadowOffset: { width: 0, height: 4 },
//   shadowOpacity: 1,
//   shadowRadius: 12,
//   elevation: 3,
// };

// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: COLORS.appBg },
//   scroll: { flex: 1 },
//   content: { padding: 18, paddingBottom: 40 },

//   // ── Header ──
//   header: {
//     flexDirection: 'row', justifyContent: 'space-between',
//     alignItems: 'flex-start', marginBottom: 20,
//     backgroundColor: 'transparent',
//   },
//   headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
//   avatarCircle: {
//     width: 44, height: 44, borderRadius: 22,
//     backgroundColor: COLORS.blueLight,
//     justifyContent: 'center', alignItems: 'center',
//   },
//   greetingText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
//   greetingName: { color: COLORS.textHeading, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold', marginTop: -2 },
//   headerSub: { color: COLORS.textPlaceholder, fontSize: 12, marginTop: 2 },

//   weatherPill: {
//     flexDirection: 'row', alignItems: 'center',
//     backgroundColor: COLORS.cardPrimary,
//     borderWidth: 1, borderColor: COLORS.border,
//     borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
//     ...CARD_SHADOW,
//   },
//   weatherPillTemp: { color: COLORS.textHeading, fontSize: 14, fontWeight: '700' },
//   weatherPillSub: { color: COLORS.blue, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

//   // ── Clock card ──
//   clockCard: {
//     backgroundColor: COLORS.cardPrimary,
//     borderWidth: 1, borderColor: COLORS.border,
//     borderRadius: 18,
//     alignItems: 'center',
//     paddingVertical: 20,
//     marginBottom: 20,
//     ...CARD_SHADOW,
//   },
//   dateText: { color: COLORS.textPlaceholder, fontSize: 13, marginBottom: 4 },
//   clockText: { color: COLORS.textHeading, fontSize: 40, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },

//   statusWrap: { marginBottom: 18 },

//   // ── Current Area (Highlight card) ──
//   areaCard: {
//     backgroundColor: COLORS.areaCardBg,
//     borderWidth: 1, borderColor: COLORS.areaCardBorder,
//     borderRadius: 18,
//     padding: 18, marginBottom: 20,
//     ...CARD_SHADOW,
//   },
//   cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
//   cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
//   cardLabelAccent: { color: COLORS.blue, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
//   weatherIconBox: {
//     width: 34, height: 34, borderRadius: 10,
//     backgroundColor: COLORS.orangeLight,
//     justifyContent: 'center', alignItems: 'center',
//   },

//   locationMain: { color: COLORS.textHeading, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 10 },
//   locationCoord: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },

//   cardDivider: { height: 1, backgroundColor: COLORS.areaCardBorder, marginVertical: 12 },

//   cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
//   syncLabel: { color: COLORS.textPlaceholder, fontSize: 11 },
//   refreshLabel: { color: COLORS.blueDark, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

//   // ── SOS ──
//   sosCard: {
//     backgroundColor: COLORS.cardPrimary,
//     borderWidth: 1, borderColor: COLORS.border,
//     borderRadius: 18,
//     alignItems: 'center',
//     paddingVertical: 24, paddingHorizontal: 16,
//     marginBottom: 20,
//     ...CARD_SHADOW,
//   },
//   sosOuterRing: {
//     width: 200, height: 200, borderRadius: 100,
//     backgroundColor: COLORS.sosLightBg,
//     justifyContent: 'center', alignItems: 'center',
//     marginBottom: 14,
//   },
//   sosCircle: {
//     width: 160, height: 160, borderRadius: 80,
//     backgroundColor: COLORS.sosRed,
//     borderWidth: 6, borderColor: '#FFFFFF',
//     justifyContent: 'center', alignItems: 'center',
//     shadowColor: COLORS.sosRed, shadowOpacity: 0.35,
//     shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
//     elevation: 6,
//   },
//   sosCircleDisabled: { opacity: 0.6 },
//   sosLabel: { color: '#FFFFFF', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1, marginTop: 4 },

//   recordingStatus: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
//   recordingStatusHighlight: { color: COLORS.sosRed, fontWeight: '700' },
//   sosHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
//   sosProtocol: { color: COLORS.sosRed, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 },

//   // ── Quick Actions ──
//   actionsRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
//   actionCard: {
//     flex: 1, alignItems: 'center',
//     backgroundColor: COLORS.cardPrimary,
//     borderWidth: 1, borderColor: COLORS.border,
//     borderRadius: 18, paddingVertical: 20,
//     ...CARD_SHADOW,
//   },
//   actionCardDisabled: { opacity: 0.5 },
//   actionIconBox: {
//     width: 44, height: 44, borderRadius: 22,
//     backgroundColor: COLORS.blueLight,
//     justifyContent: 'center', alignItems: 'center',
//     marginBottom: 10,
//   },
//   actionLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },

//   // ── Advisory ──
//   advisoryCard: {
//     flexDirection: 'row', gap: 12,
//     backgroundColor: COLORS.advisoryBg,
//     borderWidth: 1, borderColor: COLORS.advisoryBorder,
//     borderRadius: 18,
//     padding: 18,
//     ...CARD_SHADOW,
//   },
//   advisoryIconBox: {
//     width: 32, height: 32, borderRadius: 9,
//     backgroundColor: COLORS.skyLight,
//     justifyContent: 'center', alignItems: 'center',
//   },
//   advisoryTitle: { color: COLORS.textHeading, fontSize: 13, fontWeight: '700' },
//   advisoryText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
// });

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

import { useLocation, useBattery, useNetwork, useClock, useSignalStrength, usePing } from '@/hooks/useLiveData';
import { useShakeDetection } from '@/hooks/useShakeDetection';
import { fetchWeather, seedIncidentsFromWeather } from '@/services/weatherService';
import { useIncidents } from '@/services/Incidentstore';
import { supabase } from '@/services/supabaseClient'; // adjust path if different
import { runConfirmedIncidentTrigger, startLocationPingLoop } from '@/services/incidentTrigger';
import StatusBarWidget from '@/components/StatusBarWidget';
import SOSCountdown from '@/components/SOSCountdown';
import { formatTime, formatDate } from '@/utils/time';

const SECTOR = 'Sector 7';
const USER_NAME = 'Sanket';

// Use your laptop's LAN IP when testing on a physical phone.
// NOTE: this can change whenever your laptop reconnects to Wi-Fi. If uploads
// suddenly start failing with "network request failed" on the /media call,
// check this IP first (run ipconfig / ifconfig on the laptop).
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

const MEDIA_BUCKET = 'rakshak'; // Supabase Storage bucket name — adjust if different

// ── RAKSHAK brand palette — premium government / public safety look ──
// Restricted to primary blue + neutrals + emergency red only, per brand spec.
const COLORS = {
  appBg: '#F8FAFC',

  surface: '#FFFFFF',
  border: '#E5E7EB',

  primary: '#1034A6',
  primaryDark: '#0B2678',
  primaryTint: '#E8ECF9',   // light blue chip / icon-box background
  primaryTintBorder: '#D3DCF3',

  sosRed: '#DC2626',
  sosRedTint: '#FEE2E2',

  textHeading: '#111827',
  textSecondary: '#6B7280',
  textPlaceholder: '#94A3B8',

  shadow: 'rgba(16,52,166,0.10)',
};

export default function HomeScreen({ navigation }) {
  const { location, address } = useLocation();
  const battery = useBattery();
  const network = useNetwork();
  const clock = useClock();
  const dbm = useSignalStrength(-72);
  const ping = usePing('https://1.1.1.1');

  const { addIncident } = useIncidents();
  const [weather, setWeather] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [sendingSOS, setSendingSOS] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');

  // Client-generated incident_id, shared between /media and /sos so photos
  // and audio taken before or after SOS is pressed still get linked to the
  // right incident once it's created (see backend models/media_upload.py).
  const [incidentId, setIncidentId] = useState(() => Crypto.randomUUID());

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

  // ── Core SOS logic (used by both the button and the confirmed shake trigger) ──
  const handleSOS = async () => {
    if (sendingSOS) return;
    setSendingSOS(true);

    // Log locally first — victim sees instant feedback.
    addIncident({
      title: 'SOS ACTIVATED',
      severity: 'CRITICAL',
      type: 'DEFAULT',
      detail: `SOS triggered at ${areaLabel}`,
      eta: 'Active',
    });

    await runConfirmedIncidentTrigger({
      location,
      incidentId,
      apiBase: API_BASE,
      areaLabel,
      onStatus: (msg) => {
        console.log('[incident]', msg);
        setRecordingStatus(msg);
      },
    });

    // Start sending GPS pings for this incident every ~7 sec, so the
    // backend's incident_location_history table has data to predict an
    // offline search area from, if this victim's phone loses signal.
    // Uses the same incidentId captured by closure above, same pattern
    // startChunkedRecording already relies on.
    startLocationPingLoop(incidentId, API_BASE, (msg) => {
      console.log('[location]', msg);
    });

    // Prepare a fresh id for the NEXT incident. Any chunks still uploading
    // from this incident already captured the old id via closure when
    // startChunkedRecording was called, so this doesn't affect them —
    // it only affects what a future SOS press/shake will use.
    setIncidentId(Crypto.randomUUID());

    Alert.alert('SOS Sent', 'Your emergency alert has been sent to the sector team.');
    setSendingSOS(false);
  };

  // ── Shake detection: never fires SOS directly, always shows the countdown first ──
  useShakeDetection(() => {
    if (!sendingSOS && !showCountdown) {
      setShowCountdown(true);
    }
  }, true);

  const handleCountdownConfirm = () => {
    setShowCountdown(false);
    handleSOS(); // countdown expired without cancellation — proceed
  };

  const handleCountdownCancel = () => {
    setShowCountdown(false); // false trigger (e.g. jogging) — do nothing
  };

  const handleCapturePhoto = async () => {
    if (uploadingPhoto) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Enable camera access to attach a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop() || 'jpg';
      const storagePath = `${incidentId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, blob, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(storagePath);

      const registerRes = await fetch(`${API_BASE}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'photo',
          file_path: publicUrlData.publicUrl,
          file_size_bytes: blob.size ?? null,
          mime_type: asset.mimeType || 'image/jpeg',
          uploaded_by: 'guest',
          incident_id: incidentId,
        }),
      });

      if (!registerRes.ok) throw new Error(`Server responded ${registerRes.status}`);

      Alert.alert('Photo Attached', 'The photo has been uploaded and linked to this incident.');
    } catch (err) {
      console.warn('Photo upload failed:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload the photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <LinearGradient
      colors={['#E4EAF8', '#A9D0F8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.greetingText}>Good Morning,</Text>
              <Text style={styles.greetingName}>{USER_NAME}</Text>
              <Text style={styles.headerSub}>Command Center · {SECTOR}</Text>
            </View>
          </View>

          {weather && (
            <View style={styles.weatherPill}>
              <Ionicons name="partly-sunny-outline" size={16} color={COLORS.primary} />
              <View style={{ marginLeft: 6 }}>
                <Text style={styles.weatherPillTemp}>{weather.temp}°C</Text>
                <Text style={styles.weatherPillSub}>{weather.humidity}% HUMID</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Clock card ── */}
        <View style={styles.clockCard}>
          <Text style={styles.dateText}>{formatDate(clock)}</Text>
          <Text style={styles.clockText}>{formatTime(clock)}</Text>
        </View>

        {/* ── Live Status chips ── */}
        <View style={styles.statusWrap}>
          <StatusBarWidget
            ping={ping}
            accuracy={location?.coords?.accuracy}
            battery={battery.level}
            dbm={dbm}
            networkType={network.type}
          />
        </View>

        {/* ── Current Location card ── */}
        <View style={styles.areaCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardLabelRow}>
              <View style={styles.locationIconBox}>
                <Ionicons name="location" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.cardLabelAccent}>CURRENT LOCATION</Text>
            </View>
          </View>

          <Text style={styles.locationMain}>{areaLabel || 'Resolving…'}</Text>
          <Text style={styles.locationCoord}>{coordLabel}</Text>

          <View style={styles.cardDivider} />

          <View style={styles.cardBottomRow}>
            <View style={styles.syncRow}>
              <Ionicons name="sync-outline" size={12} color={COLORS.textPlaceholder} />
              <Text style={styles.syncLabel}>Last synced {syncLabel}</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
              <Ionicons name="refresh" size={13} color="#FFFFFF" />
              <Text style={styles.refreshLabel}>REFRESH</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SOS section ── */}
        <View style={styles.sosCard}>
          <View style={styles.sosOuterRing}>
            <TouchableOpacity
              style={styles.sosTouchable}
              onPress={handleSOS}
              disabled={sendingSOS}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={sendingSOS ? ['#F3A6A6', '#E48A8A'] : ['#EF4444', '#B91C1C']}
                style={styles.sosCircle}
              >
                <Ionicons name="alert" size={30} color="#FFFFFF" />
                <Text style={styles.sosLabel}>SOS</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {!!recordingStatus && (
            <Text style={styles.recordingStatus}>
              Recording status: <Text style={styles.recordingStatusHighlight}>{recordingStatus}</Text>
            </Text>
          )}

          <Text style={styles.sosHint}>Shake phone or tap for emergency response</Text>
          <Text style={styles.sosProtocol}>PROTOCOL ACTIVE</Text>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('LogMedical')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="medical-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Medical Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, uploadingPhoto && styles.actionCardDisabled]}
            onPress={handleCapturePhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>
              {uploadingPhoto ? 'Uploading…' : 'Attach Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Safety Advisory card ── */}
        <View style={styles.advisoryCard}>
          <View style={styles.advisoryAccentBar} />
          <View style={styles.advisoryIconBox}>
            <Ionicons
              name="information-circle"
              size={18}
              color={weather?.floodRisk === 'CRITICAL' ? COLORS.sosRed : COLORS.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.advisoryTitle,
                weather?.floodRisk === 'CRITICAL' && { color: COLORS.sosRed },
              ]}
            >
              {weather
                ? weather.floodRisk === 'CRITICAL'
                  ? 'Flood risk critical'
                  : `Weather normal — ${weather.temp}°C`
                : 'Maintain constant radio contact'}
            </Text>
            <Text style={styles.advisoryText}>
              {weather
                ? weather.floodRisk === 'CRITICAL'
                  ? 'Avoid low-lying areas. Emergency teams on standby.'
                  : `Wind ${weather.windSpeed} km/h · Rain ${weather.rain}mm`
                : 'Emergency teams on standby.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Shake-triggered SOS confirmation ── */}
      <SOSCountdown
        visible={showCountdown}
        onConfirm={handleCountdownConfirm}
        onCancel={handleCountdownCancel}
      />
    </SafeAreaView>
    </LinearGradient>
  );
}

const CARD_SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 3,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // ── Header ──
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 24,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center', alignItems: 'center',
  },
  greetingText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  greetingName: { color: COLORS.textHeading, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginTop: -2 },
  headerSub: { color: COLORS.textPlaceholder, fontSize: 12, marginTop: 2 },

  weatherPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12,
    ...CARD_SHADOW,
  },
  weatherPillTemp: { color: COLORS.textHeading, fontSize: 14, fontWeight: '700' },
  weatherPillSub: { color: COLORS.primary, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  // ── Clock card ──
  clockCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  dateText: { color: COLORS.textPlaceholder, fontSize: 13, marginBottom: 4 },
  clockText: {
    color: COLORS.textHeading, fontSize: 40, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.5, fontVariant: ['tabular-nums'],
  },

  statusWrap: { marginBottom: 16 },

  // ── Current Location card ──
  areaCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20,
    padding: 20, marginBottom: 16,
    ...CARD_SHADOW,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationIconBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center', alignItems: 'center',
  },
  cardLabelAccent: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  locationMain: { color: COLORS.textHeading, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 14 },
  locationCoord: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },

  cardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncLabel: { color: COLORS.textPlaceholder, fontSize: 11 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12,
  },
  refreshLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  // ── SOS ──
  sosCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 28, paddingHorizontal: 16,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  sosOuterRing: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: COLORS.sosRedTint,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  sosTouchable: {
    width: 160, height: 160, borderRadius: 80,
    shadowColor: COLORS.sosRed, shadowOpacity: 0.35,
    shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sosCircle: {
    flex: 1, borderRadius: 80,
    borderWidth: 6, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  sosLabel: { color: '#FFFFFF', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1, marginTop: 4 },

  recordingStatus: { color: COLORS.textHeading, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  recordingStatusHighlight: { color: COLORS.sosRed, fontWeight: '700' },
  sosHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
  sosProtocol: { color: COLORS.sosRed, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 },

  // ── Quick Actions ──
  actionsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  actionCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingVertical: 22,
    ...CARD_SHADOW,
  },
  actionCardDisabled: { opacity: 0.5 },
  actionIconBox: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.primaryTintBorder,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: { color: COLORS.textHeading, fontSize: 13, fontWeight: '600' },

  // ── Advisory ──
  advisoryCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  advisoryAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.primary,
  },
  advisoryIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 4,
  },
  advisoryTitle: { color: COLORS.textHeading, fontSize: 13, fontWeight: '700' },
  advisoryText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
});