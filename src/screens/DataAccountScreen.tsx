import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch, Pressable, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Row, Divider, SectionTitle } from "@src/components/UI";
import { SPACING } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";

const SETTINGS_KEY = "@kasper_settings";

export default function DataAccountScreen() {
  const { colors } = useTheme();
  const [cloudSync, setCloudSync] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.cloudSync !== undefined) setCloudSync(settings.cloudSync);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.cloudSync = cloudSync;
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
  }, [cloudSync]);

  function handleExport() {
    Alert.alert("Export", "Mock export complete! (Would generate PDF/CSV of pet health and reminders.)");
  }

  function handleManagePermissions() {
    Alert.alert("Manage Permissions", "Control app permissions", [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => {
        Alert.alert("Settings", "Would open device settings to manage permissions");
      }},
    ]);
  }

  function handleDelete() {
    Alert.alert("Delete Account", "Permanently delete account? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => Alert.alert("Deleted", "(Preview only — no real deletion)") },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Data & Account" />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle title="Data & Account" subtitle="Control your data and access" />
        <Card>
          <Row 
            icon="cloud-outline" 
            label="Cloud Backup & Sync" 
            hint="Keep data synced across devices" 
            control={
              <Switch 
                value={cloudSync} 
                onValueChange={setCloudSync} 
                trackColor={{ false: colors.borderLight, true: colors.accent }} 
                thumbColor={colors.white} 
              />
            } 
          />
          <Divider />
          <View style={styles.actionsRow}>
            <Pressable onPress={handleExport} style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Export Data (PDF/CSV)</Text>
            </Pressable>
            <Pressable onPress={handleManagePermissions} style={[styles.secondaryBtn, { marginLeft: 8, backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Manage Permissions</Text>
            </Pressable>
          </View>
        </Card>

        <Card style={{ marginTop: SPACING.lg }}>
          <Pressable onPress={handleDelete} style={[styles.dangerBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
            <Text style={[styles.dangerText, { color: colors.danger }]}>Delete Account</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: "row", flexWrap: "wrap", paddingTop: 4 },
  secondaryBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: {},
  dangerBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  dangerText: { fontWeight: "600" },
});

