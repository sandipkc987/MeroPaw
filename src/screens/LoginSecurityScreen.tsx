import React, { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { Card, Row, Divider, Input, Button, SectionTitle, Toggle } from "@src/components/UI";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@src/contexts/AuthContext";
import { getSupabaseClient } from "@src/services/supabaseClient";
import { useNavigation } from "@src/contexts/NavigationContext";

type EditSection = "password" | null;

export default function LoginSecurityScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editing, setEditing] = useState<EditSection>(null);

  const handleChangePassword = () => {
    if (!user?.email) {
      Alert.alert("Missing Email", "We couldn't find your account email. Please sign in again.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Incomplete", "Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Weak Password", "Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }

    setIsUpdating(true);
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (reauthError) {
          throw new Error("Current password is incorrect.");
        }
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          throw new Error(updateError.message);
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        Alert.alert("Password Updated", "Your password has been changed successfully.");
      } catch (error: any) {
        Alert.alert("Update Failed", error?.message || "Please try again.");
      } finally {
        setIsUpdating(false);
      }
    })();
  };

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const renderPasswordRow = () => {
    const isEditing = editing === "password";
    return (
      <>
        <Row
          icon="lock-closed-outline"
          label="Change password"
          hint="Use at least 8 characters"
          control={
            <TouchableOpacity
              onPress={() => {
                if (isEditing) {
                  resetPasswordFields();
                  setEditing(null);
                } else {
                  setEditing("password");
                }
              }}
            >
              <Text style={[styles.actionText, { color: isEditing ? colors.text : colors.accent }]}>
                {isEditing ? "Cancel" : "Edit"}
              </Text>
            </TouchableOpacity>
          }
        />
        {isEditing ? (
          <View style={styles.inlineEditor}>
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              style={{ marginBottom: SPACING.sm }}
            />
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              secureTextEntry
              style={{ marginBottom: SPACING.sm }}
            />
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              style={{ marginBottom: SPACING.md }}
            />
            <Button
              title={isUpdating ? "Updating..." : "Save and continue"}
              onPress={handleChangePassword}
              disabled={isUpdating}
            />
          </View>
        ) : null}
        <Divider />
      </>
    );
  };

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
        <SectionTitle title="Login & Security" subtitle="Password and account protection" />
        <Card>
          {renderPasswordRow()}
          <Row
            icon="shield-checkmark-outline"
            label="Two-Factor Authentication"
            hint="Add an extra layer of security"
            control={
              <Toggle
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
              />
            }
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionText: {
    ...TYPOGRAPHY.sm,
    fontWeight: "600",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  inlineEditor: {
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },
});

