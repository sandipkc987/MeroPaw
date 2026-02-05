import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { SPACING, TYPOGRAPHY, RADIUS } from "@src/theme";
import { Button } from "@src/components/UI";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onPress?: () => void;
  compact?: boolean;
};

export default function EmptyState({
  icon = "images-outline",
  title,
  subtitle,
  ctaLabel,
  onPress,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const iconSize = compact ? 22 : 28;
  const containerPadding = compact ? SPACING.lg : SPACING.xl;
  const circleSize = compact ? 52 : 64;
  const circleRadius = circleSize / 2;

  return (
    <View style={{ alignItems: "center", paddingVertical: containerPadding }}>
      <View style={{
        width: circleSize,
        height: circleSize,
        borderRadius: circleRadius,
        backgroundColor: colors.cardSecondary,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: compact ? SPACING.sm : SPACING.md,
      }}>
        <Ionicons name={icon as any} size={iconSize} color={colors.textMuted} />
      </View>
      <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600", textAlign: "center" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", marginTop: SPACING.xs }}>
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onPress ? (
        <Button
          title={ctaLabel}
          onPress={onPress}
          style={{ marginTop: compact ? SPACING.sm : SPACING.md, borderRadius: RADIUS.md }}
          size={compact ? "sm" : "md"}
        />
      ) : null}
    </View>
  );
}

