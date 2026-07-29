

// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   Dimensions,
//   Platform,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
// import * as Location from "expo-location";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { supabase } from "../lib/supabase"; // adjust path to match your project structure

// const { width: SCREEN_WIDTH } = Dimensions.get("window");

// export default function RegisterScreen({ navigation }) {
//   const [form, setForm] = useState({
//     fullName: "",
//     phone: "",
//     emergencyPhone: "",
//     address: "",
//     password: "",
//   });
//   const [showPassword, setShowPassword] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [locating, setLocating] = useState(false);

//   const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

//   const handleUseCurrentLocation = async () => {
//     setLocating(true);
//     try {
//       // 1. Ask for permission
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== "granted") {
//         Alert.alert(
//           "Permission needed",
//           "Please allow location access so we can fill in your address."
//         );
//         return;
//       }

//       // 2. Get current GPS coordinates
//       const position = await Location.getCurrentPositionAsync({
//         accuracy: Location.Accuracy.Balanced,
//       });
//       const { latitude, longitude } = position.coords;

//       // 3. Reverse-geocode coordinates into a human-readable address
//       const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

//       if (place) {
//         const formattedAddress = [
//           place.name,
//           place.street,
//           place.city,
//           place.region,
//           place.postalCode,
//         ]
//           .filter(Boolean)
//           .join(", ");

//         update("address", formattedAddress || `${latitude}, ${longitude}`);
//       } else {
//         update("address", `${latitude}, ${longitude}`);
//       }
//     } catch (err) {
//       console.error("Error getting current location:", err);
//       Alert.alert(
//         "Couldn't get location",
//         "Please check that location services are enabled and try again."
//       );
//     } finally {
//       setLocating(false);
//     }
//   };

//   const handleSubmit = async () => {
//     if (!form.fullName || !form.phone || !form.emergencyPhone || !form.password) {
//       Alert.alert(
//         "Missing info",
//         "Please fill in your name, phone, password, and emergency contact number."
//       );
//       return;
//     }

//     setSubmitting(true);
//     try {
//       // Check if phone is already registered
//       const { data: existing, error: checkError } = await supabase
//         .from("register")
//         .select("id")
//         .eq("phone", form.phone)
//         .maybeSingle();

//       if (checkError) throw checkError;

//       if (existing) {
//         Alert.alert("Account exists", "This phone number is already registered. Try logging in instead.");
//         setSubmitting(false);
//         return;
//       }

//       const { data, error } = await supabase
//         .from("register")
//         .insert({
//           full_name: form.fullName,
//           phone: form.phone,
//           emergency_phone: form.emergencyPhone,
//           address: form.address,
//           password: form.password,
//         })
//         .select()
//         .single();

//       if (error) throw error;

//       // data.id is the unique Supabase-generated UUID for this user
//       await AsyncStorage.setItem("userId", data.id);
//       console.log("Saved profile, id:", data.id);

//       navigation.navigate("Home", { userId: data.id });
//     } catch (err) {
//       console.error("Error saving safety profile:", err);
//       Alert.alert("Something went wrong", err.message || "Couldn't save your profile. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       {/* Navy header */}
//       <View style={styles.header}>
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() => navigation.goBack()}
//           hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
//         >
//           <Ionicons name="arrow-back" size={26} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Safety Profile</Text>
//         <Text style={styles.headerSubtitle}>YOUR SAFETY IS OUR PRIORITY</Text>
//       </View>

//       {/* White scrollable card */}
//       <View style={styles.cardWrapper}>
//         <ScrollView
//           style={styles.card}
//           contentContainerStyle={styles.cardContent}
//           showsVerticalScrollIndicator={false}
//           keyboardShouldPersistTaps="handled"
//         >
//           <Text style={styles.title}>Create Your Safety{"\n"}Profile</Text>
//           <Text style={styles.subtitle}>
//             This helps us send the right help to the right place, fast.
//           </Text>

//           {/* Full Name */}
//           <FieldLabel text="Full Name" />
//           <TextInput
//             style={styles.input}
//             placeholder="John Doe"
//             placeholderTextColor="#9CA3AF"
//             value={form.fullName}
//             onChangeText={(t) => update("fullName", t)}
//           />

//           {/* Phone Number */}
//           <FieldLabel text="Phone Number" />
//           <TextInput
//             style={styles.input}
//             placeholder="000-000-0000"
//             placeholderTextColor="#9CA3AF"
//             keyboardType="phone-pad"
//             value={form.phone}
//             onChangeText={(t) => update("phone", t)}
//           />

