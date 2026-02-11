import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { DOG_SRC } from "@src/data/seed";
import { SPACING, RADIUS, SHADOWS } from "@src/theme";
import { useNavigation } from "@src/contexts/NavigationContext";

export default function PetSwitcher() {
  const { colors } = useTheme();
  const { pets, activePetId, setActivePet, deletePet, getActivePet } = usePets();
  const { memories } = useMemories();
  const { navigateTo } = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const activePet = getActivePet();
  const getFallbackPhoto = (petId?: string | null) => {
    const candidates = memories.filter((m) => (petId ? m.petId === petId : true));
    const favorite = candidates.find((m) => m.isFavorite && m.src);
    if (favorite?.src) return favorite.src;
    const first = candidates.find((m) => m.src);
    return first?.src || DOG_SRC;
  };

  const activePetPhoto = activePet?.photos?.[0] || getFallbackPhoto(activePetId);

  const closeModal = () => {
    setModalVisible(false);
    setPendingDelete(null);
  };

  const handleSwitch = async (petId: string) => {
    await setActivePet(petId);
    closeModal();
  };

  const handleDelete = (petId: string, petName: string) => {
    // Prevent deletion if it's the only pet
    if (pets.length === 1) {
      Alert.alert(
        "Cannot Delete",
        "You must have at least one pet profile. Please add another pet before deleting this one.",
        [{ text: "OK" }]
      );
      return;
    }

    setPendingDelete({ id: petId, name: petName });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deletePet(pendingDelete.id);
    setPendingDelete(null);
  };

  const handleAddPet = () => {
    closeModal();
    navigateTo("AddPet");
  };

  return (
    <>
      {/* Active Pet Header */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: SPACING.lg,
          marginBottom: SPACING.xl,
          backgroundColor: colors.card,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...SHADOWS.sm,
        }}
      >
        <View style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          marginRight: SPACING.md,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.borderLight,
        }}>
          <Image
            source={{ uri: activePetPhoto || DOG_SRC }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ 
            color: colors.textMuted, 
            fontSize: 12,
            letterSpacing: 0.2,
            fontWeight: "600",
            marginBottom: 2
          }}>
            Current pet
          </Text>
          <Text style={{ 
            color: colors.text, 
            fontSize: 19,
            fontWeight: "700",
            letterSpacing: -0.3
          }}>
            {activePet?.name || "No Pet"}
          </Text>
          {activePet?.bio && (
            <Text style={{ 
              color: colors.textMuted, 
              fontSize: 13, 
              marginTop: 2 
            }} numberOfLines={1}>
              {activePet.bio}
            </Text>
          )}
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.cardSecondary,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.borderLight,
          }}
        >
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Modal - Bottom Sheet Style */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            activeOpacity={1}
            onPress={closeModal}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              paddingTop: SPACING.md,
              paddingBottom: SPACING.xl,
              maxHeight: "85%",
              borderWidth: 1,
              borderColor: colors.borderLight,
              ...SHADOWS.xl
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle Bar */}
            <View style={{
              width: 44,
              height: 5,
              backgroundColor: colors.borderLight,
              borderRadius: 3,
              alignSelf: "center",
              marginBottom: SPACING.lg
            }} />

            {/* Header */}
            <View style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "space-between",
              paddingHorizontal: SPACING.lg,
              marginBottom: SPACING.lg
            }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 23, fontWeight: "700", letterSpacing: -0.3 }}>
                  Switch pet profile
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  Choose the pet you want to view
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.borderLight
                }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
            >
              {pets.length === 0 ? (
                <View style={{ paddingVertical: SPACING.xl, alignItems: "center" }}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: SPACING.md
                  }}>
                    <Ionicons name="paw-outline" size={32} color={colors.textMuted} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: "center" }}>
                    No pets yet. Add your first pet!
                  </Text>
                </View>
              ) : (
                pets.map((pet) => (
                  <TouchableOpacity
                    key={pet.id}
                    onPress={() => handleSwitch(pet.id)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: SPACING.md,
                      paddingHorizontal: SPACING.md,
                      marginBottom: SPACING.sm,
                      backgroundColor: activePetId === pet.id ? colors.accent + "0A" : colors.cardSecondary,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: activePetId === pet.id ? colors.accent + "50" : colors.borderLight,
                    }}
                  >
                  <View style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: SPACING.md,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}>
                    <Image
                      source={{ uri: pet.photos?.[0] || getFallbackPhoto(pet.id) || DOG_SRC }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>
                          {pet.name}
                        </Text>
                        {activePetId === pet.id && (
                          <View style={{
                            backgroundColor: colors.accent + "18",
                            paddingHorizontal: SPACING.sm,
                            paddingVertical: 3,
                            borderRadius: RADIUS.pill,
                            borderWidth: 1,
                            borderColor: colors.accent + "40"
                          }}>
                            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>
                              Active
                            </Text>
                          </View>
                        )}
                      </View>
                      {pet.bio && (
                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                          {pet.bio}
                        </Text>
                      )}
                    </View>
                    {pets.length > 1 && (
                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation?.();
                          handleDelete(pet.id, pet.name);
                        }}
                        activeOpacity={0.7}
                        style={{ 
                          marginLeft: SPACING.sm, 
                          padding: SPACING.sm,
                          borderRadius: RADIUS.md,
                          backgroundColor: colors.danger + "10",
                          borderWidth: 1,
                          borderColor: colors.danger + "30"
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity
                onPress={handleAddPet}
                activeOpacity={0.8}
                style={{
                  marginTop: SPACING.lg,
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.lg,
                  borderRadius: RADIUS.lg,
                  backgroundColor: colors.accent,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: SPACING.sm,
                  borderWidth: 1,
                  borderColor: colors.accentDark,
                  ...SHADOWS.sm,
                }}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.white} />
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>
                  Add Pet Profile
                </Text>
              </TouchableOpacity>

              <View style={{ alignItems: "center", marginTop: SPACING.lg }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {pets.length} profile{pets.length !== 1 ? "s" : ""} available
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingDelete} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: "85%",
              backgroundColor: colors.card,
              borderRadius: RADIUS.lg,
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
              ...SHADOWS.lg,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: SPACING.xs }}>
              Delete {pendingDelete?.name}?
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: SPACING.md }}>
              This cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm }}>
              <TouchableOpacity
                onPress={() => setPendingDelete(null)}
                style={{
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.lg,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={{
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.lg,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.danger,
                }}
              >
                <Text style={{ color: colors.white, fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </>
  );
}

