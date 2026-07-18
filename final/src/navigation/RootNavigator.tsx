import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import WelcomeScreen from '@/screens/WelcomeScreen';
import HomeScreen from '@/screens/HomeScreen';
import IncidentDetailScreen from '@/screens/IncidentDetailScreen';
import LogMedicalScreen from '@/screens/LogMedicalScreen';
import Register from '@/screens/Register';
import Login from '@/screens/Login';

const Stack = createStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0F1E' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', letterSpacing: 0.5 },
        cardStyle: { backgroundColor: '#0A0F1E' },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
      name="Register"
      component={Register}
      options={{headerShown:false}}
      />
       <Stack.Screen
        name="Login"
        component={Login}
        options={{ headerShown: false }}
      />
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