import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@src/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@src/contexts/ThemeContext';

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (media: { uri: string; type: 'photo' | 'video'; width: number; height: number; title?: string; note?: string }) => void;
}

export default function MediaPicker({ visible, onClose, onMediaSelected }: MediaPickerProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please grant camera and photo library permissions to add memories.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for uniform grid
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onMediaSelected({
          uri: asset.uri,
          type: 'photo',
          width: asset.width || 1000,
          height: asset.height || 1000,
        });
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for uniform grid
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        onMediaSelected({
          uri: asset.uri,
          type: isVideo ? 'video' : 'photo',
          width: asset.width || 1000,
          height: asset.height || 1000,
        });
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const recordVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30, // 30 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onMediaSelected({
          uri: asset.uri,
          type: 'video',
          width: asset.width || 1000,
          height: asset.height || 1000,
        });
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: RADIUS.xl,
            padding: SPACING.xl,
            marginHorizontal: SPACING.lg,
            minWidth: 280,
            ...SHADOWS.lg,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: SPACING.lg,
          }}>
            <View>
              <Text style={{ ...TYPOGRAPHY.xl, fontWeight: "700", color: colors.text }}>
                Add memory
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                Choose a capture option
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
          
          <TouchableOpacity
            onPress={takePhoto}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
              backgroundColor: colors.cardSecondary,
              borderRadius: RADIUS.md,
              marginBottom: SPACING.sm,
              borderWidth: 1,
              borderColor: colors.borderLight,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.success + "18",
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: SPACING.md,
              }}
            >
              <Ionicons name="camera-outline" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: '600', color: colors.text }}>
                Take photo
              </Text>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                Use your camera
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickFromGallery}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
              backgroundColor: colors.cardSecondary,
              borderRadius: RADIUS.md,
              marginBottom: SPACING.sm,
              borderWidth: 1,
              borderColor: colors.borderLight,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.info + "18",
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: SPACING.md,
              }}
            >
              <Ionicons name="images-outline" size={20} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: '600', color: colors.text }}>
                Choose from gallery
              </Text>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                Photos or videos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={recordVideo}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
              backgroundColor: colors.cardSecondary,
              borderRadius: RADIUS.md,
              marginBottom: SPACING.sm,
              borderWidth: 1,
              borderColor: colors.borderLight,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.warning + "18",
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: SPACING.md,
              }}
            >
              <Ionicons name="videocam-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: '600', color: colors.text }}>
                Record video
              </Text>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                Up to 30 seconds
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {loading && (
            <View style={{
              alignItems: 'center',
              paddingVertical: SPACING.md,
            }}>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                Processing...
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

