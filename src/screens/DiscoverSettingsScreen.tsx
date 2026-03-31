import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import ScreenHeader from "@src/components/ScreenHeader";
import {
  fetchPetVisibilityPolicy,
  upsertPetVisibilityPolicy,
} from "@src/services/feedService";

const OPTIONS = [
  { value: "global" as const, label: "Public", icon: "globe-outline", desc: "Visible in Discover feed" },
  { value: "private" as const, label: "Private", icon: "lock-closed-outline", desc: "Only you can see" },
] as const;

export default function DiscoverSettingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const { goBack } = useNavigation();
  const activePet = getActivePet();

  const [visibility, setVisibility] = useState<"global" | "private">("global");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activePet?.id) {
      setLoading(false);
      return;
    }
    fetchPetVisibilityPolicy(activePet.id)
      .then((p) => {
        if (p?.visibility === "private") setVisibility("private");
        else setVisibility("global"); // no policy = public (default)
      })
      .catch(() => setVisibility("global"))
      .finally(() => setLoading(false));
  }, [activePet?.id]);

  const handleSelect = async (value: "global" | "private") => {
    if (!user?.id || !activePet?.id || saving) return;
    setVisibility(value);
    setSaving(true);
    try {
      await upsertPetVisibilityPolicy(user.id, activePet.id, value, true, true);
    } catch {
      setVisibility(visibility);
    } finally {
      setSaving(false);
    }
  };

  if (!activePet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: SPACING.xl }}>
        <Ionicons name="paw-outline" size={48} color={colors.textMuted} />
        <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginTop: SPACING.md, textAlign: "center" }}>
          Select a pet first
        </Text>
        <TouchableOpacity onPress={goBack} style={{ marginTop: SPACING.lg, padding: SPACING.md }}>
          <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Discover visibility"
        showBackButton
        onBackPress={goBack}
      />
      <View style={{ padding: SPACING.lg }}>
        {loading ? (
          <View style={{ paddingVertical: SPACING.xxl, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          <>
            <Text
              style={{
                ...TYPOGRAPHY.sm,
                color: colors.textMuted,
                marginBottom: SPACING.lg,
                lineHeight: 20,
              }}
            >
              Control whether {activePet.name}'s memories appear in the community Discover feed.
            </Text>

            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                overflow: "hidden",
                ...SHADOWS.sm,
              }}
            >
              {OPTIONS.map((opt, idx) => {
                const isSelected = visibility === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => handleSelect(opt.value)}
                    disabled={saving}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: SPACING.lg,
                      backgroundColor: isSelected ? colors.accent + "0C" : "transparent",
                      borderBottomWidth: idx < OPTIONS.length - 1 ? 1 : 0,
                      borderBottomColor: colors.borderLight,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: RADIUS.lg,
                        backgroundColor: isSelected ? colors.accent + "20" : colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: SPACING.md,
                      }}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={22}
                        color={isSelected ? colors.accent : colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...TYPOGRAPHY.base,
                          fontWeight: "600",
                          color: colors.text,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={{
                          ...TYPOGRAPHY.xs,
                          color: colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: colors.accent,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {saving && (
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.md, textAlign: "center" }}>
                Saving…
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
