import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";

interface ForgotPasswordScreenProps {
  onReset: (email: string) => Promise<void>;
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onReset, onBack }: ForgotPasswordScreenProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validateEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  const handleReset = async () => {
    if (!email) {
      setErrorMessage("Please enter your email.");
      return;
    }
    if (!validateEmail(email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await onReset(email);
      setSuccessMessage("Password reset link sent. Check your email.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send reset link.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: SPACING.xl }}>
        <ScreenHeader title="Reset Password" onBackPress={onBack} />

        <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginBottom: SPACING.xl }}>
          Enter your email and we will send you a reset link.
        </Text>

        <Input
          value={email}
          onChangeText={(text: string) => {
            setEmail(text);
            setErrorMessage("");
          }}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ marginBottom: SPACING.lg }}
        />

        {errorMessage ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginBottom: SPACING.lg }}>
            {errorMessage}
          </Text>
        ) : null}

        {successMessage ? (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.success, marginBottom: SPACING.lg }}>
            {successMessage}
          </Text>
        ) : null}

        <Button
          title={loading ? "Sending..." : "Send Reset Link"}
          onPress={handleReset}
          disabled={loading}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

