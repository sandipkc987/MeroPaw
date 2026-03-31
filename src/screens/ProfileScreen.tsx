import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, Modal, TextInput, Alert, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { fetchPetProfileExtras, upsertPetProfileExtras, uploadProfilePhoto, fetchWellnessInputs, fetchWeightHistory } from "@src/services/supabaseData";
import { Button, Card, Chip, Input } from "@src/components/UI";
import { useAuth } from "@src/contexts/AuthContext";
import { useProfile } from "@src/contexts/ProfileContext";
import { usePets } from "@src/contexts/PetContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from "@react-native-async-storage/async-storage";

type PersonalityCategory = "Temperament" | "Sociability" | "Play Style" | "Cognitive";

interface PersonalityTraitDefinition {
  key: string;
  label: string;
  emoji: string;
  category: PersonalityCategory;
}

const PERSONALITY_TRAIT_DEFINITIONS: PersonalityTraitDefinition[] = [
  { key: "Calm", label: "Calm", emoji: "🌿", category: "Temperament" },
  { key: "Energetic", label: "Energetic", emoji: "⚡️", category: "Temperament" },
  { key: "Gentle", label: "Gentle", emoji: "💗", category: "Temperament" },
  { key: "Alert", label: "Alert", emoji: "🚨", category: "Temperament" },
  { key: "Independent", label: "Independent", emoji: "💪", category: "Temperament" },
  { key: "Easygoing", label: "Easygoing", emoji: "🙂", category: "Temperament" },
  { key: "Friendly", label: "Friendly", emoji: "🫶", category: "Sociability" },
  { key: "Confident", label: "Confident", emoji: "🎯", category: "Sociability" },
  { key: "Shy", label: "Shy", emoji: "🙈", category: "Sociability" },
  { key: "Protective", label: "Protective", emoji: "🛡️", category: "Sociability" },
  { key: "Playful", label: "Playful", emoji: "🎾", category: "Play Style" },
  { key: "Curious", label: "Curious", emoji: "🔍", category: "Play Style" },
  { key: "Adventurous", label: "Adventurous", emoji: "⛰️", category: "Play Style" },
  { key: "Intelligent", label: "Intelligent", emoji: "🧠", category: "Cognitive" },
  { key: "Adaptable", label: "Adaptable", emoji: "🔄", category: "Cognitive" },
  { key: "Focused", label: "Focused", emoji: "🎯", category: "Cognitive" },
  { key: "Stubborn", label: "Stubborn", emoji: "🐮", category: "Cognitive" },
];

const PERSONALITY_TRAIT_MAP = PERSONALITY_TRAIT_DEFINITIONS.reduce<Record<string, PersonalityTraitDefinition>>((acc, trait) => {
  acc[trait.key] = trait;
  return acc;
}, {});

const PERSONALITY_TRAITS_BY_CATEGORY = PERSONALITY_TRAIT_DEFINITIONS.reduce<Record<PersonalityCategory, PersonalityTraitDefinition[]>>((acc, trait) => {
  if (!acc[trait.category]) {
    acc[trait.category] = [];
  }
  acc[trait.category].push(trait);
  return acc;
}, {
  Temperament: [],
  Sociability: [],
  "Play Style": [],
  Cognitive: [],
});

interface PersonalityTraitSelection {
  key: string;
  intensity: number;
}


const clampValue = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const makePersonalitySummary = (petName: string, traits: PersonalityTraitSelection[]) => {
  if (!traits.length) {
    return `${petName} is developing their unique personality.`;
  }
  const sorted = [...traits]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5)
    .map((trait) => trait.key.toLowerCase());

  if (sorted.includes("calm") && sorted.includes("friendly")) {
    return `${petName} is calm and friendly, loves gentle company and peaceful walks.`;
  }
  if (sorted.includes("energetic") && sorted.includes("playful")) {
    return `${petName} is energetic and playful, always ready for games and adventures.`;
  }
  if (sorted.includes("curious") && sorted.includes("intelligent")) {
    return `${petName} is curious and intelligent, quick to learn new tricks.`;
  }

  const description = sorted
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(", ");

  return `${petName} is ${description}.`;
};

interface InfoChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const InfoChip = ({ icon, label }: InfoChipProps) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: colors.cardSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={14} color={colors.accent} />
      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{label}</Text>
    </View>
  );
};

interface ProfileActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  variant?: "primary" | "ghost";
  onPress: () => void;
}

const ProfileActionButton = ({ icon, label, variant = "primary", onPress }: ProfileActionButtonProps) => {
  const { colors } = useTheme();
  const isPrimary = variant === "primary";
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.lg,
        backgroundColor: isPrimary ? colors.accent : colors.surface,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
        ...SHADOWS.sm,
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isPrimary ? colors.white : colors.accent}
      />
      <Text
        style={{
          ...TYPOGRAPHY.base,
          fontWeight: "700",
          color: isPrimary ? colors.white : colors.accent,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// Edit Bio Modal Component
const EditBioModal = ({ visible, onClose, currentBio, onSave, petName }: {
  visible: boolean;
  onClose: () => void;
  currentBio: string;
  onSave: (bio: string) => void;
  petName: string;
}) => {
  const { colors } = useTheme();
  const [bio, setBio] = useState(currentBio);

  const handleSave = () => {
    onSave(bio);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card, 
          borderTopLeftRadius: RADIUS.xl, 
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
            <TouchableOpacity onPress={onClose} style={{ marginRight: SPACING.md }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", flex: 1 }}>Edit Bio</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.accent }}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <Input
            value={bio}
            onChangeText={setBio}
            placeholder={`Tell us about ${petName || "your pet"}...`}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
        </View>
      </View>
    </Modal>
  );
};

// Edit Pet Info Modal Component
const EditPetInfoModal = ({ visible, onClose, currentInfo, onSave }: {
  visible: boolean;
  onClose: () => void;
  currentInfo: any;
  onSave: (info: any) => void;
}) => {
  const { colors } = useTheme();
  const [info, setInfo] = useState(currentInfo);

  useEffect(() => {
    if (visible && currentInfo) {
      setInfo({
        breed: currentInfo.breed ?? "",
        birthDate: currentInfo.birthDate ?? "",
        color: currentInfo.color ?? "",
        microchip: currentInfo.microchip ?? "",
        allergies: currentInfo.allergies ?? "",
        gender: currentInfo.gender ?? "",
        isServiceAnimal: currentInfo.isServiceAnimal,
      });
    }
  }, [visible, currentInfo]);

  const handleSave = () => {
    onSave(info);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card, 
          borderTopLeftRadius: RADIUS.xl, 
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "80%"
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
            <TouchableOpacity onPress={onClose} style={{ marginRight: SPACING.md }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", flex: 1 }}>Edit Pet Info</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.accent }}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: SPACING.md }}>
              <Input
                label="Breed"
                value={info.breed}
                onChangeText={(text) => setInfo({...info, breed: text})}
                placeholder="Enter breed"
              />
              <Input
                label="Birth Date"
                value={info.birthDate}
                onChangeText={(text) => setInfo({...info, birthDate: text})}
                placeholder="e.g., March 15, 2021"
              />
              <Input
                label="Color"
                value={info.color}
                onChangeText={(text) => setInfo({...info, color: text})}
                placeholder="e.g., Golden"
              />
              <Input
                label="Microchip ID"
                value={info.microchip}
                onChangeText={(text) => setInfo({...info, microchip: text})}
                placeholder="Enter microchip ID"
              />
              <Input
                label="Allergies"
                value={info.allergies}
                onChangeText={(text) => setInfo({...info, allergies: text})}
                placeholder="e.g., None, Chicken, etc."
              />
              <Input
                label="Gender"
                value={info.gender}
                onChangeText={(text) => setInfo({...info, gender: text})}
                placeholder="e.g., Male, Female"
              />
              <View style={{ marginTop: SPACING.sm }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.xs }}>Service animal</Text>
                <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                  <TouchableOpacity
                    onPress={() => setInfo({...info, isServiceAnimal: true})}
                    style={{
                      flex: 1,
                      paddingVertical: SPACING.md,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: info.isServiceAnimal === true ? colors.accent : colors.border,
                      backgroundColor: info.isServiceAnimal === true ? colors.accent + "18" : colors.cardSecondary,
                    }}
                  >
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: info.isServiceAnimal === true ? colors.accent : colors.text, textAlign: "center" }}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setInfo({...info, isServiceAnimal: false})}
                    style={{
                      flex: 1,
                      paddingVertical: SPACING.md,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: info.isServiceAnimal === false ? colors.accent : colors.border,
                      backgroundColor: info.isServiceAnimal === false ? colors.accent + "18" : colors.cardSecondary,
                    }}
                  >
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: info.isServiceAnimal === false ? colors.accent : colors.text, textAlign: "center" }}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Personality Section Component
const PersonalitySection = ({
  petName,
  traits,
  favoriteActivity,
  summary,
  onEdit
}: {
  petName: string;
  traits: PersonalityTraitSelection[];
  favoriteActivity: string;
  summary?: string;
  onEdit: () => void;
}) => {
  const { colors } = useTheme();
  const sortedTraits = [...traits].sort((a, b) => b.intensity - a.intensity).slice(0, 4);
  const fallbackSummary = makePersonalitySummary(petName, traits);
  const displaySummary = summary && summary.trim().length > 0 ? summary : fallbackSummary;

  return (
    <Card elevated style={{ padding: SPACING.lg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Ionicons name="sparkles" size={20} color={colors.accent} style={{ marginRight: SPACING.sm }} />
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Personality</Text>
        </View>
        <TouchableOpacity
          onPress={onEdit}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.accentVeryLight,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name="create" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {sortedTraits.map((trait) => {
        const definition = PERSONALITY_TRAIT_MAP[trait.key];
        if (!definition) return null;
        return (
          <View key={trait.key} style={{ marginBottom: SPACING.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xs }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                {definition.emoji} {definition.label}
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.accent }}>{clampValue(trait.intensity)}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: RADIUS.pill, backgroundColor: colors.bgSecondary, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  width: `${clampValue(trait.intensity)}%`,
                  backgroundColor: colors.accent,
                  borderRadius: RADIUS.pill
                }}
              />
            </View>
          </View>
        );
      })}

      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.sm, lineHeight: 20 }}>
        {displaySummary}
      </Text>
    </Card>
  );
};

