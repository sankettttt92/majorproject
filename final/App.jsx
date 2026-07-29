

// import React from 'react';
// import { NavigationContainer } from '@react-navigation/native';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { StatusBar } from 'expo-status-bar';
// import { View, ActivityIndicator } from 'react-native';
// import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
// import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2';

// import RootNavigator from './src/navigation/RootNavigator';

// export default function App() {
//   const [fontsLoaded] = useFonts({
//     SpaceGrotesk_700Bold,
//     Baloo2_700Bold,
//   });

//   if (!fontsLoaded) {
//     return (
//       <View style={{ flex: 1, backgroundColor: '#0A0F1E', justifyContent: 'center', alignItems: 'center' }}>
//         <ActivityIndicator color="#fff" />
//       </View>
//     );
//   }

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <SafeAreaProvider>
//         <NavigationContainer>
//           <StatusBar style="light" backgroundColor="#0A0F1E" />
//           <RootNavigator />
//         </NavigationContainer>
//       </SafeAreaProvider>
//     </GestureHandlerRootView>
//   );
// }

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2';

import RootNavigator from './src/navigation/RootNavigator';
import StatusUpdateModal from './src/components/StatusUpdateModal';
import { joinUserRoom, listenForStatusUpdates } from './src/services/socket';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    Baloo2_700Bold,
  });

  // Live incident status updates — pushed via Socket.IO from the backend
  // whenever a dispatcher changes an incident's status (VERIFIED, DISPATCHED,
  // team allocated/unallocated, etc). Mounted here at the root so the modal
  // can appear on top of any screen, not just Home.
  const [statusUpdate, setStatusUpdate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    joinUserRoom();

    const unsubscribe = listenForStatusUpdates((update) => {
      console.log('[status update]', update);
      setStatusUpdate(update);
      setModalVisible(true);
    });

    return unsubscribe;
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0F1E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor="#0A0F1E" />
          <RootNavigator />
          <StatusUpdateModal
            visible={modalVisible}
            update={statusUpdate}
            onClose={() => setModalVisible(false)}
          />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}