//           {/* Password */}
//           <FieldLabel text="Password" />
//           <View style={styles.inputWithIcon}>
//             <TextInput
//               style={styles.inputIconField}
//               placeholder="Create a password"
//               placeholderTextColor="#9CA3AF"
//               secureTextEntry={!showPassword}
//               value={form.password}
//               onChangeText={(t) => update("password", t)}
//             />
//             <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
//               <Ionicons
//                 name={showPassword ? "eye-off-outline" : "eye-outline"}
//                 size={20}
//                 color="#6B7280"
//               />
//             </TouchableOpacity>
//           </View>

//           {/* Emergency Contact Phone */}
//           <FieldLabel text="Emergency Contact Phone" />
//           <TextInput
//             style={styles.input}
//             placeholder="000-000-0000"
//             placeholderTextColor="#9CA3AF"
//             keyboardType="phone-pad"
//             value={form.emergencyPhone}
//             onChangeText={(t) => update("emergencyPhone", t)}
//           />

//           {/* Home Address / Location */}
//           <FieldLabel text="Home Address / Location" />
//           <View style={styles.inputWithIcon}>
//             <Ionicons
//               name="location-outline"
//               size={18}
//               color="#6B7280"
//               style={styles.inputIcon}
//             />
//             <TextInput
//               style={styles.inputIconField}
//               placeholder="Street, City, Zip Code"
//               placeholderTextColor="#9CA3AF"
//               value={form.address}
//               onChangeText={(t) => update("address", t)}
//             />
//           </View>
//           <TouchableOpacity
//             style={styles.locationLink}
//             onPress={handleUseCurrentLocation}
//             disabled={locating}
//           >
//             {locating ? (
//               <ActivityIndicator size="small" color="#000080" />
//             ) : (
//               <Ionicons name="navigate-outline" size={14} color="#000080" />
//             )}
//             <Text style={styles.locationLinkText}>
//               {locating ? "Locating..." : "Use current location"}
//             </Text>
//           </TouchableOpacity>

//           {/* CTA */}
//           <TouchableOpacity
//             style={[styles.button, submitting && styles.buttonDisabled]}
//             onPress={handleSubmit}
//             disabled={submitting}
//           >
//             {submitting ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.buttonText}>Complete Registration</Text>
//             )}
//           </TouchableOpacity>

//           <TouchableOpacity
//             onPress={() => navigation.navigate("Home")}
//             style={styles.skipButton}
//           >
//             <Text style={styles.skipText}>Skip for now</Text>
//           </TouchableOpacity>

//           <View style={styles.footerRow}>
//             <Text style={styles.footerText}>Already have an account? </Text>
//             <TouchableOpacity onPress={() => navigation.navigate("Login")}>
//               <Text style={styles.footerLink}>Log In</Text>
//             </TouchableOpacity>
//           </View>
//         </ScrollView>
//       </View>
//     </View>
//   );
// }

// function FieldLabel({ text }) {
//   return <Text style={styles.label}>{text}</Text>;
// }

// const NAVY = "#1034A6";

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: NAVY,
//   },

//   header: {
//     paddingTop: Platform.OS === "ios" ? 60 : 44,
//     paddingHorizontal: 24,
//     paddingBottom: 36,
//   },
//   backButton: {
//     marginBottom: 18,
//   },
//   headerTitle: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 28,
//     color: "#fff",
//     marginBottom: 14,
//   },
//   headerSubtitle: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 13,
//     color: "#9CA3AF",
//     letterSpacing: 2,
//   },

//   cardWrapper: {
//     flex: 1,
//     backgroundColor: "#F7F7FB",
//     borderTopLeftRadius: 32,
//     borderTopRightRadius: 32,
//     overflow: "hidden",
//   },
//   card: {
//     flex: 1,
//   },
//   cardContent: {
//     paddingHorizontal: 24,
//     paddingTop: 28,
//     paddingBottom: 48,
//   },

//   title: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 30,
//     color: "#111827",
//     lineHeight: 36,
//     marginBottom: 14,
//   },
//   subtitle: {
//     fontSize: 15,
//     color: "#6B7280",
//     lineHeight: 21,
//     marginBottom: 26,
//   },

//   label: {
//     fontSize: 14,
//     color: "#111827",
//     marginBottom: 8,
//     marginTop: 18,
//   },

