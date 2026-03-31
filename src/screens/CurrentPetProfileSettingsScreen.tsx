import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS, SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { LinearGradient } from "expo-linear-gradient";
import { Card, Row, Divider, Input, Button, SectionTitle } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";
import { StyleSheet } from "react-native";

let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (_) {}
}

type EditField =
  | "name"
  | "bio"
  | "birthDate"
  | "weight"
  | "breed"
  | "color"
  | "microchip"
  | "allergies"
  | "neutered"
  | "gender"
  | "serviceAnimal"
  | null;

export default function CurrentPetProfileSettingsScreen() {
  const { colors, isDark } = useTheme();
  const { getActivePet, updatePet } = usePets();
  const { goBack, canGoBack, setActiveScreen, setActiveTab } = useNavigation();
  const activePet = getActivePet();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [allergies, setAllergies] = useState("");
  const [isNeutered, setIsNeutered] = useState<boolean | undefined>(undefined);
  const [gender, setGender] = useState("");
  const [isServiceAnimal, setIsServiceAnimal] = useState<boolean | undefined>(undefined);
  const [editing, setEditing] = useState<EditField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  useEffect(() => {
    if (!activePet) return;
    setName(activePet.name || "");
    setBio(activePet.bio || "");
    setBirthDate(activePet.birthDate || "");
    setWeight(activePet.weight || "");
    setBreed(activePet.breed || "");
    setColor(activePet.color || "");
    setMicrochip(activePet.microchip || "");
    setAllergies(activePet.allergies || "");
    setIsNeutered(activePet.isNeutered);
    setGender(activePet.gender || "");
    setIsServiceAnimal(activePet.isServiceAnimal);
    if (activePet.birthDate) {
      const d = new Date(activePet.birthDate);
      if (!Number.isNaN(d.getTime())) setDatePickerValue(d);
    }
  }, [activePet?.id]);

  const neuteredDisplay =
    isNeutered === true ? "Yes" : isNeutered === false ? "No" : "";
  const neuteredValueForRow = neuteredDisplay || "Not provided";

  const serviceAnimalDisplay =
    isServiceAnimal === true ? "Yes" : isServiceAnimal === false ? "No" : "";
  const serviceAnimalValueForRow = serviceAnimalDisplay || "Not provided";

  const resetField = (field: EditField) => {
    if (!activePet) return;
    if (field === "name") setName(activePet.name || "");
    if (field === "bio") setBio(activePet.bio || "");
    if (field === "birthDate") setBirthDate(activePet.birthDate || "");
    if (field === "weight") setWeight(activePet.weight || "");
    if (field === "breed") setBreed(activePet.breed || "");
    if (field === "color") setColor(activePet.color || "");
    if (field === "microchip") setMicrochip(activePet.microchip || "");
    if (field === "allergies") setAllergies(activePet.allergies || "");
    if (field === "neutered") setIsNeutered(activePet.isNeutered);
    if (field === "gender") setGender(activePet.gender || "");
    if (field === "serviceAnimal") setIsServiceAnimal(activePet.isServiceAnimal);
  };

  const handleSave = async (field: EditField) => {
    if (!activePet || !field) return;
    if (field === "name" && !name.trim()) {
      Alert.alert("Missing name", "Please enter your pet's name.");
      return;
    }
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (field === "name") updates.name = name.trim();
      if (field === "bio") updates.bio = bio.trim() || undefined;
      if (field === "birthDate") updates.birthDate = birthDate.trim() || undefined;
      if (field === "weight") updates.weight = weight.trim() || undefined;
      if (field === "breed") updates.breed = breed.trim() || undefined;
      if (field === "color") updates.color = color.trim() || undefined;
      if (field === "microchip") updates.microchip = microchip.trim() || undefined;
      if (field === "allergies") updates.allergies = allergies.trim() || undefined;
      if (field === "neutered") updates.isNeutered = isNeutered;
      if (field === "gender") updates.gender = gender.trim() || undefined;
      if (field === "serviceAnimal") updates.isServiceAnimal = isServiceAnimal;
      await updatePet(activePet.id, updates);
      setEditing(null);
      Alert.alert("Saved", "Pet details updated.");
    } catch (e) {
      console.error("CurrentPetProfileSettings: save failed", e);
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const onDatePickerChange = (event: any, date?: Date) => {
    if (event?.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (date) {
      setDatePickerValue(date);
      setBirthDate(date.toISOString().split("T")[0]);
      if (Platform.OS === "ios") setShowDatePicker(false);
    }
  };

  const renderRow = (
    field: EditField,
    label: string,
    value: string,
    icon: string
  ) => {
    const isEditing = editing === field;
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
                resetField(field);
                setEditing(null);
              } else {
                setEditing(field);
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
    field: EditField,
    label: string,
    value: string,
    editor: React.ReactNode,
    icon: string
  ) => (
    <>
      {renderRow(field, label, value, icon)}
      {editing === field ? <View style={styles.inlineEditor}>{editor}</View> : null}
      <Divider />
    </>
  );

  if (!activePet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Pet settings" showBackButton onBackPress={() => goBack()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl }}>
          <Ionicons name="paw-outline" size={48} color={colors.textMuted} style={{ marginBottom: SPACING.md }} />
          <Text style={{ ...TYPOGRAPHY.base, color: colors.text, textAlign: "center" }}>
            No pet selected. Add or select a pet first.
          </Text>
          <Button title="Go back" onPress={() => goBack()} style={{ marginTop: SPACING.lg }} />
        </View>
      </View>
    );
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
        contentContainerStyle={{
          paddingHorizontal: SPACING.xl,
          paddingTop: SPACING.lg,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTitle
          title="Pet profile settings"
          subtitle="Bio, about, and details"
        />
        <Card style={{ paddingVertical: 0, overflow: "hidden" }} elevated>
          <LinearGradient
            colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
            style={{ height: 24 }}
          />
          <View style={{ paddingVertical: SPACING.sm }}>
          {renderSection(
            "name",
            "Name",
            name.trim(),
            <>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Pet's name"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("name")}
                disabled={isSaving}
              />
            </>,
            "paw"
          )}
          {renderSection(
            "bio",
            "Bio",
            bio.trim(),
            <>
              <Input
                value={bio}
                onChangeText={setBio}
                placeholder="A short bio or description"
                multiline
                style={{ marginBottom: SPACING.md, minHeight: 80, textAlignVertical: "top" }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("bio")}
                disabled={isSaving}
              />
            </>,
            "document-text-outline"
          )}
          {renderSection(
            "birthDate",
            "Birth date",
            birthDate.trim(),
            <>
              {DateTimePicker && (
                <>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: colors.cardSecondary,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      borderRadius: RADIUS.md,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.md,
                      marginBottom: SPACING.md,
                    }}
                  >
                    <Text style={{ ...TYPOGRAPHY.base, color: birthDate ? colors.text : colors.textMuted }}>
                      {birthDate || "Tap to open calendar"}
                    </Text>
                    <Ionicons name="calendar-outline" size={22} color={colors.accent} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={datePickerValue}
                      mode="date"
                      display={Platform.OS === "ios" ? "calendar" : "default"}
                      themeVariant={isDark ? "dark" : "light"}
                      onChange={onDatePickerChange}
                    />
                  )}
                </>
              )}
              {!DateTimePicker && (
                <Input
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="e.g. 2021-03-15"
                  style={{ marginBottom: SPACING.md }}
                  {...(Platform.OS === "web" ? { type: "date" } : {})}
                />
              )}
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("birthDate")}
                disabled={isSaving}
              />
            </>,
            "calendar-outline"
          )}
          {renderSection(
            "weight",
            "Weight",
            weight.trim(),
            <>
              <Input
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 22 lbs"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("weight")}
                disabled={isSaving}
              />
            </>,
            "barbell-outline"
          )}
          {renderSection(
            "breed",
            "Breed",
            breed.trim(),
            <>
              <Input
                value={breed}
                onChangeText={setBreed}
                placeholder="Breed"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("breed")}
                disabled={isSaving}
              />
            </>,
            "paw-outline"
          )}
          {renderSection(
            "color",
            "Coat color",
            color.trim(),
            <>
              <Input
                value={color}
                onChangeText={setColor}
                placeholder="e.g. Golden"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("color")}
                disabled={isSaving}
              />
            </>,
            "color-palette-outline"
          )}
          {renderSection(
            "microchip",
            "Microchip ID",
            microchip.trim(),
            <>
              <Input
                value={microchip}
                onChangeText={setMicrochip}
                placeholder="Microchip ID"
                keyboardType="numeric"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("microchip")}
                disabled={isSaving}
              />
            </>,
            "hardware-chip-outline"
          )}
          {renderSection(
            "allergies",
            "Allergies",
            allergies.trim(),
            <>
              <Input
                value={allergies}
                onChangeText={setAllergies}
                placeholder="e.g. None, Chicken"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("allergies")}
                disabled={isSaving}
              />
            </>,
            "warning-outline"
          )}
          {renderRow(
            "neutered",
            "Spayed / neutered",
            neuteredValueForRow,
            "medical-outline"
          )}
          {editing === "neutered" ? (
            <>
              <View style={styles.inlineEditor}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md }}>
                  {[
                    { value: true as const, label: "Yes" },
                    { value: false as const, label: "No" },
                    { value: undefined as undefined, label: "Not set" },
                  ].map(({ value, label }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => setIsNeutered(value)}
                      style={{
                        paddingVertical: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                        borderRadius: RADIUS.pill,
                        borderWidth: 1,
                        borderColor: isNeutered === value ? colors.accent : colors.borderLight,
                        backgroundColor: isNeutered === value ? colors.accent + "18" : colors.cardSecondary,
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: isNeutered === value ? colors.accent : colors.text }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Button
                  title={isSaving ? "Saving..." : "Save and continue"}
                  onPress={() => handleSave("neutered")}
                  disabled={isSaving}
                />
              </View>
              <Divider />
            </>
          ) : (
            <Divider />
          )}
          {renderSection(
            "gender",
            "Gender",
            gender.trim(),
            <>
              <Input
                value={gender}
                onChangeText={setGender}
                placeholder="e.g. Male, Female"
                style={{ marginBottom: SPACING.md }}
              />
              <Button
                title={isSaving ? "Saving..." : "Save and continue"}
                onPress={() => handleSave("gender")}
                disabled={isSaving}
              />
            </>,
            "male-female-outline"
          )}
          {renderRow(
            "serviceAnimal",
            "Service animal",
            serviceAnimalValueForRow,
            "ribbon-outline"
          )}
          {editing === "serviceAnimal" ? (
            <>
              <View style={styles.inlineEditor}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md }}>
                  {[
                    { value: true as const, label: "Yes" },
                    { value: false as const, label: "No" },
                    { value: undefined as undefined, label: "Not set" },
                  ].map(({ value, label }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => setIsServiceAnimal(value)}
                      style={{
                        paddingVertical: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                        borderRadius: RADIUS.pill,
                        borderWidth: 1,
                        borderColor: isServiceAnimal === value ? colors.accent : colors.borderLight,
                        backgroundColor: isServiceAnimal === value ? colors.accent + "18" : colors.cardSecondary,
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: isServiceAnimal === value ? colors.accent : colors.text }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Button
                  title={isSaving ? "Saving..." : "Save and continue"}
                  onPress={() => handleSave("serviceAnimal")}
                  disabled={isSaving}
                />
              </View>
              <Divider />
            </>
          ) : null}
          </View>
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
  inlineEditor: {
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },
});
