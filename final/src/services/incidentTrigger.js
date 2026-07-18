

// import { startChunkedRecording } from '@/services/silentRecorder';

// /**
//  * sendSOS
//  * Registers the incident with the backend only — does NOT start recording.
//  * Used for the manual SOS button press, where the person is already
//  * actively holding/looking at the phone, so silent recording isn't the
//  * priority the way it is for a shake-triggered (possibly can't-interact) SOS.
//  */
// export async function sendSOS({
//   location,
//   incidentId,
//   apiBase,
//   areaLabel,
//   onStatus = () => {},
// }) {
//   const latitude = location?.coords?.latitude ?? null;
//   const longitude = location?.coords?.longitude ?? null;

//   if (!latitude || !longitude) {
//     onStatus('Location not ready — SOS sent without exact coordinates');
//   }

//   let sosSucceeded = false;
//   try {
//     const res = await fetch(`${apiBase}/sos`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         incident_id: incidentId,
//         user_id: 'guest',
//         device_id: 'unknown_device',
//         auth_token: 'guest_token',
//         latitude,
//         longitude,
//         accuracy_meters: location?.coords?.accuracy ?? null,
//         incident_type: 'SOS',
//         detail: `SOS triggered at ${areaLabel ?? 'unknown area'}`,
//       }),
//     });
//     sosSucceeded = res.ok;
//     onStatus(sosSucceeded ? 'SOS sent' : 'SOS server error — logged locally');
//   } catch (err) {
//     console.warn('SOS network send failed:', err.message);
//     onStatus('SOS sent (offline) — could not reach server');
//   }

//   return { success: sosSucceeded };
// }

// /**
//  * runConfirmedIncidentTrigger
//  * Called ONLY when a shake is detected and confirmed via the countdown
//  * (countdown expired without cancellation — the "silent" scenario where
//  * the victim may not be able to safely interact with the phone). This is
//  * the one path that also starts silent chunked audio recording.
//  */
// export async function runConfirmedIncidentTrigger({
//   location,
//   incidentId,
//   apiBase,
//   areaLabel,
//   onStatus = () => {},
// }) {
//   const { success: sosSucceeded } = await sendSOS({
//     location,
//     incidentId,
//     apiBase,
//     areaLabel,
//     onStatus,
//   });

//   try {
//     await startChunkedRecording(incidentId, apiBase, onStatus);
//   } catch (err) {
//     console.warn('Failed to start chunked recording:', err);
//     onStatus('Could not start recording');
//   }

//   return { success: sosSucceeded };
// }

import { startChunkedRecording } from '@/services/silentRecorder';
import * as Location from 'expo-location';

/**
 * sendSOS
 * Registers the incident with the backend only — does NOT start recording.
 * Used for the manual SOS button press, where the person is already
 * actively holding/looking at the phone, so silent recording isn't the
 * priority the way it is for a shake-triggered (possibly can't-interact) SOS.
 */
export async function sendSOS({
  location,
  incidentId,
  apiBase,
  areaLabel,
  onStatus = () => {},
}) {
  const latitude = location?.coords?.latitude ?? null;
  const longitude = location?.coords?.longitude ?? null;

  if (!latitude || !longitude) {
    onStatus('Location not ready — SOS sent without exact coordinates');
  }

  let sosSucceeded = false;
  try {
    const res = await fetch(`${apiBase}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: incidentId,
        user_id: 'guest',
        device_id: 'unknown_device',
        auth_token: 'guest_token',
        latitude,
        longitude,
        accuracy_meters: location?.coords?.accuracy ?? null,
        incident_type: 'SOS',
        detail: `SOS triggered at ${areaLabel ?? 'unknown area'}`,
      }),
    });
    sosSucceeded = res.ok;
    onStatus(sosSucceeded ? 'SOS sent' : 'SOS server error — logged locally');
  } catch (err) {
    console.warn('SOS network send failed:', err.message);
    onStatus('SOS sent (offline) — could not reach server');
  }

  return { success: sosSucceeded };
}

/**
 * runConfirmedIncidentTrigger
 * Called ONLY when a shake is detected and confirmed via the countdown
 * (countdown expired without cancellation — the "silent" scenario where
 * the victim may not be able to safely interact with the phone). This is
 * the one path that also starts silent chunked audio recording.
 */
export async function runConfirmedIncidentTrigger({
  location,
  incidentId,
  apiBase,
  areaLabel,
  onStatus = () => {},
}) {
  const { success: sosSucceeded } = await sendSOS({
    location,
    incidentId,
    apiBase,
    areaLabel,
    onStatus,
  });

  try {
    await startChunkedRecording(incidentId, apiBase, onStatus);
  } catch (err) {
    console.warn('Failed to start chunked recording:', err);
    onStatus('Could not start recording');
  }

  return { success: sosSucceeded };
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * NEW — location ping loop (added, nothing above this line was changed)
 * ─────────────────────────────────────────────────────────────────────────
 */

// Keeps track of the running interval so it can be stopped later
// (e.g. when the user taps "I'm Safe" or a new incident starts).
let _pingIntervalId = null;

/**
 * startLocationPingLoop
 * Starts sending GPS pings to POST /incidents/{id}/location every
 * `intervalMs` (default 7000ms, within the 5-10 sec design range).
 *
 * Call this AFTER sendSOS / runConfirmedIncidentTrigger succeeds, using
 * the same incidentId that was just sent to /sos.
 *
 * Does not throw — network/location failures are logged via onStatus,
 * matching the existing pattern in sendSOS, so a lost signal never
 * crashes the app (it's exactly the "offline" case the backend
 * prediction engine is designed to detect).
 */
export function startLocationPingLoop(incidentId, apiBase, onStatus = () => {}, intervalMs = 7000) {
  // stop any previous loop first, so we never have two intervals running
  stopLocationPingLoop();

  const sendPing = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const res = await fetch(`${apiBase}/incidents/${incidentId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed ?? null,
          heading: loc.coords.heading ?? null,
          accuracy: loc.coords.accuracy ?? null,
        }),
      });

      if (!res.ok) {
        console.warn('Location ping failed:', res.status);
        onStatus('Location ping failed');
      }
    } catch (err) {
      // Expected if the phone loses signal — don't alert, just log.
      console.warn('Location ping error (device may be offline):', err.message);
      onStatus('Location ping failed (offline)');
    }
  };

  sendPing(); // fire one immediately, don't wait for the first interval tick
  _pingIntervalId = setInterval(sendPing, intervalMs);
}

/**
 * stopLocationPingLoop
 * Stops the ping loop, if one is running. Safe to call even if no loop
 * is active (e.g. on app mount, as a defensive reset).
 */
export function stopLocationPingLoop() {
  if (_pingIntervalId) {
    clearInterval(_pingIntervalId);
    _pingIntervalId = null;
  }
}