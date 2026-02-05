import React, { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { SPACING } from "@src/theme";
import { Input, Button } from "@src/components/UI";

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    Alert.alert("Thank you!", "We appreciate your feedback.");
    setMessage("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Send Feedback" />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <Text style={{ color: colors.text, marginBottom: SPACING.md, fontSize: 16 }}>
          Share ideas, bugs, or feature requests.
        </Text>
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


