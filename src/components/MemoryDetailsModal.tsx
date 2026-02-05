import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ScrollView } from 'react-native';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@src/theme';
import { useTheme } from '@src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '@src/components/UI';

interface MemoryDetailsModalProps {
  visible: boolean;
  mediaUri: string;
  mediaType: 'photo' | 'video';
  onClose: () => void;
  onSave: (data: { title: string; note?: string }) => void;
}

export default function MemoryDetailsModal({
  visible,
  mediaUri,
  mediaType,
  onClose,
  onSave,
}: MemoryDetailsModalProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      // Title is required
      return;
    }
    onSave({
      title: title.trim(),
      note: note.trim() || undefined,
    });
    // Reset form
    setTitle('');
    setNote('');
  };

  const handlePostWithoutNote = () => {
    if (!title.trim()) {
      return;
    }
    onSave({
      title: title.trim(),
      note: undefined,
    });
    setTitle('');
    setNote('');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
      }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            paddingTop: SPACING.lg,
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.xl,
            maxHeight: '90%',
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: SPACING.lg,
          }}>
            <Text style={{
              ...TYPOGRAPHY.xl,
              fontWeight: '700',
              color: colors.text,
            }}>
              Add Memory Details
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Media Preview */}
            <View style={{
              width: '100%',
              height: 200,
              borderRadius: RADIUS.lg,
              overflow: 'hidden',
              backgroundColor: colors.bgSecondary,
              marginBottom: SPACING.lg,
            }}>
              {mediaType === 'photo' ? (
                <Image
                  source={{ uri: mediaUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="videocam" size={48} color={colors.textMuted} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.sm }}>
                    Video
                  </Text>
                </View>
              )}
            </View>

            {/* Title Input (Required) */}
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{
                ...TYPOGRAPHY.sm,
                fontWeight: '600',
                color: colors.text,
                marginBottom: SPACING.xs,
              }}>
                Title <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Add a title..."
                style={{
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            {/* Note Input (Optional) */}
            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={{
                ...TYPOGRAPHY.sm,
                fontWeight: '600',
                color: colors.text,
                marginBottom: SPACING.xs,
              }}>
                Note (Optional)
              </Text>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: colors.surface,
                  minHeight: 80,
                }}
              />
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', marginBottom: SPACING.md }}>
              <TouchableOpacity
                onPress={handlePostWithoutNote}
                disabled={!title.trim()}
                style={{
                  flex: 1,
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.surface,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  alignItems: 'center',
                  marginRight: SPACING.sm,
                  opacity: !title.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{
                  ...TYPOGRAPHY.base,
                  fontWeight: '600',
                  color: colors.text,
                }}>
                  Post Without Note
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!title.trim()}
                style={{
                  flex: 1,
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  backgroundColor: colors.accent,
                  borderRadius: RADIUS.lg,
                  alignItems: 'center',
                  marginLeft: SPACING.sm,
                  opacity: !title.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{
                  ...TYPOGRAPHY.base,
                  fontWeight: '600',
                  color: colors.bg,
                }}>
                  Post with Note
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}



