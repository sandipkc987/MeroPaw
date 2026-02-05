import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle } from "@src/components/UI";
import { SPACING } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";

const SETTINGS_KEY = "@kasper_settings";

function effectiveNotif(master: boolean, flag: boolean) {
  return master && flag;
}

export default function NotificationsSettingsScreen() {
  const { colors } = useTheme();
  const [notifAll, setNotifAll] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);
  const [notifHealth, setNotifHealth] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.notifAll !== undefined) setNotifAll(settings.notifAll);
        if (settings.notifReminders !== undefined) setNotifReminders(settings.notifReminders);
        if (settings.notifHealth !== undefined) setNotifHealth(settings.notifHealth);
        if (settings.notifPromo !== undefined) setNotifPromo(settings.notifPromo);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.notifAll = notifAll;
      settings.notifReminders = notifReminders;
      settings.notifHealth = notifHealth;
      settings.notifPromo = notifPromo;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [notifAll, notifReminders, notifHealth, notifPromo]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Notifications" />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle title="Notifications" subtitle="Stay on top of feeding, health and appointments" />
        <Card>
          <Row 
            icon="notifications-outline" 
            label="App Notifications" 
            hint="Master switch for push + in‑app alerts" 
            control={
              <Switch 
                value={notifAll} 
                onValueChange={setNotifAll} 
                trackColor={{ false: colors.borderLight, true: colors.accent }} 
                thumbColor={colors.white} 
              />
            } 
          />
          <Divider />
          <Row 
            icon="alarm-outline"
            label="Reminders" 
            hint="Feeding, grooming, vaccines, meds" 
            control={
              <Switch 
                value={effectiveNotif(notifAll, notifReminders)} 
                onValueChange={(val) => { if (notifAll) setNotifReminders(val); }} 
                trackColor={{ false: colors.borderLight, true: colors.accent }} 
                thumbColor={colors.white}
                disabled={!notifAll}
              />
            } 
            disabled={!notifAll} 
          />
          <Divider />
          <Row 
            icon="medkit-outline"
            label="Health Alerts" 
            hint="Abnormal weight, wellness score changes" 
            control={
              <Switch 
                value={effectiveNotif(notifAll, notifHealth)} 
                onValueChange={(val) => { if (notifAll) setNotifHealth(val); }} 
                trackColor={{ false: colors.borderLight, true: colors.accent }} 
                thumbColor={colors.white}
                disabled={!notifAll}
              />
            } 
            disabled={!notifAll} 
          />
          <Divider />
          <Row 
            icon="pricetag-outline"
            label="Promotions" 
            hint="Deals from Meropaw Shop" 
            control={
              <Switch 
                value={effectiveNotif(notifAll, notifPromo)} 
                onValueChange={(val) => { if (notifAll) setNotifPromo(val); }} 
                trackColor={{ false: colors.borderLight, true: colors.accent }} 
                thumbColor={colors.white}
                disabled={!notifAll}
              />
            } 
            disabled={!notifAll} 
          />
        </Card>
      </ScrollView>
    </View>
  );
}

