import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle, Toggle } from "@src/components/UI";
import Stepper from "@src/components/Stepper";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { insertNotification, fetchVetAppointments, updateVetAppointment } from "@src/services/supabaseData";
import {
  isCalendarSyncAvailable,
  requestCalendarPermission,
  getCalendarId,
  createVetCalendarEvent,
} from "@src/services/calendarSync";

const SETTINGS_KEY = "@kasper_settings";

function toCalendarAppointment(apt: {
  title?: string;
  appointmentDate: string;
  appointmentTime?: string;
  clinicName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  reason?: string;
  notes?: string;
}) {
  return {
    title: apt.title ?? null,
    appointment_date: apt.appointmentDate,
    appointment_time: apt.appointmentTime ?? null,
    clinic_name: apt.clinicName ?? null,
    address_line1: apt.addressLine1 ?? null,
    city: apt.city ?? null,
    state: apt.state ?? null,
    zip: apt.zip ?? null,
    reason: apt.reason ?? null,
    notes: apt.notes ?? null,
  };
}

function clamp(n: number, min = 1, max = 15) {
  return Math.max(min, Math.min(max, n));
}

export default function HealthWellnessSettingsScreen() {
  const { colors } = useTheme();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const [weightAlert, setWeightAlert] = useState(true);
  const [weightThreshold, setWeightThreshold] = useState(5);
  const [vetSync, setVetSync] = useState(false);
  const initializedRef = useRef(false);
  const prevRef = useRef({
    weightAlert,
    weightThreshold,
    vetSync,
  });

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.weightAlert !== undefined) setWeightAlert(settings.weightAlert);
        if (settings.weightThreshold !== undefined) setWeightThreshold(settings.weightThreshold);
        if (settings.vetSync !== undefined) setVetSync(settings.vetSync);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.weightAlert = weightAlert;
      settings.weightThreshold = weightThreshold;
      settings.vetSync = vetSync;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [weightAlert, weightThreshold, vetSync]);

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
    if (!user?.id) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = {
        weightAlert,
        weightThreshold,
        vetSync,
      };
      return;
    }
    const prev = prevRef.current;
    const petId = activePet?.id;

    if (weightAlert && !prev.weightAlert) {
      insertNotification(user.id, {
        petId,
        kind: "health",
        title: "Weight change alerts enabled",
        message: `We'll notify you when weight changes by ±${weightThreshold}%.`,
      }).catch(() => {});
    }
    if (weightThreshold !== prev.weightThreshold && weightAlert) {
      insertNotification(user.id, {
        petId,
        kind: "health",
        title: "Weight alert sensitivity updated",
        message: `Threshold set to ±${weightThreshold}%.`,
      }).catch(() => {});
    }
    if (vetSync && !prev.vetSync) {
      insertNotification(user.id, {
        petId,
        kind: "health",
        title: "Vet appointment sync enabled",
        message: "We’ll notify you about upcoming vet visits.",
      }).catch(() => {});
    }

    prevRef.current = {
      weightAlert,
      weightThreshold,
      vetSync,
    };
  }, [weightAlert, weightThreshold, vetSync, user?.id, activePet?.id]);

  const [connectingCalendar, setConnectingCalendar] = useState(false);

  async function handleConnectCalendar() {
    if (Platform.OS === "web") {
      window.alert("Coming soon\n\nCalendar sync is not available on web.");
      return;
    }
    const notAvailable = "Calendar sync is not available on this device.";
    const available = await isCalendarSyncAvailable();
    if (!available) {
      Alert.alert("Not available", notAvailable);
      return;
    }
    setConnectingCalendar(true);
    try {
      const granted = await requestCalendarPermission();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Meropaw needs calendar access to add your vet appointments. You can enable it in Settings."
        );
        setConnectingCalendar(false);
        return;
      }
      const calendarId = await getCalendarId();
      if (!calendarId) {
        Alert.alert("Error", "Could not find a calendar to use. Please check your device settings.");
        setConnectingCalendar(false);
        return;
      }
      setVetSync(true);
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.vetSync = true;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      if (user?.id && activePet?.id) {
        const appointments = await fetchVetAppointments(user.id, activePet.id);
        for (const apt of appointments) {
          if (apt.status === "canceled") continue;
          if (apt.calendarEventId) continue;
          const eventId = await createVetCalendarEvent(calendarId, toCalendarAppointment(apt));
          if (eventId) {
            await updateVetAppointment(user.id, apt.id, { calendar_event_id: eventId });
          }
        }
      }

      const success = "Calendar connected. Your vet appointments will appear in your calendar.";
      if (Platform.OS === "web") window.alert(success);
      else Alert.alert("Connected", success);
    } catch (e) {
      console.error("Connect calendar error:", e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setConnectingCalendar(false);
    }
  }

  function onThresholdChange(v: number) {
    setWeightThreshold(clamp(v, 1, 15));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <SectionTitle title="Health & Wellness" subtitle="Configure smart alerts and insights" />
        <Card>
          <Row
            icon="trending-up-outline"
            label="Weight Change Alerts"
            hint={`Trigger when ±${weightThreshold}% change is detected`}
            control={
              <Toggle
                value={weightAlert}
                onValueChange={setWeightAlert}
              />
            }
          />
          <View style={styles.inlineBetween}>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Sensitivity</Text>
            <Stepper value={weightThreshold} onChange={onThresholdChange} min={1} max={15} step={1} />
          </View>
          <Divider />
          <Row
            icon="calendar-outline"
            label="Vet Appointment Sync"
            hint={vetSync ? "Connected to Calendar" : "Sync your device calendar for upcoming vet visits"}
            control={
              <Toggle
                value={vetSync}
                onValueChange={setVetSync}
              />
            }
          />
          <View style={{ alignItems: "flex-end", marginTop: SPACING.sm }}>
            <Pressable
            onPress={handleConnectCalendar}
            disabled={connectingCalendar}
            style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: connectingCalendar ? 0.7 : 1 }]}
          >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                {connectingCalendar ? "Connecting…" : "Connect Calendar"}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  inlineLabel: { fontSize: 12 },
  secondaryBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: {},
});

