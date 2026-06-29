import { useColorScheme } from 'react-native';
import { COLORS } from '../utils/theme';

export function useTheme() {
  // Your app is forced dark (userInterfaceStyle: "dark" in app.json)
  // so this always returns COLORS
  const scheme = useColorScheme();
  return COLORS;
}