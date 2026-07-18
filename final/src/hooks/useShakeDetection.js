// import { useEffect, useRef } from 'react';
// import { Accelerometer } from 'expo-sensors';

// /**
//  * useShakeDetection
//  * Listens to the accelerometer and fires `onShake` when it detects a hard
//  * shake pattern (several rapid direction changes above a threshold within
//  * a short window). Works fully inside Expo Go — no native module required.
//  *
//  * Tune SHAKE_THRESHOLD / SHAKE_COUNT_REQUIRED / SHAKE_WINDOW_MS if it's
//  * triggering too easily (e.g. from walking) or not easily enough.
//  */
// const SHAKE_THRESHOLD = 1.8;       // combined acceleration delta to count as a "hit"
// const SHAKE_COUNT_REQUIRED = 3;    // how many hits needed to count as a real shake
// const SHAKE_WINDOW_MS = 1500;      // hits must all happen within this window
// const UPDATE_INTERVAL_MS = 100;    // how often we sample the accelerometer
// const COOLDOWN_MS = 5000;          // ignore new shakes for this long after triggering

// export function useShakeDetection(onShake, enabled = true) {
//   const lastValues = useRef({ x: 0, y: 0, z: 0 });
//   const hitTimestamps = useRef([]);
//   const lastTriggerRef = useRef(0);

//   useEffect(() => {
//     if (!enabled) return;

//     Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

//     const subscription = Accelerometer.addListener(({ x, y, z }) => {
//       const now = Date.now();

//       const deltaX = Math.abs(x - lastValues.current.x);
//       const deltaY = Math.abs(y - lastValues.current.y);
//       const deltaZ = Math.abs(z - lastValues.current.z);
//       lastValues.current = { x, y, z };

//       const combinedDelta = deltaX + deltaY + deltaZ;

//       if (combinedDelta > SHAKE_THRESHOLD) {
//         hitTimestamps.current.push(now);
//         hitTimestamps.current = hitTimestamps.current.filter(
//           (t) => now - t <= SHAKE_WINDOW_MS
//         );

//         if (
//           hitTimestamps.current.length >= SHAKE_COUNT_REQUIRED &&
//           now - lastTriggerRef.current > COOLDOWN_MS
//         ) {
//           lastTriggerRef.current = now;
//           hitTimestamps.current = [];
//           onShake();
//         }
//       }
//     });

//     return () => subscription && subscription.remove();
//   }, [enabled, onShake]);
// }

import { useEffect, useRef } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Vibration } from 'react-native';

/**
 * useShakeDetection
 *
 * Fires `onShake` when the phone registers a hard shake: both linear
 * acceleration AND rotation crossing their thresholds together, repeated
 * 3 times within a 2 second window.
 *
 * DEBUG_LOGGING: set to true while testing walking/jogging vs genuine
 * shake gestures. Logs every near-miss (either sensor crossing its
 * threshold alone) so you can see how close normal movement gets to
 * triggering, without actually lowering thresholds to find out. Set back
 * to false before shipping — this fires often enough to spam the console
 * in production.
 */
const DEBUG_LOGGING = true;

const ACCEL_THRESHOLD = 1.8;     // combined accel delta (g) to count as a "hit"
const GYRO_THRESHOLD = 3.0;      // combined rotation delta (rad/s) to count as a "hit"
const HITS_REQUIRED = 3;         // number of combined hits needed
const WINDOW_MS = 2000;          // hits must all land within this window
const UPDATE_INTERVAL_MS = 100;  // sensor sampling rate
const COOLDOWN_MS = 5000;        // ignore new shakes for this long after triggering

export function useShakeDetection(onShake, enabled = true) {
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });
  const lastGyro = useRef({ x: 0, y: 0, z: 0 });

  const latestAccelDelta = useRef(0);
  const latestGyroDelta = useRef(0);

  const hitTimestamps = useRef([]);
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);

    const registerHitIfCombined = () => {
      const now = Date.now();

      const accelHit = latestAccelDelta.current > ACCEL_THRESHOLD;
      const gyroHit = latestGyroDelta.current > GYRO_THRESHOLD;

      if (DEBUG_LOGGING && (accelHit || gyroHit)) {
        console.log(
          `[shake-debug] accel=${latestAccelDelta.current.toFixed(2)} ` +
          `gyro=${latestGyroDelta.current.toFixed(2)} ` +
          `accelHit=${accelHit} gyroHit=${gyroHit} ` +
          `combinedHit=${accelHit && gyroHit} ` +
          `hitsInWindow=${hitTimestamps.current.length}`
        );
      }

      // Don't let a shake re-fire immediately after it just triggered
      if (now - lastTriggerRef.current < COOLDOWN_MS) return;

      // Both linear acceleration and rotation must be spiking together
      if (!(accelHit && gyroHit)) return;

      hitTimestamps.current.push(now);
      hitTimestamps.current = hitTimestamps.current.filter(
        (t) => now - t <= WINDOW_MS
      );

      if (hitTimestamps.current.length >= HITS_REQUIRED) {
        hitTimestamps.current = [];
        lastTriggerRef.current = now;
        if (DEBUG_LOGGING) console.log('[shake-debug] SHAKE CONFIRMED — firing onShake()');
        Vibration.vibrate(200); // short haptic confirmation the shake registered
        onShake();
      }
    };

    const accelSub = Accelerometer.addListener(({ x, y, z }) => {
      const dx = x - lastAccel.current.x;
      const dy = y - lastAccel.current.y;
      const dz = z - lastAccel.current.z;
      latestAccelDelta.current = Math.sqrt(dx * dx + dy * dy + dz * dz);
      lastAccel.current = { x, y, z };
      registerHitIfCombined();
    });

    const gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      const dx = x - lastGyro.current.x;
      const dy = y - lastGyro.current.y;
      const dz = z - lastGyro.current.z;
      latestGyroDelta.current = Math.sqrt(dx * dx + dy * dy + dz * dz);
      lastGyro.current = { x, y, z };
      registerHitIfCombined();
    });

    return () => {
      accelSub && accelSub.remove();
      gyroSub && gyroSub.remove();
    };
  }, [enabled, onShake]);
}