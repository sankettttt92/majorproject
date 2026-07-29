import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

export const socket = io(API_BASE, {
  autoConnect: true,
  transports: ["websocket"],
});

/**
 * joinUserRoom
 * Reads the registered user's UUID from AsyncStorage and tells the backend
 * to put this socket connection into that user's private room, so status
 * updates emitted via emit_status_update_to_user() reach only this device.
 * Safe to call multiple times (e.g. on every screen mount) — re-joining
 * the same room is harmless.
 */
export async function joinUserRoom() {
  const userId = await AsyncStorage.getItem("userId");
  if (!userId) {
    console.log("[socket] no userId in storage yet — skipping room join");
    return;
  }

  const doJoin = () => {
    socket.emit("join", { user_id: userId });
    console.log("[socket] joined room for user", userId);
  };

  if (socket.connected) {
    doJoin();
  } else {
    socket.once("connect", doJoin);
  }
}

/**
 * listenForStatusUpdates
 * Subscribes to incident:status_update events pushed from the backend.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function listenForStatusUpdates(onUpdate) {
  socket.on("incident:status_update", onUpdate);
  return () => socket.off("incident:status_update", onUpdate);
}