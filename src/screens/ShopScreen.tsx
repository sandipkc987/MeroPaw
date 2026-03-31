import React, { useState } from "react";
import { Text, View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS, SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { Button, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";

export default function ShopScreen() {
  const { colors } = useTheme();
  const { goBack, canGoBack, setActiveTab, setActiveScreen } = useNavigation();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const [email, setEmail] = useState("");

  const handleNotifyMe = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setEmail("");
    Alert.alert(
      "You're on the list!",
      "We'll notify you when the Meropaw Shop is ready. Thanks for your interest!",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Shop"
        showBackButton
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "400" }}
        insetSeparator
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
        onBackPress={() => {
          if (canGoBack) {
            goBack();
          } else {
            setActiveScreen(null);
            setActiveTab("home");
          }
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: SPACING.xl }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={{ alignItems: "center", marginBottom: SPACING.xxl }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.accentVeryLight ?? colors.cardSecondary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACING.xl,
            }}
          >
            <Ionicons name="bag-handle-outline" size={40} color={colors.accent} />
          </View>
          <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "700", color: colors.text, marginBottom: SPACING.sm, textAlign: "center" }}>
            Coming Soon
          </Text>
          <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, textAlign: "center", lineHeight: 24 }}>
            We're curating the best products for {petName}. Food, toys, bedding, and more—all in one place.
          </Text>
        </View>

        <View style={{ marginTop: SPACING.lg }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>
            Get notified when we launch
          </Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ marginBottom: SPACING.md }}
          />
          <Button
            title="Notify me"
            onPress={handleNotifyMe}
            disabled={!email.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
