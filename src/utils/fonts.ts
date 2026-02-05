import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

export const useInstagramSansFonts = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return fontsLoaded;
};

// Inter font weights (similar to Instagram Sans)
export const FONT_FALLBACKS = {
  'Inter_400Regular': 'System',
  'Inter_500Medium': 'System',
  'Inter_600SemiBold': 'System',
  'Inter_700Bold': 'System',
};
