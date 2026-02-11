import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Linking, TouchableOpacity, Alert } from "react-native";
import { Button, Card, Row, Divider, SectionTitle, Toggle } from "@src/components/UI";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useAuth } from "@src/contexts/AuthContext";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@src/services/notificationPreferences";
import { sendTestPush } from "@src/services/supabaseData";

function effectiveNotif(master: boolean, flag: boolean) {
  return master && flag;
}

export default function NotificationsSettingsScreen() {
  const { colors } = useTheme();
  const { user, isAdmin } = useAuth();
  const [notifAll, setNotifAll] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);
  const [notifHealth, setNotifHealth] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const prefs = await getNotificationPreferences();
      setNotifAll(prefs.notifAll);
      setNotifReminders(prefs.notifReminders);
      setNotifHealth(prefs.notifHealth);
      setNotifPromo(prefs.notifPromo);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      await updateNotificationPreferences({
        notifAll,
        notifReminders,
        notifHealth,
        notifPromo,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [notifAll, notifReminders, notifHealth, notifPromo]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [saveSettings]);

  const handleSendTestPush = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in before sending a test push.");
      return;
    }
    setIsSendingTest(true);
    try {
      await sendTestPush(user.id);
      Alert.alert("Test sent", "Check your device for the push notification.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send test push.";
      Alert.alert("Failed to send", message);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="" variant="stacked" />
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
              <Toggle
                value={notifAll}
                onValueChange={setNotifAll}
              />
            } 
          />
          <Divider />
          <Row 
            icon="alarm-outline"
            label="Reminders" 
            hint="Feeding, grooming, vaccines, meds" 
            control={
              <Toggle
                value={effectiveNotif(notifAll, notifReminders)}
                onValueChange={(val) => { if (notifAll) setNotifReminders(val); }}
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
              <Toggle
                value={effectiveNotif(notifAll, notifHealth)}
                onValueChange={(val) => { if (notifAll) setNotifHealth(val); }}
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
              <Toggle
                value={effectiveNotif(notifAll, notifPromo)}
                onValueChange={(val) => { if (notifAll) setNotifPromo(val); }}
                disabled={!notifAll}
              />
            } 
            disabled={!notifAll} 
          />
        </Card>
        {isAdmin ? (
          <View style={{ marginTop: SPACING.xl }}>
            <SectionTitle title="Admin tools" subtitle="Internal testing utilities" />
            <Card>
              <Row
                icon="send-outline"
                label="Send test push"
                hint="Deliver a sample push to this device"
                control={
                  <Button
                    title={isSendingTest ? "Sending..." : "Send"}
                    onPress={handleSendTestPush}
                    disabled={isSendingTest}
                    size="sm"
                  />
                }
              />
            </Card>
          </View>
        ) : null}
        <View style={{ marginTop: SPACING.lg }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, fontStyle: "italic", fontSize: 12 }}>
            Note: Notifications are managed in your device settings.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{ marginTop: SPACING.xs, alignSelf: "flex-start" }}
          >
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600", textDecorationLine: "underline", fontSize: 12 }}>
              Open device settings
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

