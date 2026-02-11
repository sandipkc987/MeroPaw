import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, Modal, TextInput, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { fetchPetProfileExtras, upsertPetProfileExtras, uploadProfilePhoto, fetchWellnessInputs } from "@src/services/supabaseData";
import { Button, Card, Input } from "@src/components/UI";
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, fontWeight: "600" }}>Wellness Score</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: SPACING.xs }}>
              <Text style={{ ...TYPOGRAPHY["3xl"], color: colors.text, fontWeight: "800" }}>{wellnessScore}</Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: SPACING.xs }}>/100</Text>
            </View>
          </View>
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

        <View style={{ marginTop: SPACING.md, height: 6, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.pill, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${Math.min(100, wellnessScore)}%`, backgroundColor: colors.accent }} />
        </View>

        <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }}>
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

// About Section - row style list
const AboutPetSection = ({
  petName, breed, birthDate, color, microchip, allergies, favoriteActivity
}: {
  petName: string;
  breed: string;
  birthDate: string;
  color?: string;
  microchip?: string;
  allergies?: string;
  favoriteActivity?: string;
}) => {
  const { colors } = useTheme();
  const DetailRow = ({ iconName, label, value, isLast = false }: { iconName: string; label: string; value: string; isLast?: boolean }) => (
    <View style={{
      flexDirection: "row",
      paddingVertical: SPACING.md,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.borderLight,
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        marginRight: SPACING.md,
      }}>
        <Ionicons name={iconName as any} size={20} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, fontWeight: "500", marginBottom: 2 }}>
          {label}
        </Text>
        <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
          {value}
        </Text>
      </View>
    </View>
  );

  const details = [
    { iconName: "paw", label: "Breed", value: breed },
    { iconName: "calendar", label: "Birth Date", value: birthDate },
    { iconName: "color-palette", label: "Color", value: color },
    { iconName: "card", label: "Microchip", value: microchip },
    ...(favoriteActivity ? [{ iconName: "walk", label: "Favorite Activity", value: favoriteActivity }] : []),
    ...(allergies ? [{ iconName: "warning", label: "Allergies", value: allergies }] : []),
  ].filter((d): d is { iconName: string; label: string; value: string } =>
    !!d.value && String(d.value).trim().length > 0
  );

  return (
    <Card elevated style={{ marginHorizontal: SPACING.lg, marginTop: SPACING.lg, padding: 0, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm }}>
        <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
          About {petName || "your pet"}
        </Text>
      </View>

      <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}>
        {details.map((detail, index) => (
          <DetailRow
            key={detail.label}
            iconName={detail.iconName}
            label={detail.label}
            value={detail.value}
            isLast={index === details.length - 1}
          />
        ))}
      </View>
    </Card>
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


const PhotosVideosSection = () => {
  const { colors } = useTheme();
  const { memories } = useMemories();
  
  // Get all highlight images in chronological order (first come first present)
  const allHighlightImages = useMemo(() => {
    return memories
      .filter(m => !m.isArchived && m.type === 'photo') // Only photos for now
      .sort((a, b) => a.uploadedAt - b.uploadedAt) // Oldest first (chronological)
      .map(memory => ({
        id: memory.id,
        type: memory.type,
        src: memory.src,
        caption: memory.title || memory.note || '',
        timeAgo: formatTimeAgo(memory.uploadedAt),
        uploadedAt: memory.uploadedAt
      }));
  }, [memories]);

  const favoritePosts = allHighlightImages;

  if (favoritePosts.length === 0) {
    return (
      <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
          <Ionicons name="images" size={20} color={colors.text} style={{ marginRight: SPACING.sm }} />
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Memories</Text>
        </View>
        <Card style={{ alignItems: "center", paddingVertical: SPACING.xl }}>
          <Ionicons name="images-outline" size={36} color={colors.textMuted} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.sm }}>
            No memories yet
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
        <Ionicons name="images" size={20} color={colors.text} style={{ marginRight: SPACING.sm }} />
        <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>Memories</Text>
      </View>

      {/* Memories Grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.md }}>
        {favoritePosts.map((post) => {
          const isVideo = post.type === "video";
          return (
            <View key={post.id} style={{ width: "48%" }}>
              <View style={{
                borderRadius: RADIUS.lg,
                overflow: "hidden",
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderLight,
              }}>
                <View style={{ position: "relative" }}>
                  <Image
                    source={{ uri: post.src }}
                    style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.surface }}
                    resizeMode="cover"
                  />
                  {isVideo && (
                    <View style={{
                      position: "absolute",
                      right: 8,
                      top: 8,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Ionicons name="play" size={12} color={colors.white} />
                    </View>
                  )}
                  <View style={{
                    position: "absolute",
                    left: 8,
                    bottom: 8,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.white }}>
                      {post.timeAgo || "now"}
                    </Text>
                  </View>
                </View>
              </View>
              {post.caption ? (
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }} numberOfLines={2}>
                  {post.caption}
                </Text>
              ) : null}
            </View>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md }}
        >
          <TouchableOpacity
            onPress={onAddPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: SPACING.sm,
              paddingHorizontal: SPACING.lg,
              backgroundColor: colors.bgSecondary,
              borderRadius: RADIUS.pill,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
          >
            <Ionicons name="add-circle" size={20} color={colors.accent} style={{ marginRight: SPACING.sm }} />
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>
              Add Achievement
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
        allowsEditing: true,
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
        allowsEditing: true,
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
  const [showEditPetInfo, setShowEditPetInfo] = useState(false);
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
          const [extras, wellnessInputs] = await Promise.all([
            fetchPetProfileExtras(user.id, activePetId),
            fetchWellnessInputs(user.id, activePetId).catch(() => null),
          ]);
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
  const profile = useMemo(() => ({
    name: activePet?.name || profileData.petName || "Your pet",
    breed: activePet?.breed || profileData.breed || "",
    birthDate: activePet?.birthDate || profileData.birthDate || "",
    color: activePet?.color || profileData.color || "",
    microchip: activePet?.microchip || profileData.microchip || "",
    allergies: activePet?.allergies || profileData.allergies || "",
    bio: activePet?.bio || profileData.bio || "",
    avatarUrl: profileData.avatarUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600",
    coverUrl: profileData.coverUrl || "https://images.unsplash.com/photo-1507149833265-60c372daea22?w=1600"
  }), [
    activePet?.name,
    activePet?.bio,
    activePet?.breed,
    activePet?.birthDate,
    activePet?.color,
    activePet?.microchip,
    activePet?.allergies,
    profileData.petName,
    profileData.breed,
    profileData.birthDate,
    profileData.color,
    profileData.microchip,
    profileData.allergies,
    profileData.bio,
    profileData.avatarUrl,
    profileData.coverUrl
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
        allowsEditing: true,
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
        allowsEditing: true,
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screen Header with Back Button and Hamburger Menu */}
      <ScreenHeader
        title="Profile"
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
      />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Profile Header */}
        <View style={profileHeaderStyle}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={handleAvatarPress}
              activeOpacity={0.9}
              style={avatarContainerStyle}
            >
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: avatarRadius,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  borderWidth: 2,
                  borderColor: colors.borderLight,
                }}
              >
                <Image
                  source={{ uri: profile.avatarUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600" }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                  fadeDuration={100}
                  progressiveRenderingEnabled={true}
                />
              </View>
              <View
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -8,
                  width: cameraSize,
                  height: cameraSize,
                  borderRadius: cameraRadius,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: colors.borderLight,
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }}
              >
                <Ionicons name="camera" size={15} color={colors.text} />
              </View>
            </TouchableOpacity>
            <View style={{ marginLeft: SPACING.lg, flex: 1 }}>
              <Text style={nameTextStyle}>{profile.name}</Text>
              <Text style={sublineTextStyle}>
                {profile.bio?.trim()
                  ? profile.bio
                  : profile.birthDate
                    ? `Born ${profile.birthDate}`
                    : "Add a short bio"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: SPACING.sm,
                  marginTop: SPACING.sm,
                }}
              >
                <InfoChip icon="calendar-outline" label={joinedLabel} />
              </View>
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                <TouchableOpacity
                  onPress={() => setShowEditBio(true)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, fontWeight: "600" }}>
                    Edit bio
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowEditPetInfo(true)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, fontWeight: "600" }}>
                    Edit details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Navigation Bar */}
        <View
          style={{
            paddingHorizontal: SPACING.lg,
            marginTop: SPACING.lg,
            paddingBottom: SPACING.sm,
          }}
        >
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.borderLight,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderLight,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACING.lg, paddingHorizontal: SPACING.xs, paddingRight: SPACING.lg }}
            >
              {(['About', 'Personality', 'Wellness', 'Achievements'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.8}
                    style={{
                      alignItems: "center",
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.xs,
                      borderBottomWidth: isActive ? 2 : 0,
                      borderBottomColor: isActive ? colors.accent : "transparent",
                      marginBottom: -1,
                    }}
                  >
                    {isActive && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          backgroundColor: colors.accent,
                          borderRadius: 999,
                        }}
                      />
                    )}
                    <Text
                      style={{
                        ...TYPOGRAPHY.sm,
                        color: isActive ? colors.text : colors.textMuted,
                        fontWeight: isActive ? "700" : "600",
                      }}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
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
              <Card elevated style={{ padding: SPACING.lg }}>
                <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                  Complete {profile.name}'s personality
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
                  Choose 3–5 traits to describe their personality.
                </Text>
                <Button
                  title="Add Personality"
                  onPress={() => setShowPersonalityEditor(true)}
                  style={{ marginTop: SPACING.lg }}
                />
              </Card>
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
              <Card elevated style={{ padding: SPACING.lg }}>
                <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                  Add wellness stats
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
                  Track mood, activity, and vaccine status to see a wellness score.
                </Text>
                <Button
                  title="Add Wellness"
                  onPress={() => setShowWellnessEditor(true)}
                  style={{ marginTop: SPACING.lg }}
                />
              </Card>
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
              <Card elevated style={{ padding: SPACING.lg }}>
                <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                  Add your first achievement
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
                  Celebrate milestones like grooming streaks and vet visits.
                </Text>
                <Button
                  title="Add Achievement"
                  onPress={() => setShowAddAchievementModal(true)}
                  style={{ marginTop: SPACING.lg }}
                />
              </Card>
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

      <EditPetInfoModal
        visible={showEditPetInfo}
        onClose={() => setShowEditPetInfo(false)}
        currentInfo={{
          breed: profile.breed,
          birthDate: profile.birthDate,
          color: profile.color,
          microchip: profile.microchip,
          allergies: profile.allergies,
        }}
        onSave={handleSavePetInfo}
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