import React, { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { Card, Input, Button, Row, Divider } from "@src/components/UI";
import { Switch } from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";

export default function LoginSecurityScreen() {
  const { colors } = useTheme();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  const handleChangePassword = () => {
    Alert.alert("Change Password", "Password change functionality coming soon!");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Login & Security" />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <TouchableOpacity
            onPress={handleChangePassword}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                  Change Password
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2, fontSize: 12 }}>
                  Update your account password
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <Divider />
          <Row
            icon="shield-checkmark-outline"
            label="Two-Factor Authentication"
            hint="Add an extra layer of security"
            control={
              <Switch
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
                trackColor={{ false: colors.borderLight, true: colors.accent }}
                thumbColor={colors.white}
              />
            }
          />
          <Divider />
          <Row
            icon="finger-print-outline"
            label="Biometric Login"
            hint="Use fingerprint or face ID"
            control={
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                trackColor={{ false: colors.borderLight, true: colors.accent }}
                thumbColor={colors.white}
              />
            }
          />
        </Card>
      </ScrollView>
    </View>
  );
}

