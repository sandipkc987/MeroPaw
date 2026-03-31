import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking, Modal, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { useAuth } from "@src/contexts/AuthContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from "@src/theme";
import PetSwitcher from "@src/components/PetSwitcher";
import ScreenHeader from "@src/components/ScreenHeader";
import Constants from "expo-constants";
import storage from "@src/utils/storage";
import { deleteAllUserData } from "@src/services/supabaseData";

// Modern setting row: icon badge, label, hint, control/chevron
function SettingRow({
  icon,
  iconColor,
  label,
  hint,
  control,
  onPress,
  disabled,
  showChevron = true,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  hint?: string;
  control?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showChevron?: boolean;
}) {
  const { colors } = useTheme();
  const tint = iconColor || colors.accent;
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: RADIUS.lg,
        backgroundColor: tint + "18",
        alignItems: "center",
        justifyContent: "center",
        marginRight: SPACING.md,
      }}>
        <Ionicons name={icon as any} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...TYPOGRAPHY.base, fontWeight: "400", color: colors.text }} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {control !== undefined ? (
        <View style={{ marginLeft: SPACING.sm }}>{control}</View>
      ) : showChevron && !disabled ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{ marginLeft: SPACING.sm }} />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={{ opacity: disabled ? 0.6 : 1 }}>{content}</View>;
}

// Thin separator between rows (not after last)
function RowDivider() {
  const { colors } = useTheme();
  return (
    <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: SPACING.lg + 40 + SPACING.md }} />
  );
}