// Personality Editor Modal
const PersonalityEditorModal = ({
  visible,
  onClose,
  selections,
  favoriteActivity,
  summary,
  petName,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  selections: PersonalityTraitSelection[];
  favoriteActivity: string;
  summary: string;
  petName: string;
  onSave: (traits: PersonalityTraitSelection[], activity: string, summary: string) => void;
}) => {
  const { colors } = useTheme();
  const [localTraits, setLocalTraits] = useState<PersonalityTraitSelection[]>(selections);
  const [activity, setActivity] = useState(favoriteActivity);
  const [summaryText, setSummaryText] = useState(summary);

  const toggleTrait = (key: string) => {
    setLocalTraits((prev) => {
      const exists = prev.find((item) => item.key === key);
      if (exists) {
        if (prev.length <= 3) {
          Alert.alert("Personality", "Choose at least three traits.");
          return prev;
        }
        return prev.filter((item) => item.key !== key);
      }
      if (prev.length >= 5) {
        Alert.alert("Personality", "You can highlight up to five traits.");
        return prev;
      }
      return [...prev, { key, intensity: 60 }];
    });
  };

  const adjustIntensity = (key: string, delta: number) => {
    setLocalTraits((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, intensity: clampValue(item.intensity + delta) }
          : item
      )
    );
  };

  useEffect(() => {
    if (visible) {
      setLocalTraits(selections);
      setActivity(favoriteActivity);
      setSummaryText(summary);
    }
  }, [visible, selections, favoriteActivity, summary]);

  const handleSave = () => {
    if (localTraits.length < 3) {
      Alert.alert("Personality", "Choose at least three traits.");
      return;
    }
    const sortedTraits = [...localTraits].sort((a, b) => b.intensity - a.intensity);
    const trimmedActivity = activity.trim();
    const trimmedSummary = summaryText.trim();
    const finalSummary = trimmedSummary.length > 0
      ? trimmedSummary
      : makePersonalitySummary(petName, sortedTraits);

    onSave(sortedTraits, trimmedActivity, finalSummary);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end"}}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%"
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Edit Personality</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
              Select Traits (3–5)
            </Text>
            <View style={{ marginTop: SPACING.sm }}>
              {Object.entries(PERSONALITY_TRAITS_BY_CATEGORY).map(([category, traits]) => (
                <View key={category} style={{ marginBottom: SPACING.sm }}>
                  <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.textMuted, marginBottom: SPACING.xs }}>
                    {category}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
                    {traits.map((trait) => {
                      const active = !!localTraits.find((item) => item.key === trait.key);
                      return (
                        <TouchableOpacity
                          key={trait.key}
                          onPress={() => toggleTrait(trait.key)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: SPACING.sm,
                            paddingHorizontal: SPACING.sm,
                            borderRadius: RADIUS.pill,
                            borderWidth: 1,
                            borderColor: active ? colors.accent : colors.borderLight,
                            backgroundColor: active ? colors.accentVeryLight : colors.bgSecondary,
                          }}
                        >
                          <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: active ? colors.accent : colors.text }}>
                            {trait.emoji} {trait.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            <View style={{ padding: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: colors.bgSecondary }}>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>
                Intensities
              </Text>
              {localTraits.length === 0 && (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  Select traits to adjust their intensity levels.
                </Text>
              )}
              {localTraits.map((trait) => {
                const definition = PERSONALITY_TRAIT_MAP[trait.key];
                return (
                  <View key={trait.key} style={{ marginBottom: SPACING.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                        {definition ? `${definition.emoji} ${definition.label}` : trait.key}
                      </Text>
                      <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.accent }}>
                        {clampValue(trait.intensity)}%
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.xs }}>
                      <TouchableOpacity
                        onPress={() => adjustIntensity(trait.key, -5)}
                        style={{ padding: SPACING.xs, marginRight: SPACING.sm }}
                      >
                        <Ionicons name="remove-circle" size={22} color={colors.accent} />
                      </TouchableOpacity>
                      <View style={{ flex: 1, height: 6, borderRadius: RADIUS.pill, backgroundColor: colors.borderLight }}>
                        <View
                          style={{
                            height: "100%",
                            width: `${clampValue(trait.intensity)}%`,
                            backgroundColor: colors.accent,
                            borderRadius: RADIUS.pill
                          }}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => adjustIntensity(trait.key, 5)}
                        style={{ padding: SPACING.xs, marginLeft: SPACING.sm }}
                      >
                        <Ionicons name="add-circle" size={22} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: SPACING.sm }}>
              <Input
                label="Favorite Activity"
                value={activity}
                onChangeText={setActivity}
                placeholder="e.g., Trail hikes, agility course"
              />
            </View>

            <View style={{ marginTop: SPACING.sm }}>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, marginBottom: SPACING.xs }}>
                Summary Description
              </Text>
              <Input
                value={summaryText}
                onChangeText={setSummaryText}
                placeholder={makePersonalitySummary(petName, localTraits)}
                multiline
                numberOfLines={3}
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />
              <TouchableOpacity
                onPress={() => setSummaryText(makePersonalitySummary(petName, localTraits))}
                style={{ marginTop: SPACING.xs, alignSelf: "flex-start", paddingVertical: SPACING.xs }}
              >
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "600" }}>
                  Use suggested summary
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

