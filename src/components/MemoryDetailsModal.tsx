import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  Image, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, FONT_WEIGHTS } from '@src/theme';
import { useTheme } from '@src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { usePets } from '@src/contexts/PetContext';
import { getSupabaseClient } from '@src/services/supabaseClient';
import { resizeImageForCaption } from '@src/utils/imageCompression';

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
  const { activePet } = usePets();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionGenerated, setCaptionGenerated] = useState(false);
  const titleInputRef = useRef<TextInput>(null);
  const noteInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setNote('');
      setCaptionGenerated(false);
      // Don't auto-generate - let user click the button to save quota
    }
  }, [visible]);

  const generateCaption = async () => {
    // Safety checks to prevent duplicate calls and save quota
    if (!mediaUri || mediaType !== 'photo') return;
    if (isGeneratingCaption) return; // Already generating
    if (title && captionGenerated) return; // Already have a caption
    
    setIsGeneratingCaption(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.log('No session for caption generation');
        return;
      }

      // Resize to max 768px and get base64 (keeps Gemini token cost ~258 per image)
      const { base64: imageBase64, mimeType } = await resizeImageForCaption(mediaUri);

      // Call the edge function with explicit auth header
      const response = await fetch(
        'https://orjyevmxvecydcubskxf.supabase.co/functions/v1/generate-caption',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageBase64,
            mimeType,
            petName: activePet?.name,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Caption generation error:', response.status, errorText);
        return;
      }

      const data = await response.json();

      if (data?.caption) {
        setTitle(data.caption);
        setCaptionGenerated(true);
      }
    } catch (err) {
      console.error('Failed to generate caption:', err);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      note: note.trim() || undefined,
    });
    setTitle('');
    setNote('');
  };

  const hasTitle = title.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}>
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: RADIUS.xxl,
              borderTopRightRadius: RADIUS.xxl,
              maxHeight: '90%',
              ...SHADOWS.lg,
            }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: SPACING.md }}>
              <View style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: SPACING.lg,
              paddingTop: SPACING.sm,
              paddingBottom: SPACING.md,
            }}>
              <TouchableOpacity 
                onPress={onClose}
                style={{
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.md,
                  borderRadius: RADIUS.pill,
                  backgroundColor: colors.cardSecondary,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ 
                  fontSize: 14, 
                  fontFamily: FONT_WEIGHTS.medium,
                  color: colors.text,
                }}>Cancel</Text>
              </TouchableOpacity>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="images" size={18} color={colors.accent} style={{ marginRight: SPACING.xs }} />
                <Text style={{
                  fontSize: 16,
                  fontFamily: FONT_WEIGHTS.semibold,
                  color: colors.text,
                }}>
                  New Memory
                </Text>
              </View>

              <TouchableOpacity 
                onPress={handleSave}
                disabled={!hasTitle}
                style={{
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.lg,
                  borderRadius: RADIUS.pill,
                  backgroundColor: hasTitle ? colors.accent : colors.accent + '40',
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ 
                  fontSize: 14,
                  fontFamily: FONT_WEIGHTS.semibold,
                  color: colors.white,
                }}>
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Media Preview */}
              <View style={{
                marginHorizontal: SPACING.xl,
                marginBottom: SPACING.lg,
                borderRadius: RADIUS.lg,
                overflow: 'hidden',
                backgroundColor: colors.bgSecondary,
              }}>
                {mediaType === 'photo' ? (
                  <Image
                    source={{ uri: mediaUri }}
                    style={{ 
                      width: '100%', 
                      aspectRatio: 1,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{
                    width: '100%',
                    aspectRatio: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.bgSecondary,
                  }}>
                    <View style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="play" size={28} color={colors.white} />
                    </View>
                  </View>
                )}
              </View>

              {/* Input Container */}
              <View style={{ 
                marginHorizontal: SPACING.lg,
                backgroundColor: colors.card,
                borderRadius: RADIUS.xl,
                borderWidth: 1,
                borderColor: colors.borderLight,
                overflow: 'hidden',
                ...SHADOWS.sm,
              }}>
                {/* Gradient accent */}
                <LinearGradient
                  colors={[colors.accent + '15', colors.accent + '08', 'transparent']}
                  style={{ height: 3 }}
                />

                {/* Title Input */}
                <View style={{ 
                  paddingHorizontal: SPACING.lg,
                  paddingTop: SPACING.lg,
                  paddingBottom: SPACING.md,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="text" size={14} color={colors.accent} />
                      <Text style={{ 
                        fontSize: 12, 
                        fontFamily: FONT_WEIGHTS.semibold,
                        color: colors.accent,
                        marginLeft: SPACING.xs,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>Caption</Text>
                      {isGeneratingCaption && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.sm }}>
                          <ActivityIndicator size="small" color={colors.accent} />
                          <Text style={{ 
                            fontSize: 11, 
                            color: colors.textMuted, 
                            marginLeft: SPACING.xs,
                            fontFamily: FONT_WEIGHTS.regular,
                          }}>AI generating...</Text>
                        </View>
                      )}
                    </View>
                    {mediaType === 'photo' && !isGeneratingCaption && (
                      <TouchableOpacity 
                        onPress={generateCaption}
                        style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center',
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          backgroundColor: colors.accent + '15',
                          borderRadius: RADIUS.sm,
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="sparkles" size={12} color={colors.accent} />
                        <Text style={{ 
                          fontSize: 11, 
                          color: colors.accent, 
                          marginLeft: 4,
                          fontFamily: FONT_WEIGHTS.medium,
                        }}>
                          {captionGenerated ? 'Regenerate' : 'AI Generate'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    ref={titleInputRef}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      if (captionGenerated) setCaptionGenerated(false);
                    }}
                    placeholder={isGeneratingCaption ? "Generating caption..." : "Give this memory a name..."}
                    placeholderTextColor={colors.textMuted}
                    editable={!isGeneratingCaption}
                    style={{
                      fontSize: 16,
                      fontFamily: FONT_WEIGHTS.medium,
                      color: colors.text,
                      paddingVertical: SPACING.sm,
                      lineHeight: 22,
                      opacity: isGeneratingCaption ? 0.6 : 1,
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => noteInputRef.current?.focus()}
                  />
                </View>

                {/* Divider */}
                <View style={{ 
                  height: 1, 
                  backgroundColor: colors.borderLight, 
                  marginHorizontal: SPACING.lg,
                }} />

                {/* Note Input */}
                <View style={{ 
                  paddingHorizontal: SPACING.lg,
                  paddingTop: SPACING.md,
                  paddingBottom: SPACING.lg,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                    <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                    <Text style={{ 
                      fontSize: 12, 
                      fontFamily: FONT_WEIGHTS.medium,
                      color: colors.textMuted,
                      marginLeft: SPACING.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Note (Optional)</Text>
                  </View>
                  <TextInput
                    ref={noteInputRef}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a description or story..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={{
                      fontSize: 15,
                      fontFamily: FONT_WEIGHTS.regular,
                      color: colors.text,
                      paddingVertical: SPACING.sm,
                      minHeight: 70,
                      lineHeight: 22,
                    }}
                  />
                </View>
              </View>

              {/* Helper text */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginTop: SPACING.lg,
                paddingHorizontal: SPACING.xl,
              }}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={{ 
                  fontSize: 12, 
                  fontFamily: FONT_WEIGHTS.regular,
                  color: colors.textMuted, 
                  marginLeft: SPACING.xs,
                }}>
                  You can edit this memory anytime
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