// Section header: small label + optional subtitle
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: SPACING.sm, marginTop: SPACING.xl }}>
      <Text style={{
        ...TYPOGRAPHY.xs,
        fontWeight: "700",
        color: colors.textMuted,
        letterSpacing: 1.2,
        textTransform: "uppercase",
      }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2, letterSpacing: 0 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const CONTAINER_GRADIENT = (accent: string) => [accent + "14", accent + "06", "transparent"] as const;

// Wrapper for a group of rows (single card per section)
function SettingsGroup({ children, gradientAtTop }: { children: React.ReactNode; gradientAtTop?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: "hidden",
      ...SHADOWS.sm,
    }}>
      {gradientAtTop && (
        <LinearGradient
          colors={CONTAINER_GRADIENT(colors.accent)}
          style={{ height: 24 }}
        />
      )}
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const { navigateTo, setActiveScreen, setNavHidden, goBack, canGoBack, setActiveTab } = useNavigation();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const version = Constants.expoConfig?.version || "1.0.0";
  const lastScrollYRef = useRef(0);
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;

  useEffect(() => {
    return () => setNavHidden(false);
  }, [setNavHidden]);

  const handleSignOutPress = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOutConfirm = async () => {
    setShowSignOutConfirm(false);
    try {
      setActiveScreen(null);
      await logout();
    } catch (error) {
      console.error("SettingsScreen: Sign out error:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const handleExportData = () => {
    const title = "Export Data";
    const message =
      "We're working on it! Data export will let you download a copy of your pet's info, health records, and memories. Check back in a future update.";
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: "OK" }]);
    }
  };

  const handleDeleteAllData = () => {
    const title = "Delete All Data";
    const message =
      "This will permanently delete all your pets, memories, health records, and other data. You will be signed out. This cannot be undone.";
    const runDelete = async () => {
      if (!user?.id) {
        if (Platform.OS === "web") window.alert("Error\n\nYou must be signed in to delete data.");
        else Alert.alert("Error", "You must be signed in to delete data.");
        return;
      }
      try {
        setActiveScreen(null);
        await deleteAllUserData(user.id);
        await storage.multiRemove([
          "kasper_user",
          "kasper_onboarding_complete",
          "kasper_signup_data",
          "@kasper_pets",
          "@kasper_active_pet",
          "@kasper_settings",
          "@kasper_memories",
          "@kasper_onboarding_highlights",
          "@kasper_seen_flashbacks",
        ]);
        await logout();
        if (Platform.OS === "web") window.alert("Done\n\nAll your data has been deleted. You have been signed out.");
        else Alert.alert("Done", "All your data has been deleted. You have been signed out.");
      } catch (error) {
        console.error("SettingsScreen: Delete all data error:", error);
        if (Platform.OS === "web") window.alert("Error\n\nSomething went wrong. Please try again or contact support.");
        else Alert.alert("Error", "Something went wrong. Please try again or contact support.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) runDelete();
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete All", style: "destructive", onPress: runDelete },
      ]);
    }
  };

  const handleRateApp = () => {
    Linking.openURL("https://apps.apple.com/app/id000000000");
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Settings"
        showBackButton
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
        onBackPress={() => {
          if (canGoBack) {
            goBack();
            return;
          }
          setActiveScreen(null);
          setActiveTab("home");
        }}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset?.y ?? 0;
          const delta = y - lastScrollYRef.current;
          if (y <= 0) {
            setNavHidden(false);
            if (headerCompactRef.current) {
              headerCompactRef.current = false;
              setHeaderCompact(false);
            }
          } else {
            if (delta > 12) setNavHidden(true);
            else if (delta < -12) setNavHidden(false);
            const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
            if (nextCompact !== headerCompactRef.current) {
              headerCompactRef.current = nextCompact;
              setHeaderCompact(nextCompact);
            }
          }
          lastScrollYRef.current = y;
        }}
        scrollEventThrottle={0}
      >
        {/* Pet switcher – top hero */}
        <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.md }}>
          <PetSwitcher />
        </View>

        {/* Account */}
        <SectionHeader title="Account" subtitle="Profile and security" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="person-outline"
            label="Personal Information"
            hint="Name, email, contact"
            onPress={() => navigateTo("PersonalInformation")}
          />
          <RowDivider />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Login & Security"
            hint="Password, devices, sessions"
            onPress={() => navigateTo("LoginSecurity")}
          />
        </SettingsGroup>

        {/* Pet */}
        <SectionHeader title="Pet" subtitle="Profiles and care" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="paw"
            label="Current Pet Settings"
            hint="Edit bio, about, and details"
            onPress={() => navigateTo("CurrentPetProfileSettings")}
          />
          <RowDivider />
          <RowDivider />
          <SettingRow
            icon="compass-outline"
            label="Discover"
            hint="Feed visibility and sharing"
            onPress={() => navigateTo("DiscoverSettings")}
          />
          <RowDivider />
          <SettingRow
            icon="add-circle-outline"
            label="Add Pet Profile"
            hint="Create a new profile"
            onPress={() => navigateTo("AddPet")}
          />
        </SettingsGroup>

        {/* Preferences */}
        <SectionHeader title="Preferences" subtitle="Customize your experience" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            hint="Reminders and alerts"
            onPress={() => navigateTo("NotificationsSettings")}
          />
          <RowDivider />
          <SettingRow
            icon="medkit-outline"
            label="Health & Wellness"
            hint="Goals and insights"
            onPress={() => navigateTo("HealthWellnessSettings")}
          />
          <RowDivider />
          <SettingRow
            icon="color-palette-outline"
            label="Appearance & Language"
            hint="Theme, language, region"
            onPress={() => navigateTo("AppearancePreferences")}
          />
        </SettingsGroup>

        {/* Data & Privacy */}
        <SectionHeader title="Data & Privacy" subtitle="Backups and data control" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="download-outline"
            label="Export Data"
            hint="Download JSON backup"
            onPress={handleExportData}
          />
          <RowDivider />
          <SettingRow
            icon="trash-outline"
            iconColor={colors.danger}
            label="Delete All Data"
            hint="Removes everything"
            onPress={handleDeleteAllData}
          />
        </SettingsGroup>

        {/* Support */}
        <SectionHeader title="Support" subtitle="Help and feedback" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="help-circle-outline"
            label="Support"
            hint="FAQs and contact"
            onPress={() => navigateTo("Support")}
          />
          <RowDivider />
          <SettingRow
            icon="mail-outline"
            label="Send Feedback"
            hint="Ideas and bugs"
            onPress={() => navigateTo("Feedback")}
          />
          <RowDivider />
          <SettingRow
            icon="star-outline"
            label="Rate Meropaw"
            hint="App Store & Play Store"
            onPress={handleRateApp}
          />
        </SettingsGroup>

        {/* App Info */}
        <SectionHeader title="Legal & Info" subtitle="Policies and version" />
        <SettingsGroup gradientAtTop>
          <SettingRow
            icon="document-text-outline"
            label="Privacy Policy"
            hint="How we handle your data"
            onPress={() => handleOpenUrl("https://meropaw.com/privacy")}
          />
          <RowDivider />
          <SettingRow
            icon="document-outline"
            label="Terms of Service"
            hint="Usage guidelines"
            onPress={() => handleOpenUrl("https://meropaw.com/terms")}
          />
          <RowDivider />
          <SettingRow
            icon="code-slash-outline"
            label="Open Source Licenses"
            hint="Acknowledgements"
            onPress={() => handleOpenUrl("https://meropaw.com/licenses")}
          />
          <RowDivider />
          <SettingRow
            icon="information-circle-outline"
            label={`Version ${version}`}
            hint="Current app version"
            showChevron={false}
            disabled
          />
        </SettingsGroup>

        {/* Sign Out – prominent but secondary */}
        <View style={{ marginTop: SPACING.xl, marginBottom: SPACING.lg }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            borderWidth: 1,
            borderColor: colors.borderLight,
            overflow: "hidden",
            ...SHADOWS.sm,
          }}>
            <LinearGradient
              colors={CONTAINER_GRADIENT(colors.accent)}
              style={{ height: 24 }}
            />
            <TouchableOpacity
              onPress={handleSignOutPress}
              activeOpacity={0.8}
              style={{
                paddingVertical: SPACING.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: SPACING.sm }} />
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.danger }}>Sign Out</Text>
            </View>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 4 }}>You'll need to log in again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Sign out confirmation modal – works on web and native */}
      <Modal
        visible={showSignOutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutConfirm(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.xl }}
          activeOpacity={1}
          onPress={() => setShowSignOutConfirm(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: RADIUS.xxl,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.borderLight,
              ...SHADOWS.lg,
            }}
          >
            <LinearGradient
              colors={[colors.danger + "20", colors.danger + "08", "transparent"]}
              style={{ height: 4 }}
            />
            <View style={{ padding: SPACING.xl }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                <View style={{ width: 40, height: 40, borderRadius: RADIUS.lg, backgroundColor: colors.danger + "18", alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                  <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                </View>
                <Text style={{ ...TYPOGRAPHY.xl, fontWeight: "700", color: colors.text }}>Sign Out</Text>
              </View>
              <Text style={{ ...TYPOGRAPHY.base, color: colors.textSecondary, marginBottom: SPACING.xxl, paddingLeft: 48 }}>Are you sure you want to sign out? You'll need to log in again to access your account.</Text>
              <View style={{ flexDirection: "row", gap: SPACING.md, justifyContent: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => setShowSignOutConfirm(false)}
                  style={{
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.xl,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSignOutConfirm}
                  style={{
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.xl,
                    borderRadius: RADIUS.pill,
                    backgroundColor: colors.danger,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.white }}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