type WellnessMetrics = {
  weight: string;
  activity: string;
  vaccine: string;
  allergies: string;
};

const WellnessMetricDialog = ({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: colors.black + "66", justifyContent: "center", alignItems: "center", padding: SPACING.lg }}>
        <Card style={{ width: "100%", padding: SPACING.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md }}>
            <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: SPACING.xs }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
            {options.map((option) => {
              const active = option === value;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => onSelect(option)}
                  style={{
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.borderLight,
                    backgroundColor: active ? colors.accentVeryLight : colors.bgSecondary,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: active ? colors.accent : colors.text }}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const WellnessSection = ({
  mood,
  metrics,
  onSelectMood,
  onEdit,
  scoreOverride,
}: {
  mood: string;
  metrics: WellnessMetrics;
  onSelectMood: (key: string) => void;
  onEdit: () => void;
  scoreOverride?: number | null;
}) => {
  const { colors } = useTheme();
  const moodData = WELLNESS_MOOD_OPTIONS.find((option) => option.key === mood) || WELLNESS_MOOD_OPTIONS[0];
  const wellnessScore = Number.isFinite(scoreOverride ?? NaN)
    ? Math.round(Number(scoreOverride))
    : computeWellnessScore(metrics);

  const MetricCard = ({ title, value, icon }: { title: string; value: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <Card
      style={{
        flex: 1,
        padding: SPACING.md,
        borderRadius: RADIUS.xl,
        borderColor: colors.borderLight,
        backgroundColor: colors.cardSecondary,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.xs }}>
        <Ionicons name={icon} size={16} color={colors.accent} style={{ marginRight: SPACING.xs }} />
        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{title}</Text>
      </View>
      <Text style={{ ...TYPOGRAPHY.xl, color: colors.text, fontWeight: "700" }}>{value}</Text>
    </Card>
  );

  return (
    <View>
      <Card
        style={{
          padding: SPACING.lg,
          borderRadius: RADIUS.xl,
          backgroundColor: colors.card,
          borderColor: colors.borderLight,
          ...SHADOWS.md
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm }}>
          <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "700" }}>Wellness</Text>
          <TouchableOpacity
            onPress={onEdit}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="create" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <MetricCard title="Weight" value={metrics.weight} icon="barbell-outline" />
          <MetricCard title="Activity" value={metrics.activity} icon="walk-outline" />
        </View>
        <View style={{ marginTop: SPACING.md }}>
          <MetricCard title="Vaccine Status" value={metrics.vaccine} icon="medkit-outline" />
        </View>

        <View style={{ marginTop: SPACING.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: SPACING.sm,
              paddingHorizontal: SPACING.md,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}>
              <Ionicons
                name="warning-outline"
                size={16}
                color={metrics.allergies && metrics.allergies !== "None" ? colors.danger : colors.textMuted}
                style={{ marginRight: SPACING.xs }}
              />
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                {metrics.allergies && metrics.allergies !== "None" ? metrics.allergies : "No allergies"}
              </Text>
            </View>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: SPACING.sm,
              paddingHorizontal: SPACING.md,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}>
              <Text style={{ fontSize: 18, marginRight: SPACING.xs }} role="img" aria-label={moodData.label}>
                {moodData.emoji}
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                {moodData.label}
              </Text>
            </View>
          </ScrollView>
        </View>

        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.md }}>
          Tip: use the edit button to adjust wellness stats.
        </Text>
      </Card>
    </View>
  );
};

const WellnessEditorModal = ({
  visible,
  mood,
  metrics,
  onClose,
  onSave,
}: {
  visible: boolean;
  mood: string;
  metrics: WellnessMetrics;
  onClose: () => void;
  onSave: (mood: string, metrics: WellnessMetrics) => void;
}) => {
  const { colors } = useTheme();
  const [localMood, setLocalMood] = useState(mood);
  const [localMetrics, setLocalMetrics] = useState<WellnessMetrics>(metrics);

  useEffect(() => {
    if (visible) {
      setLocalMood(mood || "");
      setLocalMetrics(metrics);
    }
  }, [visible, mood, metrics]);

  const handleSave = () => {
    if (!localMood || !localMetrics.weight || !localMetrics.activity || !localMetrics.vaccine) {
      Alert.alert("Wellness", "Please complete mood, weight, activity, and vaccine status.");
      return;
    }
    onSave(localMood, localMetrics);
  };

  const renderOptionRow = (title: string, options: string[], selected: string, onSelect: (value: string) => void) => (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onSelect(option)}
              style={{
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
                borderRadius: RADIUS.pill,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.borderLight,
                backgroundColor: active ? colors.accentVeryLight : colors.bgSecondary,
              }}
            >
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: active ? colors.accent : colors.text }}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "66", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "85%",
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Edit Wellness</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: SPACING.xs }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>Mood</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md }}>
              {WELLNESS_MOOD_OPTIONS.map((option) => {
                const active = option.key === localMood;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setLocalMood(option.key)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADIUS.pill,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.borderLight,
                      backgroundColor: active ? colors.accentVeryLight : colors.bgSecondary,
                    }}
                  >
                    <Text style={{ fontSize: 18, marginRight: SPACING.xs }}>{option.emoji}</Text>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: active ? colors.accent : colors.text }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {renderOptionRow("Weight", WELLNESS_METRIC_OPTIONS.weight, localMetrics.weight, (value) => setLocalMetrics(prev => ({ ...prev, weight: value })))}
            {renderOptionRow("Activity", WELLNESS_METRIC_OPTIONS.activity, localMetrics.activity, (value) => setLocalMetrics(prev => ({ ...prev, activity: value })))}
            {renderOptionRow("Vaccine Status", WELLNESS_METRIC_OPTIONS.vaccine, localMetrics.vaccine, (value) => setLocalMetrics(prev => ({ ...prev, vaccine: value })))}
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// About Section – grid of chips
const AboutPetSection = ({
  petName, breed, birthDate, color, microchip, allergies, favoriteActivity, weight, neutered, gender, serviceAnimal
}: {
  petName: string;
  breed: string;
  birthDate: string;
  color?: string;
  microchip?: string;
  allergies?: string;
  favoriteActivity?: string;
  weight?: string;
  neutered?: string;
  gender?: string;
  serviceAnimal?: string;
}) => {
  const { colors } = useTheme();
  const items = [
    { icon: "paw" as const, label: "Breed", value: breed },
    ...(gender && gender.trim() ? [{ icon: "male-female" as const, label: "Gender", value: gender.trim() }] : []),
    { icon: "calendar" as const, label: "Birth date", value: birthDate },
    { icon: "color-palette" as const, label: "Color", value: color },
    ...(weight && weight.trim() ? [{ icon: "barbell" as const, label: "Weight", value: weight.trim() }] : []),
    ...(neutered && neutered.trim() ? [{ icon: "medical" as const, label: "Neutered", value: neutered.trim() }] : []),
    ...(serviceAnimal && serviceAnimal.trim() ? [{ icon: "ribbon" as const, label: "Service animal", value: serviceAnimal.trim() }] : []),
    { icon: "card" as const, label: "Microchip", value: microchip },
    ...(favoriteActivity ? [{ icon: "walk" as const, label: "Activity", value: favoriteActivity }] : []),
    { icon: "warning" as const, label: "Allergies", value: allergies || "None" },
  ].filter((d) => !!d.value && String(d.value).trim().length > 0);

  return (
    <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600", marginBottom: SPACING.md }}>
        About {petName || "your pet"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              minWidth: "47%",
              flex: 1,
              paddingVertical: SPACING.sm,
              paddingHorizontal: SPACING.md,
              borderRadius: RADIUS.lg,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent + "18",
              alignItems: "center",
              justifyContent: "center",
              marginRight: SPACING.sm,
            }}>
              <Ionicons name={item.icon} size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>{item.label}</Text>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }} numberOfLines={1}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Helper function to format time ago
