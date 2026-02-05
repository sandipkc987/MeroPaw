import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@src/contexts/ThemeContext";

export default function Label({ label, children }:{ label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}