//   input: {
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     borderRadius: 14,
//     paddingHorizontal: 18,
//     paddingVertical: 16,
//     fontSize: 15,
//     color: "#111827",
//     backgroundColor: "#fff",
//   },

//   inputWithIcon: {
//     flexDirection: "row",
//     alignItems: "center",
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     borderRadius: 14,
//     paddingHorizontal: 16,
//     backgroundColor: "#fff",
//   },
//   inputIcon: {
//     marginRight: 8,
//   },
//   inputIconField: {
//     flex: 1,
//     paddingVertical: 16,
//     fontSize: 15,
//     color: "#111827",
//   },
//   locationLink: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     marginTop: 10,
//     alignSelf: "flex-start",
//   },
//   locationLinkText: {
//     fontSize: 13,
//     color: NAVY,
//     fontWeight: "600",
//   },

//   button: {
//     backgroundColor: NAVY,
//     borderRadius: 999,
//     paddingVertical: 16,
//     alignItems: "center",
//     marginTop: 32,
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: "700",
//   },
//   skipButton: {
//     alignItems: "center",
//     marginTop: 16,
//   },
//   skipText: {
//     fontSize: 13,
//     color: "#9CA3AF",
//     fontWeight: "600",
//   },

//   footerRow: {
//     flexDirection: "row",
//     justifyContent: "center",
//     marginTop: 20,
//   },
//   footerText: {
//     fontSize: 13,
//     color: "#6B7280",
//   },
//   footerLink: {
//     fontSize: 13,
//     color: NAVY,
//     fontWeight: "700",
//   },
// });

// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   Dimensions,
//   Platform,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
// import * as Location from "expo-location";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { joinUserRoom } from "../services/socket";
// const { width: SCREEN_WIDTH } = Dimensions.get("window");

// // Point this at your running FastAPI server (use your machine's LAN IP for a
// // physical device, 10.0.2.2 for Android emulator, localhost for iOS simulator)
// const API_BASE = process.env.EXPO_PUBLIC_API_URL;

// export default function RegisterScreen({ navigation }) {
//   const [form, setForm] = useState({
//     fullName: "",
//     phone: "",
//     emergencyPhone: "",
//     address: "",
//     password: "",
//   });
//   const [showPassword, setShowPassword] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [locating, setLocating] = useState(false);

//   const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

