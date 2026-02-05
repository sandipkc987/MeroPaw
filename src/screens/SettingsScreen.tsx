import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { useAuth } from "@src/contexts/AuthContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { Card, Row, Divider, SectionTitle } from "@src/components/UI";
import { SPACING, RADIUS, SHADOWS } from "@src/theme";
import PetSwitcher from "@src/components/PetSwitcher";
import ScreenHeader from "@src/components/ScreenHeader";
import Constants from "expo-constants";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { navigateTo, setActiveScreen } = useNavigation();
  const [backupEnabled, setBackupEnabled] = useState(false);
  const version = Constants.expoConfig?.version || "1.0.0";
  
  // If user logs out, this component will unmount when App.tsx switches to AuthFlow
  // But we need to ensure the logout completes before the component tries to navigate

  const handleSignOut = async () => {
    console.log('SettingsScreen: Sign out button pressed - signing out immediately');
    try {
      // 1. Reset navigation state first
      console.log('SettingsScreen: Resetting navigation state');
      setActiveScreen(null);
      
      // 2. Call logout - this will update auth state and trigger App.tsx to show AuthFlow
      console.log('SettingsScreen: Calling logout()...');
      await logout();
      console.log('SettingsScreen: Logout completed');
    } catch (error) {
      console.error('SettingsScreen: Sign out error:', error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const handleExportData = () => {
    Alert.alert(
      "Export Data",
      "We’ll generate a JSON export of your pet data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export", onPress: () => Alert.alert("Export Started", "You’ll get a notification when it’s ready.") }
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      "Delete All Data",
      "This cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => Alert.alert("Data Deleted", "All local data has been cleared.") }
      ]
    );
  };

  const handleRateApp = () => {
    Linking.openURL("https://apps.apple.com/app/id000000000"); // placeholder
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Settings" showBackButton={false} />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pet Switcher */}
        <PetSwitcher />

        {/* Account Section */}
        <SectionTitle title="Account" subtitle="Manage your profile and security" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row 
            icon="person-outline" 
            label="Personal Information" 
            hint="Name, email, and contact details"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("PersonalInformation")} 
          />
          <Divider />
          <Row 
            icon="shield-checkmark-outline" 
            label="Login & Security" 
            hint="Password, devices, and sessions"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("LoginSecurity")} 
          />
        </Card>

        {/* Pet Section */}
        <SectionTitle title="Pet" subtitle="Profiles, details, and care" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row
            icon="paw"
            label="View Profile"
            hint="See bio, memories, and stats"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => navigateTo("Profile")}
          />
          <Divider />
          <Row
            icon="add-circle-outline"
            label="Add Pet Profile"
            hint="Create a new profile"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => navigateTo("AddPet")}
          />
        </Card>

        {/* Preferences Section */}
        <SectionTitle title="Preferences" subtitle="Customize your experience" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row 
            icon="notifications-outline" 
            label="Notifications" 
            hint="Reminders, alerts, and updates"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("NotificationsSettings")} 
          />
          <Divider />
          <Row 
            icon="medkit-outline" 
            label="Health & Wellness" 
            hint="Goals, trackers, and insights"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("HealthWellnessSettings")} 
          />
          <Divider />
          <Row 
            icon="color-palette-outline" 
            label="Appearance & Language" 
            hint="Theme, language, and region"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("AppearancePreferences")} 
          />
        </Card>

        {/* Data Section */}
        <SectionTitle title="Data & Privacy" subtitle="Control your data and backups" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row 
            icon="download-outline" 
            label="Export Data" 
            hint="Download JSON backup"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={handleExportData} 
          />
          <Divider />
          <Row
            icon="cloud-upload-outline"
            label="Backup to Cloud"
            hint="Auto-save weekly"
            control={
              <Switch
                value={backupEnabled}
                onValueChange={setBackupEnabled}
                trackColor={{ false: colors.borderLight, true: colors.accent }}
                thumbColor={colors.white}
              />
            }
          />
          <Divider />
          <Row
            icon="trash-outline"
            label="Delete All Data"
            hint="Removes everything"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={handleDeleteAllData}
          />
        </Card>

        {/* Support Section */}
        <SectionTitle title="Support" subtitle="Help, feedback, and ratings" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row 
            icon="help-circle-outline" 
            label="Support" 
            hint="FAQs and contact options"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />} 
            onPress={() => navigateTo("Support")} 
          />
          <Divider />
          <Row
            icon="mail-outline"
            label="Send Feedback"
            hint="Share ideas & bugs"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => navigateTo("Feedback")}
          />
          <Divider />
          <Row
            icon="star-outline"
            label="Rate Meropaw"
            hint="App Store & Play Store"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={handleRateApp}
          />
        </Card>

        {/* App Info */}
        <SectionTitle title="App Info" subtitle="Legal and version details" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row
            icon="document-text-outline"
            label="Privacy Policy"
            hint="How we handle your data"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => handleOpenUrl("https://meropaw.com/privacy")}
          />
          <Divider />
          <Row
            icon="document-outline"
            label="Terms of Service"
            hint="Usage guidelines and policies"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => handleOpenUrl("https://meropaw.com/terms")}
          />
          <Divider />
          <Row
            icon="code-slash-outline"
            label="Open Source Licenses"
            hint="Acknowledgements and licenses"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={() => handleOpenUrl("https://meropaw.com/licenses")}
          />
          <Divider />
          <Row
            icon="information-circle-outline"
            label={`Version ${version}`}
            hint="Current app version"
            control={null}
            disabled
          />
        </Card>

        {/* Sign Out */}
        <SectionTitle title="Account Actions" subtitle="Session and account access" />
        <Card style={{ marginBottom: SPACING.xl }} elevated>
          <Row
            icon="log-out-outline"
            label="Sign Out"
            hint="You'll need to log in again"
            control={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            onPress={handleSignOut}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

