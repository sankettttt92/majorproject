import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // TODO: hook up to your auth logic
    navigation.navigate("Home");
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

        <Text style={styles.brand}>RAKSHAK</Text>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>YOUR SAFETY IS OUR PRIORITY</Text>
      </View>

      {/* White card */}
      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Log In to{"\n"}Your Account</Text>
          <Text style={styles.subtitle}>
            Access your safety profile and emergency contacts anytime.
          </Text>

          {/* Phone Number */}
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.countryCode}>
              <Text style={styles.countryCodeText}>{countryCode}</Text>
              <Ionicons name="chevron-down" size={14} color="#374151" />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="000-000-0000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.inputIconField}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* SOS quick access (optional, on-brand) */}
          <TouchableOpacity
            style={styles.sosButton}
            onPress={() => navigation.navigate("Home")}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#000080" />
            <Text style={styles.sosButtonText}>Continue as Guest for SOS</Text>
          </TouchableOpacity>

          {/* Footer link to register */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const NAVY = "#000080";

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
  brand: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 13,
    color: "#9CA3AF",
    letterSpacing: 3,
    marginBottom: 10,
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
    paddingTop: 32,
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
    marginBottom: 30,
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

  row: {
    flexDirection: "row",
    gap: 10,
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    width: 78,
  },
  countryCodeText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
  },

  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  inputIconField: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: "#111827",
  },

  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: 12,
  },
  forgotText: {
    fontSize: 13,
    color: NAVY,
    fontWeight: "600",
  },

  button: {
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 30,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 999,
    paddingVertical: 15,
  },
  sosButtonText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
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