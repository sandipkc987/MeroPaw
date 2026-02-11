import React, { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { Card, Input, Button, Divider, Row, SectionTitle } from "@src/components/UI";
import { SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { useProfile } from "@src/contexts/ProfileContext";
import { useAuth } from "@src/contexts/AuthContext";
import { useNavigation } from "@src/contexts/NavigationContext";

type EditSection =
  | "legalName"
  | "preferredName"
  | "phone"
  | "email"
  | "residentialAddress"
  | "mailingAddress"
  | "emergencyContact"
  | null;

export default function PersonalInformationScreen() {
  const { colors } = useTheme();
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const [legalFirstName, setLegalFirstName] = useState(profile.ownerLegalFirstName || "");
  const [legalLastName, setLegalLastName] = useState(profile.ownerLegalLastName || "");
  const [preferredFirstName, setPreferredFirstName] = useState(profile.ownerPreferredFirstName || "");
  const [phone, setPhone] = useState(profile.ownerPhone || "");
  const [email, setEmail] = useState(profile.ownerEmail || user?.email || "");
  const [residentialAddress, setResidentialAddress] = useState(profile.ownerResidentialAddress || "");
  const [mailingAddress, setMailingAddress] = useState(profile.ownerMailingAddress || "");
  const [emergencyContact, setEmergencyContact] = useState(profile.ownerEmergencyContact || "");
  const [editing, setEditing] = useState<EditSection>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLegalFirstName(profile.ownerLegalFirstName || "");
    setLegalLastName(profile.ownerLegalLastName || "");
    setPreferredFirstName(profile.ownerPreferredFirstName || "");
    setPhone(profile.ownerPhone || "");
    setEmail(profile.ownerEmail || user?.email || "");
    setResidentialAddress(profile.ownerResidentialAddress || "");
    setMailingAddress(profile.ownerMailingAddress || "");
    setEmergencyContact(profile.ownerEmergencyContact || "");
  }, [profile, user]);

  const legalNameDisplay = useMemo(() => {
    const full = `${legalFirstName} ${legalLastName}`.trim();
    return full || "";
  }, [legalFirstName, legalLastName]);

  const maskedPhone = useMemo(() => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    const last4 = digits.slice(-4);
    return digits.length >= 4 ? `***-***-${last4}` : `***-${last4}`;
  }, [phone]);

  const maskedEmail = useMemo(() => {
    if (!email) return "";
    const [userPart, domain] = email.split("@");
    if (!domain) return email;
    const maskedUser = userPart.length > 1 ? `${userPart[0]}***` : "***";
    return `${maskedUser}@${domain}`;
  }, [email]);

  const resetSection = (section: EditSection) => {
    if (section === "legalName") {
      setLegalFirstName(profile.ownerLegalFirstName || "");
      setLegalLastName(profile.ownerLegalLastName || "");
    }
    if (section === "preferredName") setPreferredFirstName(profile.ownerPreferredFirstName || "");
    if (section === "phone") setPhone(profile.ownerPhone || "");
    if (section === "email") setEmail(profile.ownerEmail || user?.email || "");
    if (section === "residentialAddress") setResidentialAddress(profile.ownerResidentialAddress || "");
    if (section === "mailingAddress") setMailingAddress(profile.ownerMailingAddress || "");
    if (section === "emergencyContact") setEmergencyContact(profile.ownerEmergencyContact || "");
  };

  const handleSave = async (section: EditSection) => {
    if (!section) return;
    setIsSaving(true);
    try {
      const updates =
        section === "legalName"
          ? { ownerLegalFirstName: legalFirstName, ownerLegalLastName: legalLastName }
          : section === "preferredName"
          ? { ownerPreferredFirstName: preferredFirstName }
          : section === "phone"
          ? { ownerPhone: phone }
          : section === "email"
          ? { ownerEmail: email }
          : section === "residentialAddress"
          ? { ownerResidentialAddress: residentialAddress }
          : section === "mailingAddress"
          ? { ownerMailingAddress: mailingAddress }
          : { ownerEmergencyContact: emergencyContact };
      await updateProfile(updates);
      setEditing(null);
      Alert.alert("Saved", "Personal information updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderRow = (
    section: EditSection,
    label: string,
    value: string,
    helper?: string,
    icon?: string
  ) => {
    const isEditing = editing === section;
    const actionLabel = value ? "Edit" : "Add";
    const disabled = !!editing && !isEditing;
    return (
      <Row
        icon={icon}
        label={label}
        hint={value || "Not provided"}
        control={
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                resetSection(section);
                setEditing(null);
              } else {
                setEditing(section);
              }
            }}
            disabled={disabled}
          >
            <Text
              style={[
                styles.actionText,
                { color: isEditing ? colors.text : colors.accent },
                disabled && { color: colors.textLight },
              ]}
            >
              {isEditing ? "Cancel" : actionLabel}
            </Text>
          </TouchableOpacity>
        }
        disabled={disabled}
      />
    );
  };

  const renderSection = (
    section: EditSection,
    label: string,
    value: string,
    editor: React.ReactNode,
    helper?: string,
    icon?: string
  ) => {
    const isEditing = editing === section;
    return (
      <>
        {renderRow(section, label, value, helper, icon)}
        {isEditing ? (
          <View style={styles.inlineEditor}>
            {editor}
          </View>
        ) : null}
        <Divider />
      </>
    );
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
      <ScrollView 
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle title="Personal Information" subtitle="Name, email, and contact details" />
        <Card style={{ paddingVertical: SPACING.sm }}>
          {renderSection(
            "legalName",
            "Legal name",
            legalNameDisplay,
            <>
              <Text style={[styles.editSubtitle, { color: colors.textMuted }]}>
                We'll need to verify your new legal name before your next booking.
              </Text>
              <Input
                value={legalFirstName}
                onChangeText={setLegalFirstName}
                placeholder="First name on ID"
                style={{ marginBottom: SPACING.sm }}
              />
              <Input
                value={legalLastName}
                onChangeText={setLegalLastName}
                placeholder="Last name on ID"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("legalName")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "id-card-outline"
          )}
          {renderSection(
            "preferredName",
            "Preferred first name",
            preferredFirstName,
            <>
              <Input
                value={preferredFirstName}
                onChangeText={setPreferredFirstName}
                placeholder="Preferred first name"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("preferredName")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "happy-outline"
          )}
          {renderSection(
            "phone",
            "Phone number",
            maskedPhone || phone,
            <>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                keyboardType="phone-pad"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("phone")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "call-outline"
          )}
          {renderSection(
            "email",
            "Email",
            maskedEmail || email,
            <>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("email")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "mail-outline"
          )}
          {renderSection(
            "residentialAddress",
            "Residential address",
            residentialAddress,
            <>
              <Input
                value={residentialAddress}
                onChangeText={setResidentialAddress}
                placeholder="Residential address"
                multiline
                style={{ marginBottom: SPACING.md, minHeight: 90, textAlignVertical: "top" }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("residentialAddress")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "home-outline"
          )}
          {renderSection(
            "mailingAddress",
            "Mailing address",
            mailingAddress,
            <>
              <Input
                value={mailingAddress}
                onChangeText={setMailingAddress}
                placeholder="Mailing address"
                multiline
                style={{ marginBottom: SPACING.md, minHeight: 90, textAlignVertical: "top" }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("mailingAddress")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "map-outline"
          )}
          {renderSection(
            "emergencyContact",
            "Emergency contact",
            emergencyContact,
            <>
              <Input
                value={emergencyContact}
                onChangeText={setEmergencyContact}
                placeholder="Name and phone number"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("emergencyContact")}
                disabled={isSaving}
              />
            </>,
            undefined,
            "alert-circle-outline"
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionText: {
    ...TYPOGRAPHY.sm,
    fontWeight: "600",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  editSubtitle: {
    ...TYPOGRAPHY.sm,
    marginBottom: SPACING.md,
    fontSize: 12,
  },
  inlineEditor: {
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },
});

