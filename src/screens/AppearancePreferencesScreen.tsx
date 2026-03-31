import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, ScrollView, Appearance, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle } from "@src/components/UI";
import Select from "@src/components/Select";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useNavigation } from "@src/contexts/NavigationContext";

const SETTINGS_KEY = "@kasper_settings";

function getResolvedTheme(mode: "light" | "dark" | "system"): "light" | "dark" {
  if (mode === "system") {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  }
  return mode;
}

export default function AppearancePreferencesScreen() {
  const { themeMode, isDark, setTheme: setAppTheme, colors } = useTheme();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  // Use context's resolved theme (what's on screen) so we never flip on open, even when storage/Appearance race
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    themeMode === "system" ? (isDark ? "dark" : "light") : themeMode
  );
  const [language, setLanguage] = useState("en");

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.theme !== undefined) {
          setTheme(getResolvedTheme(settings.theme));
        }
        if (settings.language !== undefined) setLanguage(settings.language);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.theme = theme;
      settings.language = language;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [theme, language]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [saveSettings]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setAppTheme(theme as "light" | "dark");
  }, [theme, setAppTheme]);

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <ScreenHeader
        title=""
        variant="stacked"
        onBackPress={() => {
          if (canGoBack) {
            goBack();
            return;
          }
          setActiveScreen(null);
          setActiveTab("profile");
        }}
      />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle title="Appearance & Language" subtitle="Personalize the app experience" />
        <Card>
          <Row
            icon="color-palette-outline"
            label="Theme"
            hint="Light or Dark"
            control={
              <Select
                value={theme}
                onChange={(v) => setTheme(v as "light" | "dark")}
                options={[
                  { label: "Light", value: "light" },
                  { label: "Dark", value: "dark" },
                ]}
                width={160}
                modalTitle="Theme"
                modalIcon="color-palette-outline"
              />
            }
          />
          <Divider />
          <Row
            icon="language-outline"
            label="Language"
            hint="English"
            control={
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>English</Text>
            }
          />
        </Card>
      </ScrollView>
    </View>
  );
}

