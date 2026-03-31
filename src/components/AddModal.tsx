import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useMemories } from "@src/contexts/MemoriesContext";
import { usePets } from "@src/contexts/PetContext";
import { useTheme } from "@src/contexts/ThemeContext";
import { compressImage } from "@src/utils/imageCompression";
import MediaPicker from "./MediaPicker";
import MemoryDetailsModal from "./MemoryDetailsModal";

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAddReminder?: () => void;
}

export default function AddModal({ visible, onClose, onAddReminder }: AddModalProps) {
  const { colors } = useTheme();
  const { activeScreen, navigateTo, triggerAddReminder, triggerAddExpense, triggerAddHealthRecord } = useNavigation();
  const { addMemory } = useMemories();
  const { activePetId } = usePets();
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'photo' | 'video'; width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddReminder = () => {
    if (onAddReminder) {
      onAddReminder();
      return;
    }
    triggerAddReminder();
  };

  // Define options based on current screen
  const getScreenOptions = () => {
    switch (activeScreen) {
      case "Memories":
        return [
          { 
            id: "photo", 
            title: "Add Photo", 
            icon: "camera", 
            color: "#4CAF50",
            onPress: () => {
              onClose();
              setShowMediaPicker(true);
            }
          },
          { 
            id: "video", 
            title: "Add Video", 
            icon: "videocam", 
            color: "#FF9800",
            onPress: () => {
              onClose();
              setShowMediaPicker(true);
            }
          },
        ];
      case "Health":
        return [
          { 
            id: "vaccination", 
            title: "Add Vaccination", 
            icon: "medical", 
            color: "#2196F3",
            onPress: () => {
              onClose();
              triggerAddHealthRecord();
            }
          },
          { 
            id: "checkup", 
            title: "Add Checkup", 
            icon: "heart", 
            color: "#F44336",
            onPress: () => {
              onClose();
              triggerAddHealthRecord();
            }
          },
          { 
            id: "medication", 
            title: "Add Medication", 
            icon: "medical-bag", 
            color: "#4CAF50",
            onPress: () => {
              onClose();
              triggerAddHealthRecord();
            }
          }
        ];
      case "Expenses":
        return [
          { 
            id: "expense", 
            title: "Add Expense", 
            icon: "card", 
            color: "#FF9800",
            onPress: () => {
              onClose();
              triggerAddExpense();
            }
          },
          { 
            id: "receipt", 
            title: "Add Receipt", 
            icon: "receipt", 
            color: "#4CAF50",
            onPress: () => {
              onClose();
              triggerAddExpense();
            }
          }
        ];
      case "Reminders":
        return [
          { 
            id: "reminder", 
            title: "Add Reminder", 
            icon: "alarm", 
            color: "#2196F3",
            onPress: () => {
              onClose();
              handleAddReminder();
            }
          },
          { 
            id: "appointment", 
            title: "Add Appointment", 
            icon: "calendar", 
            color: "#9C27B0",
            onPress: () => {
              onClose();
              handleAddReminder();
            }
          }
        ];
      default:
        return [
          { 
            id: "memory", 
            title: "Add Memory", 
            icon: "camera", 
            color: "#4CAF50",
            onPress: () => {
              onClose();
              setShowMediaPicker(true);
            }
          },
          { 
            id: "reminder", 
            title: "Add Reminder", 
            icon: "alarm", 
            color: "#7C3AED",
            onPress: () => {
              onClose();
              navigateTo("Reminders");
              handleAddReminder();
            }
          },
          { 
            id: "expense", 
            title: "Add Expense", 
            icon: "card", 
            color: "#FF9800",
            onPress: () => {
              onClose();
              navigateTo("Expenses");
              triggerAddExpense();
            }
          },
          { 
            id: "health", 
            title: "Add Health Record", 
            icon: "medical", 
            color: "#2196F3",
            onPress: () => {
              onClose();
              navigateTo("Health");
              triggerAddHealthRecord();
            }
          }
        ];
    }
  };

  const options = getScreenOptions();

  const handleMediaSelected = async (media: { uri: string; type: 'photo' | 'video'; width: number; height: number }) => {
    setShowMediaPicker(false);
    
    // Compress image before showing details modal (videos don't need compression)
    if (media.type === 'photo') {
      setIsProcessing(true);
      try {
        const compressedUri = await compressImage(media.uri, {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.75,
        });
        setSelectedMedia({ ...media, uri: compressedUri });
      } catch (error) {
        console.error('AddModal: Failed to compress image', error);
        setSelectedMedia(media); // Use original if compression fails
      } finally {
        setIsProcessing(false);
      }
    } else {
      setSelectedMedia(media);
    }
    
    setShowDetailsModal(true);
  };

  const handleSaveMemoryDetails = async ({ title, note }: { title: string; note?: string }) => {
    if (!selectedMedia || isSaving) return;
    
    setIsSaving(true);
    try {
      await addMemory({
        type: selectedMedia.type,
        src: selectedMedia.uri,
        w: selectedMedia.width,
        h: selectedMedia.height,
        title: title,
        note: note,
      });
      
      setShowDetailsModal(false);
      setSelectedMedia(null);
      Alert.alert('Success', 'Memory added successfully!');
    } catch (error) {
      console.error('AddModal: Failed to save memory', error);
      Alert.alert('Error', 'Failed to save memory. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={onClose}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              paddingTop: SPACING.lg,
              paddingBottom: SPACING.xl + 20,
              paddingHorizontal: SPACING.lg,
              ...SHADOWS.lg,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: SPACING.lg,
            }}>
              <View>
                <Text style={{ ...TYPOGRAPHY.xl, fontWeight: "700", color: colors.text }}>
                  Quick Add
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                  What would you like to add?
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.cardSecondary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={option.onPress}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.md,
                    backgroundColor: colors.cardSecondary,
                    borderRadius: RADIUS.md,
                    marginBottom: SPACING.sm,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: SPACING.md,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    }}
                  >
                    <Ionicons name={option.icon as any} size={24} color={option.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                      {option.title}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                      Quick action
                    </Text>
                  </View>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media Picker */}
      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
      />

      {/* Memory Details Modal */}
      {selectedMedia && (
        <MemoryDetailsModal
          visible={showDetailsModal}
          mediaUri={selectedMedia.uri}
          mediaType={selectedMedia.type}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMedia(null);
          }}
          onSave={handleSaveMemoryDetails}
        />
      )}

      {/* Processing Overlay */}
      <Modal visible={isProcessing || isSaving} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            padding: SPACING.xl,
            alignItems: "center",
            ...SHADOWS.lg,
          }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ ...TYPOGRAPHY.base, color: colors.text, marginTop: SPACING.md, fontWeight: "600" }}>
              {isProcessing ? "Processing photo..." : "Saving memory..."}
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.xs }}>
              Please wait
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

