import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Linking } from "react-native";
import { Card, SectionTitle } from "@src/components/UI";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@src/contexts/NavigationContext";

export default function SupportScreen() {
  const { colors } = useTheme();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  function handleHelpCenter() {
    Alert.alert("Help Center", "Browse FAQs and helpful guides", [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => Linking.openURL("https://help.kasperpetify.com").catch(() => Alert.alert("Error", "Could not open help center")) },
    ]);
  }

  function handleContactSupport() {
    Alert.alert("Contact Support", "Get help from our support team", [
      { text: "Cancel", style: "cancel" },
      { text: "Email", onPress: () => Linking.openURL("mailto:support@kasperpetify.com").catch(() => Alert.alert("Error", "Could not open email")) },
      { text: "Chat", onPress: () => Alert.alert("Feature", "Live chat coming soon!") },
    ]);
  }

  function handleRateApp() {
    Alert.alert("Rate the App", "Thank you for using Meropaw!", [
      { text: "Not Now", style: "cancel" },
      { text: "Rate", onPress: () => {
        Alert.alert("Thank You", "We appreciate your feedback!");
      }},
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title=""
        variant="stacked"
        onBackPress={() => {
          if (canGoBack) {
            goBack();
            return;
          }
          setActiveScreen(null);
          setActiveTab("profile");
        }}
      />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle title="Support" subtitle="We're here to help" />
        <Card>
          <View style={styles.grid3}>
            <Pressable onPress={handleHelpCenter} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Ionicons name="help-circle-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.tileTitle, { color: colors.text }]}>Help Center</Text>
              </View>
              <Text style={[styles.cardHint, { color: colors.textMuted }]}>FAQs and quick tips</Text>
            </Pressable>
            <Pressable onPress={handleContactSupport} style={[styles.tile, { marginLeft: 8, backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.tileTitle, { color: colors.text }]}>Contact Support</Text>
              </View>
              <Text style={[styles.cardHint, { color: colors.textMuted }]}>Email or chat with us</Text>
            </Pressable>
            <Pressable onPress={handleRateApp} style={[styles.tile, { marginLeft: 8, backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Ionicons name="star-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.tileTitle, { color: colors.text }]}>Rate the App</Text>
              </View>
              <Text style={[styles.cardHint, { color: colors.textMuted }]}>Tell others about Meropaw</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid3: { flexDirection: "row" },
  tile: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12 },
  tileTitle: { fontWeight: "600" },
  cardHint: { fontSize: 12 },
});

