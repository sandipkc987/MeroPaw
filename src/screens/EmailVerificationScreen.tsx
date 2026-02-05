import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Button, Banner } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";

interface EmailVerificationScreenProps {
  email: string;
  onResend: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onBack: () => void;
}

export default function EmailVerificationScreen({
  email,
  onResend,
  onRefresh,
  onBack,
}: EmailVerificationScreenProps) {
  const { colors } = useTheme();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const handleResend = async () => {
    setIsSending(true);
    setMessage(null);
    try {
      await onResend();
      setMessage({ tone: "success", text: "Verification email sent. Check your inbox." });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to resend verification email.";
      setMessage({ tone: "error", text: msg });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: SPACING.xl }}>
      <ScreenHeader title="Verify your email" onBackPress={onBack} />

      <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginBottom: SPACING.lg }}>
        We sent a verification link to
      </Text>
      <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginBottom: SPACING.xl }}>
        {email || "your email"}
      </Text>

      {message && (
        <Banner
          text={message.text}
          tone={message.tone}
          style={{ marginBottom: SPACING.lg }}
        />
      )}

      <Button
        title={isSending ? "Sending..." : "Resend email"}
        onPress={handleResend}
        disabled={isSending}
        size="lg"
        style={{ marginBottom: SPACING.md }}
      />

      <Button
        title="I verified my email"
        onPress={onRefresh}
        size="lg"
        style={{ backgroundColor: colors.surface }}
        titleStyle={{ color: colors.text }}
      />
    </View>
  );
}

