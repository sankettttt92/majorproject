import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import SafetyBackground from "../components/SafetyBackground";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Radar background — centered, stays fixed */}
      <View style={styles.radarLayer} pointerEvents="none">
        <SafetyBackground />
      </View>

      {/* Three-word stacked tagline: English, Marathi, Hindi */}
      <View style={styles.quoteLayer} pointerEvents="none">
        <Text style={styles.wordEnglish}>SAFETY</Text>
        <Text style={styles.wordMarathi}>सुरक्षा</Text>
        <Text style={styles.wordHindi}>ज़िम्मेदारी</Text>
        <Text style={styles.tagline}>Your Safety, Our Responsibility</Text>
      </View>

      {/* Card is fixed at 40% of screen height, pinned to bottom */}
      <View style={styles.card}>
        <Text style={styles.brand}>RAKSHAK</Text>
        <Text style={styles.title}>Let's Get You{"\n"}Set Up for Success</Text>
        <Text style={styles.subtitle}>
          Send an SOS and get help fast — set up your profile in one simple, powerful app.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000080",
  },

  radarLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 1.1,
    justifyContent: "center",
    alignItems: "center",
  },

  quoteLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    paddingHorizontal: 36,
    justifyContent: "flex-start",
    paddingTop: 70,
    alignItems: "center",
  },
  wordEnglish: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: 4,
    marginBottom: 6,
  },
  wordMarathi: {
    fontFamily: "Baloo2_700Bold",
    fontSize: 26,
    color: "#fff",
    marginBottom: 6,
  },
  wordHindi: {
    fontFamily: "Baloo2_700Bold",
    fontSize: 26,
    color: "#fff",
    marginBottom: 16,
  },
  tagline: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 11,
    color: "#C7CEDD",
    letterSpacing: 1,
    textAlign: "center",
  },

  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#000080",
    marginBottom: 70,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#000080",
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 35,
  },
  button: {
    backgroundColor: "#000080",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    marginBottom:50,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});