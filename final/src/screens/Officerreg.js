import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinUserRoom } from "../services/socket";

// Point this at your running FastAPI server (use your machine's LAN IP for a
// physical device, 10.0.2.2 for Android emulator, localhost for iOS simulator)
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

const ACCENT = "#21332C";

const ACCOUNT_TYPES = [
  { key: "citizen", label: "Citizen" },
  { key: "officer", label: "Officer" },
  { key: "ngo", label: "NGO" },
];

const OFFICER_ORGS = [
  "NDRF",
  "SDRF",
  "Police",
  "Fire Department",
  "Medical",
  "Civil Defence",
];

const NGO_RESOURCES = [
  "Rescue Team",
  "Food Supply",
  "Medical Support",
  "Shelter",
  "Boats",
  "Ambulance",
  "Volunteers",
];

export default function RegisterScreen({ navigation }) {
  const [accountType, setAccountType] = useState("citizen");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ---- Citizen ----
  const [citizen, setCitizen] = useState({
    fullName: "",
    phone: "",
    emergencyPhone: "",
    address: "",
    password: "",
  });
  const updateCitizen = (key, value) =>
    setCitizen((prev) => ({ ...prev, [key]: value }));

  // ---- Officer ----
  const [officer, setOfficer] = useState({
    fullName: "",
    officialEmail: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    employeeId: "",
    organization: "",
    rank: "",
    teamId: "",
    baseStation: "",
    postingDistrict: "",
    govId: null,
    deptId: null,
    selfie: null,
  });
  const [officerPermissions, setOfficerPermissions] = useState({
    backgroundLocation: false,
    notifications: false,
    camera: false,
    microphone: false,
  });
  const updateOfficer = (key, value) =>
    setOfficer((prev) => ({ ...prev, [key]: value }));
  const togglePermission = (key) =>
    setOfficerPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  // ---- NGO ----
  const [ngo, setNgo] = useState({
    ngoName: "",
    registrationNumber: "",
    ngoEmail: "",
    ngoPhone: "",
    password: "",
    confirmPassword: "",
    organizationType: "",
    numberOfVolunteers: "",
    hqAddress: "",
    district: "",
    state: "",
    resources: [],
    regCertificate: null,
    logo: null,
  });
  const updateNgo = (key, value) => setNgo((prev) => ({ ...prev, [key]: value }));
  const toggleResource = (resource) =>
    setNgo((prev) => ({
      ...prev,
      resources: prev.resources.includes(resource)
        ? prev.resources.filter((r) => r !== resource)
        : [...prev.resources, resource],
    }));

  const pickDocument = async (onPicked) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (file) onPicked(file);
    } catch (err) {
      console.error("Error picking document:", err);
      Alert.alert("Couldn't select file", "Please try again.");
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location access so we can fill in your address."
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
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
        updateCitizen("address", formattedAddress || `${latitude}, ${longitude}`);
      } else {
        updateCitizen("address", `${latitude}, ${longitude}`);
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
    if (accountType === "citizen") {
      if (!citizen.fullName || !citizen.phone || !citizen.emergencyPhone || !citizen.password) {
        Alert.alert(
          "Missing info",
          "Please fill in your name, phone, password, and emergency contact number."
        );
        return;
      }
    } else if (accountType === "officer") {
      if (
        !officer.fullName ||
        !officer.officialEmail ||
        !officer.mobile ||
        !officer.password ||
        !officer.confirmPassword ||
        !officer.employeeId ||
        !officer.organization
      ) {
        Alert.alert("Missing info", "Please fill in all required professional details.");
        return;
      }
      if (officer.password !== officer.confirmPassword) {
        Alert.alert("Passwords don't match", "Please make sure both passwords match.");
        return;
      }
    } else if (accountType === "ngo") {
      if (
        !ngo.ngoName ||
        !ngo.registrationNumber ||
        !ngo.ngoEmail ||
        !ngo.ngoPhone ||
        !ngo.password ||
        !ngo.confirmPassword
      ) {
        Alert.alert("Missing info", "Please fill in all required organization details.");
        return;
      }
      if (ngo.password !== ngo.confirmPassword) {
        Alert.alert("Passwords don't match", "Please make sure both passwords match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint =
        accountType === "citizen"
          ? "/api/register"
          : accountType === "officer"
          ? "/api/register/officer"
          : "/api/register/ngo";

      const payload =
        accountType === "citizen"
          ? citizen
          : accountType === "officer"
          ? { ...officer, permissions: officerPermissions }
          : ngo;

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || "Failed to save profile");
      }

      const savedProfile = await response.json();
      await AsyncStorage.setItem("userId", savedProfile.id);
      console.log("Saved profile, id:", savedProfile.id);

      if (accountType === "citizen") {
        await joinUserRoom();
        navigation.navigate("Home", { userId: savedProfile.id });
      } else if (accountType === "officer") {
        // Officers are held for admin verification before going active
        navigation.navigate("PendingApproval", { userId: savedProfile.id });
      } else {
        navigation.navigate("PendingApproval", { userId: savedProfile.id });
      }
    } catch (err) {
      console.error("Error saving profile:", err);
      Alert.alert("Something went wrong", err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>YOUR SAFETY IS OUR PRIORITY</Text>

        {/* Account type toggle */}
        <View style={styles.toggleTrack}>
          {ACCOUNT_TYPES.map((t) => {
            const active = accountType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.toggleChip, active && styles.toggleChipActive]}
                onPress={() => setAccountType(t.key)}
              >
                <Text style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* White scrollable card */}
      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {accountType === "citizen" && (
            <CitizenForm
              form={citizen}
              update={updateCitizen}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              locating={locating}
              onUseLocation={handleUseCurrentLocation}
            />
          )}

          {accountType === "officer" && (
            <OfficerForm
              form={officer}
              update={updateOfficer}
              permissions={officerPermissions}
              togglePermission={togglePermission}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              onPickDoc={pickDocument}
            />
          )}

          {accountType === "ngo" && (
            <NgoForm
              form={ngo}
              update={updateNgo}
              toggleResource={toggleResource}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              onPickDoc={pickDocument}
            />
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {accountType === "citizen" ? "Complete Registration" : "Submit for Verification"}
              </Text>
            )}
          </TouchableOpacity>

          {accountType === "citizen" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Home")}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}

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

/* ------------------------------------------------------------------ */
/* Citizen form                                                        */
/* ------------------------------------------------------------------ */
function CitizenForm({ form, update, showPassword, setShowPassword, locating, onUseLocation }) {
  return (
    <>
      <Text style={styles.title}>Create Your Safety{"\n"}Profile</Text>
      <Text style={styles.subtitle}>
        This helps us send the right help to the right place, fast.
      </Text>

      <FieldLabel text="Full Name" />
      <TextInput
        style={styles.input}
        placeholder="John Doe"
        placeholderTextColor="#9CA3AF"
        value={form.fullName}
        onChangeText={(t) => update("fullName", t)}
      />

      <FieldLabel text="Phone Number" />
      <TextInput
        style={styles.input}
        placeholder="000-000-0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={(t) => update("phone", t)}
      />

      <FieldLabel text="Password" />
      <PasswordInput
        value={form.password}
        onChangeText={(t) => update("password", t)}
        visible={showPassword}
        onToggle={() => setShowPassword(!showPassword)}
      />

      <FieldLabel text="Emergency Contact Phone" />
      <TextInput
        style={styles.input}
        placeholder="000-000-0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={form.emergencyPhone}
        onChangeText={(t) => update("emergencyPhone", t)}
      />

      <FieldLabel text="Home Address / Location" />
      <View style={styles.inputWithIcon}>
        <Ionicons name="location-outline" size={18} color="#6B7280" style={styles.inputIcon} />
        <TextInput
          style={styles.inputIconField}
          placeholder="Street, City, Zip Code"
          placeholderTextColor="#9CA3AF"
          value={form.address}
          onChangeText={(t) => update("address", t)}
        />
      </View>
      <TouchableOpacity style={styles.locationLink} onPress={onUseLocation} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Ionicons name="navigate-outline" size={14} color={ACCENT} />
        )}
        <Text style={styles.locationLinkText}>{locating ? "Locating..." : "Use current location"}</Text>
      </TouchableOpacity>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Officer form                                                        */
/* ------------------------------------------------------------------ */
function OfficerForm({
  form,
  update,
  permissions,
  togglePermission,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onPickDoc,
}) {
  return (
    <>
      <Text style={styles.title}>Officer{"\n"}Registration</Text>
      <Text style={styles.subtitle}>
        For NDRF, SDRF, Police, Fire, and Medical responders. Your account will be
        activated after admin verification.
      </Text>

      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark-outline" size={16} color={ACCENT} />
        <Text style={styles.infoBannerText}>
          Officer accounts stay inactive until an admin verifies your credentials.
        </Text>
      </View>

      <SectionHeading text="Personal Information" />

      <FieldLabel text="Full Name" />
      <TextInput
        style={styles.input}
        placeholder="Jane Smith"
        placeholderTextColor="#9CA3AF"
        value={form.fullName}
        onChangeText={(t) => update("fullName", t)}
      />

      <FieldLabel text="Official Email" />
      <TextInput
        style={styles.input}
        placeholder="jane.smith@ndrf.gov.in"
        placeholderTextColor="#9CA3AF"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.officialEmail}
        onChangeText={(t) => update("officialEmail", t)}
      />

      <FieldLabel text="Mobile Number" />
      <TextInput
        style={styles.input}
        placeholder="000-000-0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={form.mobile}
        onChangeText={(t) => update("mobile", t)}
      />

      <FieldLabel text="Password" />
      <PasswordInput
        value={form.password}
        onChangeText={(t) => update("password", t)}
        visible={showPassword}
        onToggle={() => setShowPassword(!showPassword)}
      />

      <FieldLabel text="Confirm Password" />
      <PasswordInput
        value={form.confirmPassword}
        onChangeText={(t) => update("confirmPassword", t)}
        visible={showConfirmPassword}
        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
      />

      <SectionHeading text="Professional Details" />

      <FieldLabel text="Employee ID / Badge Number" />
      <TextInput
        style={styles.input}
        placeholder="e.g. NDRF-2291"
        placeholderTextColor="#9CA3AF"
        value={form.employeeId}
        onChangeText={(t) => update("employeeId", t)}
      />

      <FieldLabel text="Organization" />
      <ChipSelect
        options={OFFICER_ORGS}
        selected={form.organization}
        onSelect={(val) => update("organization", val)}
      />

      <FieldLabel text="Rank / Designation" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Inspector"
        placeholderTextColor="#9CA3AF"
        value={form.rank}
        onChangeText={(t) => update("rank", t)}
      />

      <FieldLabel text="Team ID" />
      <TextInput
        style={styles.input}
        placeholder="e.g. TEAM-14"
        placeholderTextColor="#9CA3AF"
        value={form.teamId}
        onChangeText={(t) => update("teamId", t)}
      />

      <FieldLabel text="Base Station" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Central Fire Station"
        placeholderTextColor="#9CA3AF"
        value={form.baseStation}
        onChangeText={(t) => update("baseStation", t)}
      />

      <FieldLabel text="Current Posting District" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Thane"
        placeholderTextColor="#9CA3AF"
        value={form.postingDistrict}
        onChangeText={(t) => update("postingDistrict", t)}
      />

      <SectionHeading text="Verification" />

      <UploadRow
        label="Upload Government ID"
        file={form.govId}
        onPress={() => onPickDoc((file) => update("govId", file))}
      />
      <UploadRow
        label="Upload Department ID Card"
        file={form.deptId}
        onPress={() => onPickDoc((file) => update("deptId", file))}
      />
      <UploadRow
        label="Selfie Verification (optional)"
        file={form.selfie}
        onPress={() => onPickDoc((file) => update("selfie", file))}
      />

      <SectionHeading text="Permissions" />

      <PermissionToggle
        label="Background Location"
        value={permissions.backgroundLocation}
        onToggle={() => togglePermission("backgroundLocation")}
      />
      <PermissionToggle
        label="Notifications"
        value={permissions.notifications}
        onToggle={() => togglePermission("notifications")}
      />
      <PermissionToggle
        label="Camera"
        value={permissions.camera}
        onToggle={() => togglePermission("camera")}
      />
      <PermissionToggle
        label="Microphone"
        value={permissions.microphone}
        onToggle={() => togglePermission("microphone")}
      />

      <SectionHeading text="Status" />
      <View style={styles.statusBadge}>
        <View style={styles.statusDot} />
        <Text style={styles.statusBadgeText}>
          Available (activates automatically once approved)
        </Text>
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* NGO form                                                             */
/* ------------------------------------------------------------------ */
function NgoForm({
  form,
  update,
  toggleResource,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onPickDoc,
}) {
  return (
    <>
      <Text style={styles.title}>NGO{"\n"}Registration</Text>
      <Text style={styles.subtitle}>For volunteer organizations supporting relief efforts.</Text>

      <SectionHeading text="Organization Details" />

      <FieldLabel text="NGO Name" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Relief Now Foundation"
        placeholderTextColor="#9CA3AF"
        value={form.ngoName}
        onChangeText={(t) => update("ngoName", t)}
      />

      <FieldLabel text="Registration Number" />
      <TextInput
        style={styles.input}
        placeholder="e.g. NGO-2019-00231"
        placeholderTextColor="#9CA3AF"
        value={form.registrationNumber}
        onChangeText={(t) => update("registrationNumber", t)}
      />

      <FieldLabel text="NGO Email" />
      <TextInput
        style={styles.input}
        placeholder="contact@ngo.org"
        placeholderTextColor="#9CA3AF"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.ngoEmail}
        onChangeText={(t) => update("ngoEmail", t)}
      />

      <FieldLabel text="NGO Phone" />
      <TextInput
        style={styles.input}
        placeholder="000-000-0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={form.ngoPhone}
        onChangeText={(t) => update("ngoPhone", t)}
      />

      <FieldLabel text="Password" />
      <PasswordInput
        value={form.password}
        onChangeText={(t) => update("password", t)}
        visible={showPassword}
        onToggle={() => setShowPassword(!showPassword)}
      />

      <FieldLabel text="Confirm Password" />
      <PasswordInput
        value={form.confirmPassword}
        onChangeText={(t) => update("confirmPassword", t)}
        visible={showConfirmPassword}
        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
      />

      <SectionHeading text="Organization Information" />

      <FieldLabel text="Organization Type" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Disaster Relief, Humanitarian Aid"
        placeholderTextColor="#9CA3AF"
        value={form.organizationType}
        onChangeText={(t) => update("organizationType", t)}
      />

      <FieldLabel text="Number of Volunteers" />
      <TextInput
        style={styles.input}
        placeholder="e.g. 50"
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        value={form.numberOfVolunteers}
        onChangeText={(t) => update("numberOfVolunteers", t)}
      />

      <FieldLabel text="Headquarters Address" />
      <TextInput
        style={styles.input}
        placeholder="Street, City, Zip Code"
        placeholderTextColor="#9CA3AF"
        value={form.hqAddress}
        onChangeText={(t) => update("hqAddress", t)}
      />

      <FieldLabel text="District" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Thane"
        placeholderTextColor="#9CA3AF"
        value={form.district}
        onChangeText={(t) => update("district", t)}
      />

      <FieldLabel text="State" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Maharashtra"
        placeholderTextColor="#9CA3AF"
        value={form.state}
        onChangeText={(t) => update("state", t)}
      />

      <SectionHeading text="Resources Available" />
      <ChipSelect
        options={NGO_RESOURCES}
        selected={form.resources}
        onSelect={toggleResource}
        multi
      />

      <SectionHeading text="Verification" />
      <UploadRow
        label="NGO Registration Certificate"
        file={form.regCertificate}
        onPress={() => onPickDoc((file) => update("regCertificate", file))}
      />
      <UploadRow
        label="Organization Logo (optional)"
        file={form.logo}
        onPress={() => onPickDoc((file) => update("logo", file))}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
function FieldLabel({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SectionHeading({ text }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingBar} />
      <Text style={styles.sectionHeadingText}>{text}</Text>
    </View>
  );
}

function PasswordInput({ value, onChangeText, visible, onToggle }) {
  return (
    <View style={styles.inputWithIcon}>
      <TextInput
        style={styles.inputIconField}
        placeholder="••••••••"
        placeholderTextColor="#9CA3AF"
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity onPress={onToggle}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );
}

function ChipSelect({ options, selected, onSelect, multi = false }) {
  const isSelected = (opt) => (multi ? selected.includes(opt) : selected === opt);
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = isSelected(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.optionChip, active && styles.optionChipActive]}
            onPress={() => onSelect(opt)}
          >
            {active && (
              <Ionicons
                name="checkmark"
                size={13}
                color="#fff"
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function UploadRow({ label, file, onPress }) {
  return (
    <TouchableOpacity style={styles.uploadRow} onPress={onPress}>
      <View style={styles.uploadIconWrap}>
        <Ionicons name="cloud-upload-outline" size={18} color={ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.uploadLabel}>{label}</Text>
        <Text style={styles.uploadFileName} numberOfLines={1}>
          {file ? file.name : "No file selected"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function PermissionToggle({ label, value, onToggle }) {
  return (
    <View style={styles.permissionRow}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#E5E7EB", true: ACCENT }}
        thumbColor="#fff"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ACCENT,
  },

  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 44,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    marginBottom: 18,
  },
  headerTitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 28,
    color: "#fff",
    marginBottom: 10,
  },
  headerSubtitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 2,
    marginBottom: 22,
  },

  toggleTrack: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: 4,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleChipActive: {
    backgroundColor: "#fff",
  },
  toggleChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
  },
  toggleChipTextActive: {
    color: ACCENT,
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
    fontSize: 28,
    color: "#111827",
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 21,
    marginBottom: 22,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF0EC",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: ACCENT,
    lineHeight: 17,
    fontWeight: "600",
  },

  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 6,
  },
  sectionHeadingBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginRight: 8,
  },
  sectionHeadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 1,
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
    color: ACCENT,
    fontWeight: "600",
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  optionChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  optionChipText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#fff",
  },

  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  uploadIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EAF0EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  uploadLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#111827",
  },
  uploadFileName: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  permissionLabel: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF0EC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    marginRight: 10,
  },
  statusBadgeText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "600",
    flex: 1,
  },

  button: {
    backgroundColor: ACCENT,
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
    color: ACCENT,
    fontWeight: "700",
  },
});