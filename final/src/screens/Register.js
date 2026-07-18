import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Point this at your running server.js (use your machine's LAN IP for a physical device,
// 10.0.2.2 for Android emulator, localhost for iOS simulator)
const API_BASE_URL = "http://192.168.0.100:8000";

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    emergencyPhone: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      // 1. Ask for permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location access so we can fill in your address."
        );
        return;
      }

      // 2. Get current GPS coordinates
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;

      // 3. Reverse-geocode coordinates into a human-readable address
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (place) {
        const formattedAddress = [
          place.name,
          place.street,
          place.city,
          place.region,
          place.postalCode,
        ]
          .filter(Boolean)
          .join(", ");

        update("address", formattedAddress || `${latitude}, ${longitude}`);
      } else {
        // Fall back to raw coordinates if reverse geocoding returns nothing
        update("address", `${latitude}, ${longitude}`);
      }
    } catch (err) {
      console.error("Error getting current location:", err);
      Alert.alert(
        "Couldn't get location",
        "Please check that location services are enabled and try again."
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.phone || !form.emergencyPhone) {
      Alert.alert(
        "Missing info",
        "Please fill in your name, phone, and emergency contact number."
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          emergencyPhone: form.emergencyPhone,
          address: form.address,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to save profile");
      }

      const savedProfile = await response.json();
      console.log("Saved profile:", savedProfile);

      navigation.navigate("Home");
    } catch (err) {
      console.error("Error saving safety profile:", err);
      Alert.alert("Something went wrong", "Couldn't save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Navy header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Profile</Text>
        <Text style={styles.headerSubtitle}>YOUR SAFETY IS OUR PRIORITY</Text>
      </View>

      {/* White scrollable card */}
      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create Your Safety{"\n"}Profile</Text>
          <Text style={styles.subtitle}>
            This helps us send the right help to the right place, fast.
          </Text>

          {/* Full Name */}
          <FieldLabel text="Full Name" />
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#9CA3AF"
            value={form.fullName}
            onChangeText={(t) => update("fullName", t)}
          />

          {/* Phone Number */}
          <FieldLabel text="Phone Number" />
          <TextInput
            style={styles.input}
            placeholder="000-000-0000"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => update("phone", t)}
          />

          {/* Emergency Contact Phone */}
          <FieldLabel text="Emergency Contact Phone" />
          <TextInput
            style={styles.input}
            placeholder="000-000-0000"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={form.emergencyPhone}
            onChangeText={(t) => update("emergencyPhone", t)}
          />

          {/* Home Address / Location */}
          <FieldLabel text="Home Address / Location" />
          <View style={styles.inputWithIcon}>
            <Ionicons
              name="location-outline"
              size={18}
              color="#6B7280"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.inputIconField}
              placeholder="Street, City, Zip Code"
              placeholderTextColor="#9CA3AF"
              value={form.address}
              onChangeText={(t) => update("address", t)}
            />
          </View>
          <TouchableOpacity
            style={styles.locationLink}
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#000080" />
            ) : (
              <Ionicons name="navigate-outline" size={14} color="#000080" />
            )}
            <Text style={styles.locationLinkText}>
              {locating ? "Locating..." : "Use current location"}
            </Text>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Registration</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Home")}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function FieldLabel({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

const NAVY = "#1034A6";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },

  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 44,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  backButton: {
    marginBottom: 18,
  },
  headerTitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 28,
    color: "#fff",
    marginBottom: 14,
  },
  headerSubtitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 13,
    color: "#9CA3AF",
    letterSpacing: 2,
  },

  cardWrapper: {
    flex: 1,
    backgroundColor: "#F7F7FB",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  card: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },

  title: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 30,
    color: "#111827",
    lineHeight: 36,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 21,
    marginBottom: 26,
  },

  label: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
    marginTop: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },

  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  inputIcon: {
    marginRight: 8,
  },
  inputIconField: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: "#111827",
  },
  locationLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  locationLinkText: {
    fontSize: 13,
    color: NAVY,
    fontWeight: "600",
  },

  button: {
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  skipButton: {
    alignItems: "center",
    marginTop: 16,
  },
  skipText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: "#6B7280",
  },
  footerLink: {
    fontSize: 13,
    color: NAVY,
    fontWeight: "700",
  },
});