import React, { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { SPACING } from "@src/theme";
import { Input, Button, SectionTitle } from "@src/components/UI";
import { useNavigation } from "@src/contexts/NavigationContext";

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    Alert.alert("Thank you!", "We appreciate your feedback.");
    setMessage("");
  };

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
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}>
        <SectionTitle title="Send Feedback" subtitle="Share ideas, bugs, or feature requests" />
        <Input
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us how we can improve..."
          multiline
          numberOfLines={8}
          style={{ minHeight: 160, textAlignVertical: "top", marginBottom: SPACING.lg }}
        />
        <Button title="Send" onPress={handleSubmit} disabled={!message.trim()} />
      </ScrollView>
    </View>
  );
}