const formatTimeAgo = (timestamp: number): string => {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return "now";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
};

const formatJoinedDate = (timestamp?: number): string => {
  if (!timestamp || Number.isNaN(timestamp)) {
    return "Joined recently";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Joined recently";
  }
  const formatted = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `Joined ${formatted}`;
};

const formatAge = (birthDate?: string): string | null => {
  if (!birthDate || !birthDate.trim()) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 0) return null;
  if (months < 12) return months <= 1 ? "1 month old" : `${months} months old`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year old" : `${years} years old`;
};

const PhotosVideosSection = () => {
  const { colors } = useTheme();
  const { memories } = useMemories();
  const { navigateTo } = useNavigation();
  const screenWidth = Dimensions.get('window').width;
  const gridPadding = SPACING.lg;
  const gridGap = 3;
  const numColumns = 3;
  const itemSize = (screenWidth - (gridPadding * 2) - (gridGap * (numColumns - 1))) / numColumns;
  
  const allPhotos = useMemo(() => {
    return memories
      .filter(m => !m.isArchived)
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, 9);
  }, [memories]);

  if (allPhotos.length === 0) {
    return (
      <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: colors.accent + "15",
              alignItems: "center",
              justifyContent: "center",
              marginRight: SPACING.sm,
            }}>
              <Ionicons name="grid" size={16} color={colors.accent} />
            </View>
            <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>Memories</Text>
          </View>
        </View>
        <View style={{
          backgroundColor: colors.card,
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.borderLight,
        }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.accent + "12",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING.md,
          }}>
            <Ionicons name="camera-outline" size={28} color={colors.accent} />
          </View>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center" }}>
            Capture moments with your pet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: colors.accent + "15",
            alignItems: "center",
            justifyContent: "center",
            marginRight: SPACING.sm,
          }}>
            <Ionicons name="grid" size={16} color={colors.accent} />
          </View>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>Memories</Text>
          <View style={{
            marginLeft: SPACING.sm,
            backgroundColor: colors.bgSecondary,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: RADIUS.pill,
          }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>
              {memories.filter(m => !m.isArchived).length}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigateTo("Memories")}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>See all</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {allPhotos.map((photo, index) => {
          const isVideo = photo.type === "video";
          const isFavorite = photo.isFavorite;
          const isLastInRow = (index + 1) % numColumns === 0;
          const isLastRow = index >= allPhotos.length - (allPhotos.length % numColumns || numColumns);
          
          return (
            <TouchableOpacity
              key={photo.id}
              activeOpacity={0.9}
              onPress={() => navigateTo("Memories")}
              style={{
                width: itemSize,
                height: itemSize,
                marginRight: isLastInRow ? 0 : gridGap,
                marginBottom: isLastRow ? 0 : gridGap,
                borderRadius: RADIUS.md,
                overflow: "hidden",
              }}
            >
              <Image
                source={{ uri: photo.src }}
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: colors.bgSecondary,
                }}
                resizeMode="cover"
              />
                {isVideo && (
                  <View style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                )}
                {isFavorite && (
                  <View style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "rgba(255,59,48,0.9)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons name="heart" size={12} color="#fff" />
                  </View>
                )}
                {index === allPhotos.length - 1 && memories.filter(m => !m.isArchived).length > 9 && (
                  <View style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                      +{memories.filter(m => !m.isArchived).length - 9}
                    </Text>
                  </View>
                )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getAchievementIconColor = (iconName: string, accentColor: string): string => {
  const colors: Record<string, string> = {
    medical: "#f59e0b",
    cut: "#10b981",
    restaurant: "#3b82f6",
    star: accentColor,
    paw: "#ef4444",
  };
  return colors[iconName] || accentColor;
};

type WellnessMetricKey = "weight" | "activity" | "vaccine";

const WELLNESS_MOOD_OPTIONS = [
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "calm", label: "Calm", emoji: "😌" },
  { key: "playful", label: "Playful", emoji: "🐶" },
  { key: "tired", label: "Tired", emoji: "😴" },
  { key: "excited", label: "Excited", emoji: "🤩" },
  { key: "curious", label: "Curious", emoji: "🧐" },
  { key: "anxious", label: "Anxious", emoji: "😟" },
  { key: "relaxed", label: "Relaxed", emoji: "🫶" },
] as const;

const WELLNESS_METRIC_OPTIONS: Record<WellnessMetricKey, string[]> = {
  weight: ["Decreasing", "Stable", "Increasing"],
  activity: ["Low", "Moderate", "High"],
  vaccine: ["Updated", "Scheduled", "Unknown"],
};

const computeWellnessScore = (metrics: WellnessMetrics) => {
  const weightScore = metrics.weight === "Stable" ? 35 : metrics.weight === "Increasing" ? 30 : 25;
  const activityScore = metrics.activity === "High" ? 35 : metrics.activity === "Moderate" ? 30 : 22;
  const vaccineScore = metrics.vaccine === "Updated" ? 30 : metrics.vaccine === "Scheduled" ? 24 : 16;
  return clampValue(weightScore + activityScore + vaccineScore, 0, 100);
};

const AchievementsRow = ({
  achievements,
  onAddPress,
}: {
  achievements: { label: string; iconName: string }[];
  onAddPress: () => void;
}) => {
  const { colors } = useTheme();
  const getColor = (iconName: string) => getAchievementIconColor(iconName, colors.accent);

  return (
    <Card elevated style={{ padding: SPACING.lg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Ionicons name="trophy" size={20} color={colors.warning} style={{ marginRight: SPACING.sm }} />
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Achievements</Text>
        </View>
        <View style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 16, 
          backgroundColor: colors.warningLight,
          alignItems: "center",
          justifyContent: "center"
        }}>
          <Ionicons name="star" size={16} color={colors.warning} />
        </View>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderLight,
          borderRadius: RADIUS.xl,
          overflow: "hidden",
        }}
      >
        {achievements.length === 0 ? (
          <View style={{ paddingVertical: SPACING.lg, alignItems: "center" }}>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
              No achievements yet
            </Text>
          </View>
        ) : (
          achievements.map((item, index) => {
            const color = getColor(item.iconName);
            const isLast = index === achievements.length - 1;
            return (
              <View
                key={`${item.label}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.card,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: colors.borderLight,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: color + "15",
                      marginRight: SPACING.md,
                    }}
                  >
                    <Ionicons name={item.iconName as any} size={20} color={color} />
                  </View>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                    {item.label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            );
          })
        )}

        <TouchableOpacity
          onPress={onAddPress}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, paddingLeft: SPACING.md }}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} style={{ marginRight: SPACING.xs }} />
          <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Add achievement</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const AddAchievementModal = ({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (achievement: { label: string; iconName: string }) => void;
}) => {
  const { colors } = useTheme();
  const [label, setLabel] = useState("");
  const [iconName, setIconName] = useState<string>("star");

  const iconOptions = [
    { iconName: "medical", color: getAchievementIconColor("medical", colors.accent), label: "Health" },
    { iconName: "cut", color: getAchievementIconColor("cut", colors.accent), label: "Grooming" },
    { iconName: "restaurant", color: getAchievementIconColor("restaurant", colors.accent), label: "Nutrition" },
    { iconName: "paw", color: getAchievementIconColor("paw", colors.accent), label: "Milestone" },
    { iconName: "star", color: getAchievementIconColor("star", colors.accent), label: "Custom" },
  ];

  const handleClose = () => {
    setLabel("");
    setIconName("star");
    onClose();
  };

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert("Add Achievement", "Please enter an achievement name.");
      return;
    }
    onSave({ label: label.trim(), iconName });
    setLabel("");
    setIconName("star");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Add Achievement</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View>
            <View style={{ marginBottom: SPACING.md }}>
              <Input
                label="Achievement Name"
                value={label}
                onChangeText={setLabel}
                placeholder="e.g., Completed Agility Course"
              />
            </View>

            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>
              Icon
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
              {iconOptions.map(option => {
                const isSelected = iconName === option.iconName;
                return (
                  <TouchableOpacity
                    key={option.iconName}
                    onPress={() => setIconName(option.iconName)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: isSelected ? option.color : colors.borderLight,
                      backgroundColor: isSelected ? option.color + "15" : colors.bgSecondary,
                    }}
                  >
                    <Ionicons name={option.iconName as any} size={18} color={option.color} style={{ marginRight: SPACING.xs }} />
                    <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: option.color }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={handleClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Facebook-style Photo Interaction Modal
const PhotoInteractionModal = ({ 
  visible, 
  onClose, 
  photoType, 
  currentImageUrl, 
  onImageChange 
}: {
  visible: boolean;
  onClose: () => void;
  photoType: 'cover' | 'profile';
  currentImageUrl: string; 
  onImageChange: (newUrl: string) => Promise<boolean>; 
}) => {
  const { colors } = useTheme();
  const [showFullImage, setShowFullImage] = useState(false);

  const handleViewImage = () => {
    setShowFullImage(true);
  };

  const handleChangeImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: Platform.OS !== "ios",
        aspect: photoType === 'cover' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const updated = await onImageChange(result.assets[0].uri);
        if (updated) {
        Alert.alert('Success', `${photoType === 'cover' ? 'Cover photo' : 'Profile picture'} updated successfully!`);
        onClose();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your camera');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: Platform.OS !== "ios",
        aspect: photoType === 'cover' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const updated = await onImageChange(result.assets[0].uri);
        if (updated) {
        Alert.alert('Success', `${photoType === 'cover' ? 'Cover photo' : 'Profile picture'} updated successfully!`);
        onClose();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  return (
    <>
      {/* Main Interaction Modal */}
      <Modal visible={visible && !showFullImage} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: RADIUS.xl, 
            borderTopRightRadius: RADIUS.xl,
            paddingTop: SPACING.lg,
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.xl
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
              <TouchableOpacity onPress={onClose} style={{ marginRight: SPACING.md }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", flex: 1 }}>
                {photoType === 'cover' ? 'Cover Photo' : 'Profile Picture'}
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View style={{ gap: SPACING.md }}>
              <TouchableOpacity
                onPress={handleViewImage}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.surface,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}
              >
                <Ionicons name="eye" size={24} color={colors.textMuted} style={{ marginRight: SPACING.md }} />
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                  View Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChangeImage}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.surface,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}
              >
                <Ionicons name="images" size={24} color={colors.textMuted} style={{ marginRight: SPACING.md }} />
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                  Choose from Library
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleTakePhoto}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.surface,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}
              >
                <Ionicons name="camera" size={24} color={colors.textMuted} style={{ marginRight: SPACING.md }} />
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                  Take Photo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Image View Modal */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={{ 
          flex: 1, 
          backgroundColor: colors.black + "E6", 
          justifyContent: "center", 
          alignItems: "center" 
        }}>
          <TouchableOpacity 
            style={{ position: "absolute", top: 50, right: 20, zIndex: 1 }}
            onPress={() => setShowFullImage(false)}
          >
            <Ionicons name="close" size={30} color={colors.white} />
          </TouchableOpacity>
          
          <Image
            source={{ uri: currentImageUrl }}
            style={{ 
              width: "90%", 
              height: photoType === 'cover' ? "50%" : "60%",
              borderRadius: RADIUS.lg
            }}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </>
  );
};

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile: profileData, updateProfile } = useProfile();
  const { activePetId, getActivePet, updatePet } = usePets();
  const activePet = useMemo(() => getActivePet(), [getActivePet, activePetId]);
  
  const [wellnessMood, setWellnessMood] = useState<string>("");
  const [wellnessMetrics, setWellnessMetrics] = useState<WellnessMetrics>({
    weight: "",
    activity: "",
    vaccine: "",
    allergies: "",
  });
  const [showWellnessEditor, setShowWellnessEditor] = useState(false);
  const [healthWellnessScore, setHealthWellnessScore] = useState<number | null>(null);
  const [showEditBio, setShowEditBio] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoModalType, setPhotoModalType] = useState<'cover' | 'profile'>('profile');
  const [showPhotoOptionsModal, setShowPhotoOptionsModal] = useState(false);
  const [photoOptionsType, setPhotoOptionsType] = useState<'cover' | 'profile'>('profile');
  const [photoTarget, setPhotoTarget] = useState<'avatar' | 'cover' | null>(null);
  const photoTargetRef = useRef<'avatar' | 'cover' | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    photoTargetRef.current = photoTarget;
  }, [photoTarget]);
  const [activeTab, setActiveTab] = useState<'About' | 'Personality' | 'Wellness' | 'Achievements'>('About');
  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTraitSelection[]>([]);
  const [favoriteActivity, setFavoriteActivity] = useState("");
  const [personalitySummary, setPersonalitySummary] = useState<string>("");
  const [showPersonalityEditor, setShowPersonalityEditor] = useState(false);
  const [achievements, setAchievements] = useState<{ label: string; iconName: string }[]>([]);
  const [showAddAchievementModal, setShowAddAchievementModal] = useState(false);
  const [weightTrend, setWeightTrend] = useState<"Stable" | "Up" | "Down">("Stable");
  const [activityPerDay, setActivityPerDay] = useState<"Low" | "Moderate" | "High">("Moderate");
  const [nextVaccine, setNextVaccine] = useState<"Updated" | "Scheduled" | "Unknown">("Updated");
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showVaccineDialog, setShowVaccineDialog] = useState(false);
  const [latestWeightFromHealth, setLatestWeightFromHealth] = useState<string>("");

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Storage keys for pet-specific data
  const getStorageKey = (key: string) => activePetId ? `@kasper_pet_${activePetId}_${key}` : '';

  // Load pet-specific profile data when pet changes
  useEffect(() => {
    if (!activePetId) return;

    setIsInitialLoad(true);
    const loadPetProfileData = async () => {
      try {
        const resetPersonality = () => {
          setPersonalityTraits([]);
          setFavoriteActivity("");
          setPersonalitySummary("");
        };
        const resetWellness = () => {
          setWellnessMood("");
          setWellnessMetrics({
            weight: "",
            activity: "",
            vaccine: "",
            allergies: "",
          });
        };
        const resetAchievements = () => setAchievements([]);

        if (user?.id) {
          const [extras, wellnessInputs, weightHistory] = await Promise.all([
            fetchPetProfileExtras(user.id, activePetId),
            fetchWellnessInputs(user.id, activePetId).catch(() => null),
            fetchWeightHistory(user.id, activePetId).catch(() => []),
          ]);
          const latestEntry = Array.isArray(weightHistory) && weightHistory.length > 0 ? weightHistory[0] : null;
          if (latestEntry && Number.isFinite(latestEntry.weight)) {
            setLatestWeightFromHealth(`${latestEntry.weight} lb`);
          } else {
            setLatestWeightFromHealth("");
          }
          if (extras?.personality) {
            setPersonalityTraits(extras.personality.traits || []);
            setFavoriteActivity(extras.personality.favoriteActivity || "");
            setPersonalitySummary(extras.personality.summary || "");
          } else {
            resetPersonality();
          }

          if (extras?.wellness) {
            setWellnessMood(extras.wellness.mood || "");
            setWellnessMetrics({
              weight: extras.wellness.metrics?.weight || "",
              activity: extras.wellness.metrics?.activity || "",
              vaccine: extras.wellness.metrics?.vaccine || "",
              allergies: extras.wellness.metrics?.allergies || "",
            });
          } else {
            resetWellness();
          }

          if (extras?.achievements) {
            setAchievements(extras.achievements || []);
          } else {
            resetAchievements();
          }
          setHealthWellnessScore(
            typeof wellnessInputs?.score === "number" ? wellnessInputs.score : null
          );
          return;
        }

        // Local fallback (non-authed users)
        const personalityData = await AsyncStorage.getItem(getStorageKey('personality'));
        if (personalityData) {
          const parsed = JSON.parse(personalityData);
          setPersonalityTraits(parsed.traits || []);
          setFavoriteActivity(parsed.favoriteActivity || "");
          setPersonalitySummary(parsed.summary || "");
        } else {
          resetPersonality();
        }

        const wellnessData = await AsyncStorage.getItem(getStorageKey('wellness'));
        if (wellnessData) {
          const parsed = JSON.parse(wellnessData);
          setWellnessMood(parsed.mood || "");
          setWellnessMetrics(parsed.metrics || {
            weight: "",
            activity: "",
            vaccine: "",
            allergies: "",
          });
        } else {
          resetWellness();
        }

        const achievementsData = await AsyncStorage.getItem(getStorageKey('achievements'));
        if (achievementsData) {
          const parsed = JSON.parse(achievementsData);
          setAchievements(parsed.length > 0 ? parsed : []);
        } else {
          resetAchievements();
        }
        setHealthWellnessScore(null);
        setLatestWeightFromHealth("");
      } catch (error) {
        console.error("Failed to load pet profile data:", error);
      } finally {
        setIsInitialLoad(false);
      }
    };

    loadPetProfileData();
  }, [activePetId, user?.id]);

  // Persist profile extras (skip initial load)
  useEffect(() => {
    if (!activePetId || isInitialLoad) return;

    const payload = {
      personality: personalityTraits.length
        ? { traits: personalityTraits, favoriteActivity, summary: personalitySummary }
        : undefined,
      wellness: wellnessMood || wellnessMetrics.weight || wellnessMetrics.activity || wellnessMetrics.vaccine
        ? { mood: wellnessMood, metrics: wellnessMetrics }
        : undefined,
      achievements: achievements.length ? achievements : undefined,
    };

    if (user?.id) {
      upsertPetProfileExtras(user.id, activePetId, payload).catch((error) => {
        console.error("Failed to save profile extras:", error);
      });
      return;
    }

    const saveLocal = async () => {
      try {
        await AsyncStorage.setItem(getStorageKey('personality'), JSON.stringify({
          traits: personalityTraits,
          favoriteActivity,
          summary: personalitySummary,
        }));
        await AsyncStorage.setItem(getStorageKey('wellness'), JSON.stringify({
          mood: wellnessMood,
          metrics: wellnessMetrics,
        }));
        await AsyncStorage.setItem(getStorageKey('achievements'), JSON.stringify(achievements));
      } catch (error) {
        console.error("Failed to save local profile extras:", error);
      }
    };

    saveLocal();
  }, [
    personalityTraits,
    favoriteActivity,
    personalitySummary,
    wellnessMood,
    wellnessMetrics,
    achievements,
    activePetId,
    isInitialLoad,
    user?.id,
  ]);


  // Merge profile data with local state for compatibility - memoized to prevent unnecessary re-renders
  const profile = useMemo(() => {
    const isNeutered = activePet?.isNeutered ?? profileData.isNeutered;
    const neuteredDisplay = isNeutered === true ? "Neutered" : isNeutered === false ? "Not neutered" : "";
    const isServiceAnimal = activePet?.isServiceAnimal ?? profileData.isServiceAnimal;
    const serviceAnimalDisplay = isServiceAnimal === true ? "Yes" : isServiceAnimal === false ? "No" : "";
    return {
      name: activePet?.name || profileData.petName || "Your pet",
      breed: activePet?.breed || profileData.breed || "",
      birthDate: activePet?.birthDate || profileData.birthDate || "",
      color: activePet?.color || profileData.color || "",
      microchip: activePet?.microchip || profileData.microchip || "",
      allergies: activePet?.allergies || profileData.allergies || "",
      weight: latestWeightFromHealth || activePet?.weight || profileData.weight || "",
      neutered: neuteredDisplay,
      gender: activePet?.gender || profileData.gender || "",
      serviceAnimal: serviceAnimalDisplay,
      bio: activePet?.bio || profileData.bio || "",
      avatarUrl: profileData.avatarUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600",
      coverUrl: profileData.coverUrl || "https://images.unsplash.com/photo-1507149833265-60c372daea22?w=1600"
    };
  }, [
    activePet?.name,
    activePet?.bio,
    activePet?.breed,
    activePet?.birthDate,
    activePet?.color,
    activePet?.microchip,
    activePet?.allergies,
    activePet?.weight,
    activePet?.isNeutered,
    activePet?.gender,
    activePet?.isServiceAnimal,
    profileData.petName,
    profileData.breed,
    profileData.birthDate,
    profileData.color,
    profileData.microchip,
    profileData.allergies,
    profileData.weight,
    profileData.isNeutered,
    profileData.gender,
    profileData.isServiceAnimal,
    profileData.bio,
    profileData.avatarUrl,
    profileData.coverUrl,
    latestWeightFromHealth,
  ]);

  const handleSaveBio = async (newBio: string) => {
    await updateProfile({ bio: newBio });
    Alert.alert("Success", "Bio updated successfully!");
  };

  const handleSavePetInfo = async (newInfo: any) => {
    await updateProfile({
      breed: newInfo.breed,
      birthDate: newInfo.birthDate,
      color: newInfo.color,
      microchip: newInfo.microchip,
      allergies: newInfo.allergies,
      gender: newInfo.gender,
      isServiceAnimal: newInfo.isServiceAnimal,
    });
    Alert.alert("Success", "Pet information updated successfully!");
  };

  const isRemoteUrl = useCallback((uri?: string) => {
    return !!uri && /^https?:\/\//i.test(uri);
  }, []);

  const saveProfilePhoto = useCallback(async (
    uri: string,
    target: "avatar" | "cover"
  ): Promise<boolean> => {
    if (!uri) return false;

    let uploadedUrl = uri;
    if (!isRemoteUrl(uri)) {
      if (!user?.id) {
        Alert.alert("Sign in required", "Please sign in to upload photos.");
        return false;
      }
      const petId = activePet?.id || activePetId || "general";
      try {
        const { url } = await uploadProfilePhoto(user.id, petId, uri, target);
        uploadedUrl = url;
      } catch (error) {
        console.error("ProfileScreen: Failed to upload profile photo", error);
        Alert.alert("Error", "Failed to upload photo. Please try again.");
        return false;
      }
    }

    if (target === "cover") {
      await updateProfile({ coverUrl: uploadedUrl });
    } else {
      await updateProfile({ avatarUrl: uploadedUrl });
    }

    if (activePet && updatePet) {
      const existingAvatar =
        profileData.avatarUrl && isRemoteUrl(profileData.avatarUrl) ? profileData.avatarUrl : undefined;
      const existingCover =
        profileData.coverUrl && isRemoteUrl(profileData.coverUrl) ? profileData.coverUrl : undefined;
      const nextAvatar = target === "avatar" ? uploadedUrl : existingAvatar;
      const nextCover = target === "cover" ? uploadedUrl : existingCover;
      const remaining = (activePet.photos || [])
        .filter(photo => isRemoteUrl(photo))
        .filter(photo => photo !== nextAvatar && photo !== nextCover);
      const primaryPhotos = [nextAvatar, nextCover].filter((photo): photo is string => !!photo);
      const newPhotos = primaryPhotos.concat(remaining).slice(0, 10);
      await updatePet(activePet.id, { photos: newPhotos });
    }

    return true;
  }, [
    activePet,
    activePetId,
    isRemoteUrl,
    profileData.avatarUrl,
    profileData.coverUrl,
    updateProfile,
    updatePet,
    user?.id
  ]);

  const handleImageChange = useCallback(async (newUrl: string, type: 'cover' | 'profile') => {
    const target = type === "cover" ? "cover" : "avatar";
    return saveProfilePhoto(newUrl, target);
  }, [saveProfilePhoto]);

  const handlePhotoInteraction = useCallback((type: 'cover' | 'profile') => {
    setPhotoOptionsType(type);
    setShowPhotoOptionsModal(true);
  }, []);

  // Memoized handler for avatar photo selection
  const handleAvatarPress = useCallback(() => {
    const target = 'avatar';
    setPhotoTarget(target);
    photoTargetRef.current = target;
    setPhotoOptionsType('profile');
    setShowPhotoOptionsModal(true);
  }, []);

  // Memoized handler for cover photo selection
  const handleCoverPress = useCallback(() => {
    const target = 'cover';
    setPhotoTarget(target);
    photoTargetRef.current = target;
    setPhotoOptionsType('cover');
    setShowPhotoOptionsModal(true);
  }, []);

  // Memoized styles for profile section
  const avatarSize = 88;
  const avatarRadius = avatarSize / 2;
  const cameraSize = 28;
  const cameraRadius = cameraSize / 2;
  const profileHeaderStyle = useMemo(() => ({
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...SHADOWS.sm,
  }), [colors.card, colors.borderLight]);

  const avatarContainerStyle = useMemo(() => ({
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarRadius,
    overflow: "visible" as const,
    backgroundColor: "transparent",
    ...SHADOWS.sm
  }), [avatarRadius, avatarSize]);

  const nameTextStyle = useMemo(() => ({
    ...TYPOGRAPHY["2xl"],
    fontWeight: "800" as const,
    color: colors.text,
  }), [colors.text]);

  const sublineTextStyle = useMemo(() => ({
    ...TYPOGRAPHY.sm,
    color: colors.textSecondary,
    marginTop: 4,
  }), [colors.textSecondary]);

  const handleImagePicked = useCallback(async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      const currentTarget = photoTargetRef.current;
      const target = currentTarget === "cover" ? "cover" : "avatar";
      const updated = await saveProfilePhoto(uri, target);
      if (updated) {
        Alert.alert(
          "Success",
          target === "cover" ? "Cover photo updated successfully!" : "Profile picture updated successfully!"
        );
      }
    }
    setShowPhotoOptionsModal(false);
    setPhotoTarget(null);
  }, [saveProfilePhoto]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to take photos.');
        return;
      }

      const targetType = photoTargetRef.current || 'avatar';
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: Platform.OS !== "ios",
        aspect: targetType === 'cover' ? [16, 9] : [1, 1],
        quality: 0.6, // Reduced from 0.8 to 0.6 for better performance
      });

      await handleImagePicked(result);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setShowPhotoOptionsModal(false);
      setPhotoTarget(null);
      photoTargetRef.current = null;
    }
  }, [handleImagePicked]);

  const handleChooseFromGallery = useCallback(async () => {
    try {
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaStatus !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access to change pictures.');
        return;
      }

      const targetType = photoTargetRef.current || 'avatar';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: Platform.OS !== "ios",
        aspect: targetType === 'cover' ? [16, 9] : [1, 1],
        quality: 0.6, // Reduced from 0.8 to 0.6 for better performance
        allowsMultipleSelection: false,
      });

      await handleImagePicked(result);
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      Alert.alert('Error', 'Failed to update image. Please try again.');
      setShowPhotoOptionsModal(false);
      setPhotoTarget(null);
      photoTargetRef.current = null;
    }
  }, [handleImagePicked]);

  const handleModalImageChange = useCallback(async (newUrl: string) => {
    return handleImageChange(newUrl, photoModalType);
  }, [handleImageChange, photoModalType]);

  // Memoize expensive calculations
  const autoPersonalitySummary = useMemo(() => 
    makePersonalitySummary(profile.name, personalityTraits),
    [profile.name, personalityTraits]
  );
  
  const displayPersonalitySummary = useMemo(() => 
    personalitySummary.trim().length > 0 ? personalitySummary : autoPersonalitySummary,
    [personalitySummary, autoPersonalitySummary]
  );
  const microchipLabel = profile.microchip ? `Chip 7 ${profile.microchip.slice(-4)}` : "Microchip TBD";
  const joinedLabel = useMemo(
    () => formatJoinedDate(activePet?.createdAt),
    [activePet?.createdAt]
  );
  const hasPersonalityData = personalityTraits.length >= 3;
  const hasWellnessData = !!(
    wellnessMood &&
    wellnessMetrics.weight &&
    wellnessMetrics.activity &&
    wellnessMetrics.vaccine
  );
  const hasAchievements = achievements.length > 0;

  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;
  const handleProfileScroll = useCallback((event: any) => {
    const y = event.nativeEvent?.contentOffset?.y ?? 0;
    if (y <= 0) {
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
    lastScrollYRef.current = y;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Profile"
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.sm}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        bounces
        onScroll={handleProfileScroll}
        scrollEventThrottle={0}
      >
        {/* Cover + avatar hero – full-width cover, avatar overlapping, centered profile below */}
        <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.md }}>
          <TouchableOpacity activeOpacity={1} onPress={handleCoverPress} style={{ width: "100%" }}>
            <View style={{ width: "100%", aspectRatio: 2.2, backgroundColor: colors.surface }}>
              <Image
                source={{ uri: profile.coverUrl || "https://images.unsplash.com/photo-1507149833265-60c372daea22?w=1600" }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%" }}>
                <LinearGradient
                  colors={["transparent", colors.bg]}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ paddingHorizontal: SPACING.lg, alignItems: "center", marginTop: -avatarRadius - 8 }}>
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.9}
                style={{
                  width: avatarSize + 8,
                  height: avatarSize + 8,
                  borderRadius: (avatarSize + 8) / 2,
                  padding: 4,
                  backgroundColor: colors.bg,
                  ...SHADOWS.md,
                }}
              >
                <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarRadius, overflow: "hidden", backgroundColor: colors.surface }}>
                  <Image
                    source={{ uri: profile.avatarUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600" }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
              </TouchableOpacity>
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="camera" size={16} color={colors.white} />
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap", marginTop: SPACING.md, gap: 4 }}>
              <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "800", color: colors.text }} numberOfLines={1}>
                {profile.name}
              </Text>
              {formatAge(profile.birthDate) && (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "500" }}>
                  · {formatAge(profile.birthDate)}
                </Text>
              )}
            </View>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 4, textAlign: "center" }} numberOfLines={2}>
              {profile.bio?.trim() || (profile.birthDate ? `Born ${profile.birthDate}` : "Add a short bio")}
            </Text>
            <View style={{ marginTop: SPACING.sm }}>
              <InfoChip icon="calendar-outline" label={joinedLabel} />
            </View>
          </View>
        </View>

        {/* Tabs - same style as Health History filter chips */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: SPACING.lg }}>
            {(["About", "Personality", "Wellness", "Achievements"] as const).map((tab, index) => (
              <Chip
                key={tab}
                label={tab}
                selected={activeTab === tab}
                onPress={() => setActiveTab(tab)}
                style={{ marginRight: index < 3 ? SPACING.sm : 0 }}
              />
            ))}
          </ScrollView>
        </View>

        {/* Tab Content - Only render active tab for better performance */}
        {activeTab === 'About' && (
          <>
            <AboutPetSection 
              petName={profile.name}
              breed={profile.breed} 
              birthDate={profile.birthDate} 
              color={profile.color} 
              microchip={profile.microchip} 
              allergies={profile.allergies}
              favoriteActivity={favoriteActivity}
              weight={profile.weight}
              neutered={profile.neutered}
              gender={profile.gender}
              serviceAnimal={profile.serviceAnimal}
            />
            {/* Photos & Videos Section (Favorites from Memories) - Facebook-style */}
            <PhotosVideosSection />
          </>
        )}

        {activeTab === 'Personality' && (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
            {hasPersonalityData ? (
              <PersonalitySection
                petName={profile.name}
                traits={personalityTraits}
                favoriteActivity={favoriteActivity}
                summary={displayPersonalitySummary}
                onEdit={() => setShowPersonalityEditor(true)}
              />
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowPersonalityEditor(true)}
              >
                <Card elevated style={{ padding: SPACING.lg, flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentVeryLight, alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                    <Ionicons name="sparkles" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                      Add personality
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      Choose 3–5 traits for {profile.name}
                    </Text>
                  </View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Add</Text>
                </Card>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'Wellness' && (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
            {hasWellnessData ? (
              <WellnessSection
                mood={wellnessMood}
                metrics={wellnessMetrics}
                onSelectMood={setWellnessMood}
                onEdit={() => setShowWellnessEditor(true)}
                scoreOverride={healthWellnessScore}
              />
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowWellnessEditor(true)}
              >
                <Card elevated style={{ padding: SPACING.lg, flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentVeryLight, alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                    <Ionicons name="fitness" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                      Add wellness
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      Mood, activity, vaccine status
                    </Text>
                  </View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Add</Text>
                </Card>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'Achievements' && (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}>
            {hasAchievements ? (
              <AchievementsRow
                achievements={achievements}
                onAddPress={() => setShowAddAchievementModal(true)}
              />
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowAddAchievementModal(true)}
              >
                <Card elevated style={{ padding: SPACING.lg, flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentVeryLight, alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                    <Ionicons name="trophy" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                      Add achievements
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      Milestones, grooming, vet visits
                    </Text>
                  </View>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Add</Text>
                </Card>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Modals */}
      <EditBioModal
        visible={showEditBio}
        onClose={() => setShowEditBio(false)}
        currentBio={profile.bio}
        petName={profile.name}
        onSave={handleSaveBio}
      />

      <PhotoInteractionModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        photoType={photoModalType}
        currentImageUrl={photoModalType === 'cover' ? profile.coverUrl : profile.avatarUrl}
        onImageChange={handleModalImageChange}
      />

      <AddAchievementModal
        visible={showAddAchievementModal}
        onClose={() => setShowAddAchievementModal(false)}
        onSave={(achievement) => setAchievements(prev => [...prev, achievement])}
      />

      <WellnessEditorModal
        visible={showWellnessEditor}
        mood={wellnessMood}
        metrics={wellnessMetrics}
        onClose={() => setShowWellnessEditor(false)}
        onSave={(updatedMood, updatedMetrics) => {
          setWellnessMood(updatedMood);
          setWellnessMetrics(updatedMetrics);
          setShowWellnessEditor(false);
        }}
      />

      <PersonalityEditorModal
        visible={showPersonalityEditor}
        onClose={() => setShowPersonalityEditor(false)}
        selections={personalityTraits}
        favoriteActivity={favoriteActivity}
        summary={displayPersonalitySummary}
        petName={profile.name}
        onSave={(updatedTraits, updatedActivity, updatedSummary) => {
          setPersonalityTraits(updatedTraits);
          setFavoriteActivity(updatedActivity);
          const newAutoSummary = makePersonalitySummary(profile.name, updatedTraits);
          const trimmedSummary = updatedSummary.trim();
          setPersonalitySummary(trimmedSummary === newAutoSummary ? "" : trimmedSummary);
          setShowPersonalityEditor(false);
          Alert.alert("Success", "Personality updated successfully.");
        }}
      />

      {/* Photo Options Modal - Facebook Style */}
      <Modal
        visible={showPhotoOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPhotoOptionsModal(false);
          setPhotoTarget(null);
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          activeOpacity={1}
          onPress={() => {
            setShowPhotoOptionsModal(false);
            setPhotoTarget(null);
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: RADIUS.xl,
              padding: SPACING.lg,
              width: "85%",
              maxWidth: 400,
              ...SHADOWS.xl,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text style={{
              ...TYPOGRAPHY.lg,
              fontWeight: "700",
              color: colors.text,
              marginBottom: SPACING.lg,
              textAlign: "center",
            }}>
              {photoTarget === 'cover' ? 'Change Cover Photo' : 'Change Profile Picture'}
            </Text>

            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                borderRadius: RADIUS.md,
                backgroundColor: colors.surface,
                marginBottom: SPACING.sm,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accentVeryLight,
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACING.md,
              }}>
                <Ionicons name="camera" size={20} color={colors.accent} />
              </View>
              <Text style={{
                ...TYPOGRAPHY.base,
                fontWeight: "600",
                color: colors.text,
                flex: 1,
              }}>
                Take Photo
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleChooseFromGallery}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                borderRadius: RADIUS.md,
                backgroundColor: colors.surface,
                marginBottom: SPACING.lg,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accentVeryLight,
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACING.md,
              }}>
                <Ionicons name="images" size={20} color={colors.accent} />
              </View>
              <Text style={{
                ...TYPOGRAPHY.base,
                fontWeight: "600",
                color: colors.text,
                flex: 1,
              }}>
                Choose from Gallery
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowPhotoOptionsModal(false);
                setPhotoTarget(null);
              }}
              activeOpacity={0.7}
              style={{
                paddingVertical: SPACING.md,
                borderRadius: RADIUS.md,
                backgroundColor: colors.surface,
                alignItems: "center",
              }}
            >
              <Text style={{
                ...TYPOGRAPHY.base,
                fontWeight: "600",
                color: colors.text,
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}