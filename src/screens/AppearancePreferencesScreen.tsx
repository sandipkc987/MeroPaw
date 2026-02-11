import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle } from "@src/components/UI";
import Select from "@src/components/Select";
import { SPACING } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useNavigation } from "@src/contexts/NavigationContext";

const SETTINGS_KEY = "@kasper_settings";

export default function AppearancePreferencesScreen() {
  const { themeMode, setTheme: setAppTheme } = useTheme();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const [theme, setTheme] = useState(themeMode === "system" ? "light" : themeMode);
  const [language, setLanguage] = useState("en");

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.theme !== undefined) setTheme(settings.theme);
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

  useEffect(() => {
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
            hint="Choose your preferred language"
            control={
              <Select
                value={language}
                onChange={setLanguage}
                options={[
                  { label: "English", value: "en" },
                  { label: "Español", value: "es" },
                  { label: "नेपाली (Nepali)", value: "ne" },
                  { label: "Français", value: "fr" },
                ]}
                width={180}
                modalTitle="Language"
                modalIcon="language-outline"
              />
            }
          />
        </Card>
      </ScrollView>
    </View>
  );
}

