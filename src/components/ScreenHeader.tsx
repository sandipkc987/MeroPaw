import React from "react";
import { View, Text, TouchableOpacity, Image, Platform, StatusBar } from "react-native";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@src/contexts/NavigationContext";

interface ScreenHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  avatarUri?: string | null;
  avatarFallback?: string;
  onAvatarPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onActionPress?: () => void;
}

export default function ScreenHeader({
  title,
  showBackButton = true,
  onBackPress,
  avatarUri,
  avatarFallback,
  onAvatarPress,
  actionIcon,
  onActionPress,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const { navigateTo, goBack, canGoBack } = useNavigation();
  const showAction = !!actionIcon && !!onActionPress;
  const showAvatar = !!avatarUri || !!avatarFallback;
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0;

  return (
    <>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACING.lg,
        paddingTop: topInset + SPACING.md,
        paddingBottom: SPACING.md + 2,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight
      }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {showBackButton && (
            <TouchableOpacity
              onPress={() => {
                if (onBackPress) {
                  onBackPress();
                  return;
                }
                if (canGoBack) {
                  goBack();
                  return;
                }
                navigateTo("Home");
              }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                backgroundColor: colors.surface,
                borderRadius: 18,
                marginRight: SPACING.sm
              }}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
          {showAvatar && (
            <TouchableOpacity
              onPress={onAvatarPress}
              disabled={!onAvatarPress}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACING.sm,
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.text }}>
                  {avatarFallback || ""}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
            {title}
          </Text>
        </View>

        {showAction ? (
          <TouchableOpacity
            onPress={onActionPress}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              backgroundColor: colors.accent,
              borderRadius: 18,
            }}
          >
            <Ionicons name={actionIcon as any} size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}
      </View>
    </>
  );
}
