import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Card, Input, Button } from "@src/components/UI";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useProfile } from "@src/contexts/ProfileContext";
import { useAuth } from "@src/contexts/AuthContext";

export default function PersonalInformationScreen() {
  const { colors } = useTheme();
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const [name, setName] = useState(profile.ownerName || profile.petName);
  const [email, setEmail] = useState(profile.ownerEmail || user?.email || "");
  const [phone, setPhone] = useState(profile.ownerPhone || "");

  useEffect(() => {
    setName(profile.ownerName || profile.petName);
    setEmail(profile.ownerEmail || user?.email || "");
    setPhone(profile.ownerPhone || "");
  }, [profile, user]);

  const handleSave = async () => {
    await updateProfile({
      ownerName: name,
      ownerEmail: email,
      ownerPhone: phone,
    });
    Alert.alert("Saved", "Personal information updated successfully!");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Personal Information" />
      <ScrollView 
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
          />
          <View style={{ marginTop: SPACING.md }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
            />
          </View>
          <View style={{ marginTop: SPACING.md }}>
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ marginTop: SPACING.lg }}>
            <Button title="Save Changes" onPress={handleSave} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

