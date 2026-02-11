import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle, Toggle } from "@src/components/UI";
import Select from "@src/components/Select";
import Stepper from "@src/components/Stepper";
import type { Option } from "@src/components/Select";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { insertNotification } from "@src/services/supabaseData";

const SETTINGS_KEY = "@kasper_settings";
const WELLNESS_OPTIONS: Option[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

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
  const [wellnessUpdates, setWellnessUpdates] = useState(true);
  const [wellnessCadence, setWellnessCadence] = useState("weekly");
  const [vetSync, setVetSync] = useState(false);
  const initializedRef = useRef(false);
  const prevRef = useRef({
    weightAlert,
    weightThreshold,
    wellnessUpdates,
    wellnessCadence,
    vetSync,
  });

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.weightAlert !== undefined) setWeightAlert(settings.weightAlert);
        if (settings.weightThreshold !== undefined) setWeightThreshold(settings.weightThreshold);
        if (settings.wellnessUpdates !== undefined) setWellnessUpdates(settings.wellnessUpdates);
        if (settings.wellnessCadence !== undefined) setWellnessCadence(settings.wellnessCadence);
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
      settings.wellnessUpdates = wellnessUpdates;
      settings.wellnessCadence = wellnessCadence;
      settings.vetSync = vetSync;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [weightAlert, weightThreshold, wellnessUpdates, wellnessCadence, vetSync]);

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
        wellnessUpdates,
        wellnessCadence,
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
    if (wellnessUpdates && !prev.wellnessUpdates) {
      insertNotification(user.id, {
        petId,
        kind: "health",
        title: "Wellness updates enabled",
        message: "You'll receive wellness summaries.",
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
      wellnessUpdates,
      wellnessCadence,
      vetSync,
    };
  }, [weightAlert, weightThreshold, wellnessUpdates, wellnessCadence, vetSync, user?.id, activePet?.id]);

  function handleConnectCalendar() {
    setVetSync(true);
    Alert.alert("Vet Sync", "Mock: Connected to your device calendar for vet appointments.");
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
            icon="pulse-outline"
            label="Wellness Score Updates"
            hint={wellnessUpdates ? `Delivery: ${wellnessCadence === "weekly" ? "Weekly" : "Monthly"}` : "Disabled"}
            control={
              <Toggle
                value={wellnessUpdates}
                onValueChange={setWellnessUpdates}
              />
            }
          />
          <View style={styles.inlineBetween}>
            <Text style={[styles.inlineLabel, { color: colors.textMuted }]}>Cadence</Text>
            <Select
              value={wellnessCadence}
              onChange={setWellnessCadence}
              options={WELLNESS_OPTIONS}
              width={180}
            />
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
            <Pressable onPress={handleConnectCalendar} style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Connect Calendar</Text>
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

