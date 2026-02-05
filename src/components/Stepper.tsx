import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { RADIUS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

export default function Stepper({ value, onChange, min = 1, max = 15, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  const { colors } = useTheme();
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel="Decrease" onPress={dec} style={[styles.btn(colors), value <= min && styles.btnDisabled]}>
        <Text style={styles.btnText(colors)}>−</Text>
      </Pressable>
      <Text style={[styles.value(colors), { marginLeft: 8 }]}>{value}%</Text>
      <Pressable accessibilityLabel="Increase" onPress={inc} style={[styles.btn(colors), { marginLeft: 8 }, value >= max && styles.btnDisabled]}>
        <Text style={styles.btnText(colors)}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = {
  wrap: { flexDirection: "row", alignItems: "center" },
  btn: (colors: any) => ({ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }),
  btnDisabled: { opacity: 0.5 },
  btnText: (colors: any) => ({ color: colors.text, fontSize: 18, fontWeight: "700" }),
  value: (colors: any) => ({ color: colors.text, fontSize: 14, minWidth: 46, textAlign: "center" }),
};