//   const handleUseCurrentLocation = async () => {
//     setLocating(true);
//     try {
//       // 1. Ask for permission
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== "granted") {
//         Alert.alert(
//           "Permission needed",
//           "Please allow location access so we can fill in your address."
//         );
//         return;
//       }

//       // 2. Get current GPS coordinates
//       const position = await Location.getCurrentPositionAsync({
//         accuracy: Location.Accuracy.Balanced,
//       });
//       const { latitude, longitude } = position.coords;

//       // 3. Reverse-geocode coordinates into a human-readable address
//       const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

//       if (place) {
//         const formattedAddress = [
//           place.name,
//           place.street,
//           place.city,
//           place.region,
//           place.postalCode,
//         ]
//           .filter(Boolean)
//           .join(", ");

//         update("address", formattedAddress || `${latitude}, ${longitude}`);
//       } else {
//         update("address", `${latitude}, ${longitude}`);
//       }
//     } catch (err) {
//       console.error("Error getting current location:", err);
//       Alert.alert(
//         "Couldn't get location",
//         "Please check that location services are enabled and try again."
//       );
//     } finally {
//       setLocating(false);
//     }
//   };

//   const handleSubmit = async () => {
//     if (!form.fullName || !form.phone || !form.emergencyPhone || !form.password) {
//       Alert.alert(
//         "Missing info",
//         "Please fill in your name, phone, password, and emergency contact number."
//       );
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const response = await fetch(`${API_BASE}/api/register`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           fullName: form.fullName,
//           phone: form.phone,
//           emergencyPhone: form.emergencyPhone,
//           address: form.address,
//           password: form.password,
//         }),
//       });

//       if (!response.ok) {
//         const errBody = await response.json().catch(() => ({}));
//         throw new Error(errBody.detail || "Failed to save profile");
//       }

//       const savedProfile = await response.json();

//       // savedProfile.id is the UUID returned by FastAPI's /api/register route
//       await AsyncStorage.setItem("userId", savedProfile.id);
//       console.log("Saved profile, id:", savedProfile.id);

//       navigation.navigate("Home", { userId: savedProfile.id });
//     } catch (err) {
//       console.error("Error saving safety profile:", err);
//       Alert.alert("Something went wrong", err.message || "Couldn't save your profile. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       {/* Navy header */}
//       <View style={styles.header}>
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() => navigation.goBack()}
//           hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
//         >
//           <Ionicons name="arrow-back" size={26} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Safety Profile</Text>
//         <Text style={styles.headerSubtitle}>YOUR SAFETY IS OUR PRIORITY</Text>
//       </View>

//       {/* White scrollable card */}
//       <View style={styles.cardWrapper}>
//         <ScrollView
//           style={styles.card}
//           contentContainerStyle={styles.cardContent}
//           showsVerticalScrollIndicator={false}
//           keyboardShouldPersistTaps="handled"
//         >
//           <Text style={styles.title}>Create Your Safety{"\n"}Profile</Text>
//           <Text style={styles.subtitle}>
//             This helps us send the right help to the right place, fast.
//           </Text>

//           {/* Full Name */}
//           <FieldLabel text="Full Name" />
//           <TextInput
//             style={styles.input}
//             placeholder="John Doe"
//             placeholderTextColor="#9CA3AF"
//             value={form.fullName}
//             onChangeText={(t) => update("fullName", t)}
//           />

//           {/* Phone Number */}
//           <FieldLabel text="Phone Number" />
//           <TextInput
//             style={styles.input}
//             placeholder="000-000-0000"
//             placeholderTextColor="#9CA3AF"
//             keyboardType="phone-pad"
//             value={form.phone}
//             onChangeText={(t) => update("phone", t)}
//           />

//           {/* Password */}
//           <FieldLabel text="Password" />
//           <View style={styles.inputWithIcon}>
//             <TextInput
//               style={styles.inputIconField}
//               placeholder="Create a password"
//               placeholderTextColor="#9CA3AF"
//               secureTextEntry={!showPassword}
//               value={form.password}
//               onChangeText={(t) => update("password", t)}
//             />
//             <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
//               <Ionicons
//                 name={showPassword ? "eye-off-outline" : "eye-outline"}
//                 size={20}
//                 color="#6B7280"
//               />
//             </TouchableOpacity>
//           </View>

//           {/* Emergency Contact Phone */}
//           <FieldLabel text="Emergency Contact Phone" />
//           <TextInput
//             style={styles.input}
//             placeholder="000-000-0000"
//             placeholderTextColor="#9CA3AF"
//             keyboardType="phone-pad"
//             value={form.emergencyPhone}
//             onChangeText={(t) => update("emergencyPhone", t)}
//           />

//           {/* Home Address / Location */}
//           <FieldLabel text="Home Address / Location" />
//           <View style={styles.inputWithIcon}>
//             <Ionicons
//               name="location-outline"
//               size={18}
//               color="#6B7280"
//               style={styles.inputIcon}
//             />
//             <TextInput
//               style={styles.inputIconField}
//               placeholder="Street, City, Zip Code"
//               placeholderTextColor="#9CA3AF"
//               value={form.address}
//               onChangeText={(t) => update("address", t)}
//             />
//           </View>
//           <TouchableOpacity
//             style={styles.locationLink}
//             onPress={handleUseCurrentLocation}
//             disabled={locating}
//           >
//             {locating ? (
//               <ActivityIndicator size="small" color="#000080" />
//             ) : (
//               <Ionicons name="navigate-outline" size={14} color="#000080" />
//             )}
//             <Text style={styles.locationLinkText}>
//               {locating ? "Locating..." : "Use current location"}
//             </Text>
//           </TouchableOpacity>

//           {/* CTA */}
//           <TouchableOpacity
//             style={[styles.button, submitting && styles.buttonDisabled]}
//             onPress={handleSubmit}
//             disabled={submitting}
//           >
//             {submitting ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.buttonText}>Complete Registration</Text>
//             )}
//           </TouchableOpacity>

//           <TouchableOpacity
//             onPress={() => navigation.navigate("Home")}
//             style={styles.skipButton}
//           >
//             <Text style={styles.skipText}>Skip for now</Text>
//           </TouchableOpacity>

//           <View style={styles.footerRow}>
//             <Text style={styles.footerText}>Already have an account? </Text>
//             <TouchableOpacity onPress={() => navigation.navigate("Login")}>
//               <Text style={styles.footerLink}>Log In</Text>
//             </TouchableOpacity>
//           </View>
//         </ScrollView>
//       </View>
//     </View>
//   );
// }

// function FieldLabel({ text }) {
//   return <Text style={styles.label}>{text}</Text>;
// }

// const NAVY = "#1034A6";

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: NAVY,
//   },

//   header: {
//     paddingTop: Platform.OS === "ios" ? 60 : 44,
//     paddingHorizontal: 24,
//     paddingBottom: 36,
//   },
//   backButton: {
//     marginBottom: 18,
//   },
//   headerTitle: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 28,
//     color: "#fff",
//     marginBottom: 14,
//   },
//   headerSubtitle: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 13,
//     color: "#9CA3AF",
//     letterSpacing: 2,
//   },

//   cardWrapper: {
//     flex: 1,
//     backgroundColor: "#F7F7FB",
//     borderTopLeftRadius: 32,
//     borderTopRightRadius: 32,
//     overflow: "hidden",
//   },
//   card: {
//     flex: 1,
//   },
//   cardContent: {
//     paddingHorizontal: 24,
//     paddingTop: 28,
//     paddingBottom: 48,
//   },

//   title: {
//     fontFamily: "SpaceGrotesk_700Bold",
//     fontSize: 30,
//     color: "#111827",
//     lineHeight: 36,
//     marginBottom: 14,
//   },
//   subtitle: {
//     fontSize: 15,
//     color: "#6B7280",
//     lineHeight: 21,
//     marginBottom: 26,
//   },

//   label: {
//     fontSize: 14,
//     color: "#111827",
//     marginBottom: 8,
//     marginTop: 18,
//   },

//   input: {
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     borderRadius: 14,
//     paddingHorizontal: 18,
//     paddingVertical: 16,
//     fontSize: 15,
//     color: "#111827",
//     backgroundColor: "#fff",
//   },

//   inputWithIcon: {
//     flexDirection: "row",
//     alignItems: "center",
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     borderRadius: 14,
//     paddingHorizontal: 16,
//     backgroundColor: "#fff",
//   },
//   inputIcon: {
//     marginRight: 8,
//   },
//   inputIconField: {
//     flex: 1,
//     paddingVertical: 16,
//     fontSize: 15,
//     color: "#111827",
//   },
//   locationLink: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     marginTop: 10,
//     alignSelf: "flex-start",
//   },
//   locationLinkText: {
//     fontSize: 13,
//     color: NAVY,
//     fontWeight: "600",
//   },

//   button: {
//     backgroundColor: NAVY,
//     borderRadius: 999,
//     paddingVertical: 16,
//     alignItems: "center",
//     marginTop: 32,
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: "700",
//   },
//   skipButton: {
//     alignItems: "center",
//     marginTop: 16,
//   },
//   skipText: {
//     fontSize: 13,
//     color: "#9CA3AF",
//     fontWeight: "600",
//   },

//   footerRow: {
//     flexDirection: "row",
//     justifyContent: "center",
//     marginTop: 20,
//   },
//   footerText: {
//     fontSize: 13,
//     color: "#6B7280",
//   },
//   footerLink: {
//     fontSize: 13,
//     color: NAVY,
//     fontWeight: "700",
//   },
// });
// above is correct

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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinUserRoom } from "../services/socket";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Point this at your running FastAPI server (use your machine's LAN IP for a
// physical device, 10.0.2.2 for Android emulator, localhost for iOS simulator)
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    emergencyPhone: "",
    address: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
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
    if (!form.fullName || !form.phone || !form.emergencyPhone || !form.password) {
      Alert.alert(
        "Missing info",
        "Please fill in your name, phone, password, and emergency contact number."
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          emergencyPhone: form.emergencyPhone,
          address: form.address,
          password: form.password,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || "Failed to save profile");
      }

      const savedProfile = await response.json();

      // Save the registered user's UUID
      await AsyncStorage.setItem("userId", savedProfile.id);

      console.log("Saved profile, id:", savedProfile.id);

      // Join the user's private Socket.IO room immediately
      await joinUserRoom();

      navigation.navigate("Home", { userId: savedProfile.id });
    } catch (err) {
      console.error("Error saving safety profile:", err);
      Alert.alert("Something went wrong", err.message || "Couldn't save your profile. Please try again.");
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
          keyboardShouldPersistTaps="handled"
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

          {/* Password */}
          <FieldLabel text="Password" />
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.inputIconField}
              placeholder="Create a password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={form.password}
              onChangeText={(t) => update("password", t)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

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