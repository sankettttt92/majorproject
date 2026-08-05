import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * RoleSelectScreen
 * "Select User Type" step — Citizen vs Government Authority / NGO.
 * Layout follows the reference (rounded stacked cards, illustration +
 * title + "Get Started" row), restyled into the RAKSHAK navy/white
 * security theme, one card white and one navy per your spec.
 *
 * ── Swapping in your own Flaticon icons ──
 * Each card currently falls back to an Ionicons glyph so this renders
 * out of the box. To use your downloaded icons instead, drop the PNG/SVG
 * into e.g. /assets/icons/citizen.png and /assets/icons/authority.png,
 * then set `illustration: require('../../assets/icons/citizen.png')`
 * in the ROLES array below — the <Image> branch is already wired up,
 * it just needs `illustration` to be non-null.
 */

const NAVY = '#1034A6';
const NAVY_DARK = '#21332C';
const LIGHT_TINT = '#EAF3FF';
const BORDER = '#E5E7EB';
const TEXT_SECONDARY = '#21332C';

const ROLES = [
  {
    key: 'CITIZEN',
    title: 'Citizen',
    description: 'Send SOS alerts, share your live location, and get instant help in an emergency.',
    fallbackIcon: 'person-outline',
    illustration: require('../assets/people.png'), // require('../../assets/icons/citizen.png')
    variant: 'light',
  },
  {
    key: 'AUTHORITY',
    title: 'Government\nAuthority / NGO',
    description: 'Monitor live incidents, verify SOS alerts, and coordinate rescue response.',
    fallbackIcon: 'shield-checkmark-outline',
    illustration: require('../assets/public.png'), // require('../../assets/icons/authority.png')
    variant: 'dark',
  },
];

export default function RoleSelectScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (roleKey) => {
    setSelected(roleKey);
    // Route each role to its own registration/onboarding flow.
    if (roleKey === 'CITIZEN') {
      navigation.navigate('CitizenRegister');
    } else {
      navigation.navigate('Officerreg');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="shield-half-outline" size={16} color={NAVY} />
          <Text style={styles.brandText}>RAKSHAK</Text>
        </View>
        <Text style={styles.title}>Select Your{'\n'}Role</Text>
        <Text style={styles.subtitle}>Choose how you'll use RAKSHAK so we can set up the right experience for you.</Text>
      </View>

      <View style={styles.cardsWrap}>
        {ROLES.map((role) => {
          const isDark = role.variant === 'dark';
          const isSelected = selected === role.key;

          return (
            <TouchableOpacity
              key={role.key}
              activeOpacity={0.9}
              onPress={() => handleSelect(role.key)}
              style={[
                styles.card,
                isDark ? styles.cardDark : styles.cardLight,
                isSelected && styles.cardSelected,
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : LIGHT_TINT },
                ]}
              >
                {role.illustration ? (
                  <Image source={role.illustration} style={styles.iconImage} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name={role.fallbackIcon}
                    size={28}
                    color={isDark ? '#FFFFFF' : NAVY}
                  />
                )}
              </View>

              <View style={styles.cardTextWrap}>
                <Text style={[styles.cardTitle, isDark && styles.textLight]}>
                  {role.title}
                </Text>
                <Text style={[styles.cardDescription, isDark && styles.textLightMuted]}>
                  {role.description}
                </Text>

                <View
                  style={[
                    styles.getStartedPill,
                    isDark ? styles.pillDark : styles.pillLight,
                  ]}
                >
                  <Text style={[styles.getStartedText, isDark && styles.textLight]}>
                    Get Started
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={isDark ? '#FFFFFF' : NAVY}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
        <Text style={styles.footerText}>Your role determines what data you can see and share</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: { paddingHorizontal: 24, paddingTop: 12, marginBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  brandText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: NAVY,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    lineHeight: 36,
    color: '#111827',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_SECONDARY,
    maxWidth: 300,
  },

  cardsWrap: { flex: 1, paddingHorizontal: 24, gap: 25 },

  card: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 16,
    alignItems: 'flex-start',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    shadowColor: NAVY_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: NAVY,
    borderColor: NAVY,
    shadowColor: NAVY_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  cardSelected: {
    borderColor: NAVY,
    borderWidth: 2,
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: { width: 32, height: 32 },

  cardTextWrap: { flex: 1 },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: '#111827',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginBottom: 14,
  },
  textLight: { color: '#FFFFFF' },
  textLightMuted: { color: 'rgba(255,255,255,0.78)' },

  getStartedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  pillLight: { backgroundColor: LIGHT_TINT },
  pillDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  getStartedText: {
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 0.2,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});