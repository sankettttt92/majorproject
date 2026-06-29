// In your React Native screen that already has location access,
// add this useEffect alongside your existing location logic.
// Replace TEAM_ID with the logged-in team's id (from your auth/context).

import { useEffect, useRef } from "react";
import * as Location from "expo-location";

const API_BASE = "http://<your-server-ip>:8000"; // same as your existing config
const TEAM_ID  = "<team-id-from-auth>";           // replace with real value

export function useTeamLocationPing() {
  const intervalRef = useRef(null);

  useEffect(() => {
    async function ping() {
      try {
        const { coords } = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        await fetch(`${API_BASE}/teams/${TEAM_ID}/location`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            latitude:  coords.latitude,
            longitude: coords.longitude,
          }),
        });
      } catch (e) {
        // silent — next ping will retry
      }
    }

    ping(); // immediate first ping
    intervalRef.current = setInterval(ping, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);
}