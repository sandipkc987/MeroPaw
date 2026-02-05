import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

interface IconTileProps {
  icon: string; // Keep for compatibility but won't be used
  label: string;
  onPress?: () => void;
  active?: boolean;
  style?: any;
}

export default function IconTile({
  icon,
  label,
  onPress,
  active = false,
  style
}: IconTileProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const textColor = active ? colors.accent : colors.textMuted;
  const backgroundColor = active ? colors.accent + "10" : "transparent";

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          minWidth: 85,
          height: 40,
          marginHorizontal: SPACING.xs,
          position: "relative",
          borderRadius: RADIUS.md, // Added rounded corners for better visual feedback
          backgroundColor: pressed ? colors.surface : backgroundColor, // Subtle background on press
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }], // Subtle scale animation
          borderWidth: active ? 1 : 0, // Subtle border for active state
          borderColor: active ? colors.accent + "30" : "transparent"
        },
        style
      ]}
    >
      {/* Label text with improved typography */}
      <Text
        style={{
          color: textColor,
          ...TYPOGRAPHY.sm,
          fontWeight: active ? "700" : "600",
          letterSpacing: -0.2,
          textAlign: "center",
          opacity: pressed ? 0.8 : 1 // Subtle text opacity change on press
        }}
      >
        {label}
      </Text>
      
      {/* Active underline with improved styling */}
      {active && (
        <View
          style={{
            position: "absolute",
            bottom: -SPACING.sm,
            left: SPACING.sm,
            right: SPACING.sm,
            height: 2, // Slightly thinner for cleaner look
            backgroundColor: colors.accent,
            borderRadius: RADIUS.sm,
            ...SHADOWS.sm
          }}
        />
      )}
    </TouchableOpacity>
  );
}
