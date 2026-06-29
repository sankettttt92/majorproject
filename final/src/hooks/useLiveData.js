import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';

// ─── Live Location ──────────────────────────────────────────────────────────
export function useLocation() {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let sub;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        // Fallback to approximate Delhi NCR area shown in screenshot
        setLocation({ coords: { latitude: 28.5852, longitude: 77.3100, accuracy: 4 } });
        setAddress({ city: 'Noida', region: 'UP', district: 'Sector 14' });
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(current);

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      setAddress(geo);

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
        async (loc) => {
          setLocation(loc);
          const [g] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          setAddress(g);
        }
      );
    })();

    return () => sub?.remove();
  }, []);

  return { location, address, error };
}

// ─── Live Battery ────────────────────────────────────────────────────────────
export function useBattery() {
  const [battery, setBattery] = useState({ level: null, state: null });

  useEffect(() => {
    (async () => {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      setBattery({ level: Math.round(level * 100), state });
    })();

    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBattery((prev) => ({ ...prev, level: Math.round(batteryLevel * 100) }));
    });

    return () => sub.remove();
  }, []);

  return battery;
}

// ─── Live Network ────────────────────────────────────────────────────────────
export function useNetwork() {
  const [net, setNet] = useState({ type: null, isConnected: null });

  useEffect(() => {
    (async () => {
      const state = await Network.getNetworkStateAsync();
      setNet({
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    })();

    // Poll every 10s (expo-network has no change listener in SDK 52)
    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      setNet({
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return net;
}

// ─── Live Clock ──────────────────────────────────────────────────────────────
export function useClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

// ─── Simulated Signal Strength (dBm) ─────────────────────────────────────────
// React Native has no native API for raw dBm without a native module.
// We simulate realistic fluctuation around a base value.
export function useSignalStrength(base = -72) {
  const [dbm, setDbm] = useState(base);

  useEffect(() => {
    const id = setInterval(() => {
      const jitter = Math.floor(Math.random() * 10) - 5;
      setDbm(base + jitter);
    }, 4000);
    return () => clearInterval(id);
  }, [base]);

  return dbm;
}

// ─── Simulated Ping ──────────────────────────────────────────────────────────
export function usePing(url = 'https://1.1.1.1') {
  const [ping, setPing] = useState(null);

  useEffect(() => {
    const measure = async () => {
      try {
        const start = Date.now();
        await fetch(url, { method: 'HEAD', cache: 'no-store' });
        setPing(Date.now() - start);
      } catch {
        setPing(null);
      }
    };

    measure();
    const id = setInterval(measure, 8000);
    return () => clearInterval(id);
  }, [url]);

  return ping;
}