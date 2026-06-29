import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '@/screens/HomeScreen';
import IncidentDetailScreen from '@/screens/IncidentDetailScreen';
import LogMedicalScreen from '@/screens/LogMedicalScreen';


const Stack = createStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0F1E' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', letterSpacing: 0.5 },
        cardStyle: { backgroundColor: '#0A0F1E' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IncidentDetail"
        component={IncidentDetailScreen}
        options={{ title: 'Incident Details' }}
      />
      {/* Add ShelterLocator and EvacRoute Stack.Screen entries back here once
          those screen components exist under src/screens. */}
      <Stack.Screen
        name="LogMedical"
        component={LogMedicalScreen}
        options={{ title: 'Log Medical Incident' }}
      />
    </Stack.Navigator>
  );
}