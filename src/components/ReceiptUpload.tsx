import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Image, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS, SPACING, TYPOGRAPHY } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

interface ReceiptUploadProps {
  onReceiptSelect: (receipt: { type: 'image' | 'pdf'; url: string; name: string; uri: string; path?: string; documentId?: string } | null) => void;
  currentReceipt?: { type: 'image' | 'pdf'; url: string; name: string; uri: string; path?: string; documentId?: string } | null;
  onAnalyze?: (receipt: { type: 'image' | 'pdf'; uri: string }) => Promise<void>;
}

export default function ReceiptUpload({ onReceiptSelect, currentReceipt, onAnalyze }: ReceiptUploadProps) {
  const { colors } = useTheme();
  const [activeUploadType, setActiveUploadType] = useState<null | 'image' | 'pdf'>(null);
  const [activeAnalyzeType, setActiveAnalyzeType] = useState<null | 'image' | 'pdf'>(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload receipts.');
      return false;
    }
    return true;
  };

  const handleImagePick = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setActiveUploadType('image');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const receipt = {
          type: 'image' as const,
          uri: asset.uri,
          url: asset.uri, // For display
          name: `receipt_${Date.now()}.jpg`
        };
        
        onReceiptSelect(receipt);
        
        // Auto-analyze receipt
        if (onAnalyze) {
          setActiveAnalyzeType('image');
          try {
            await onAnalyze({ type: 'image', uri: asset.uri });
          } catch (error) {
            console.error("Analysis error:", error);
          } finally {
            setActiveAnalyzeType(null);
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      console.error(error);
    } finally {
      setActiveUploadType(null);
    }
  };

  const handlePDFPick = async () => {
    setActiveUploadType('pdf');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const receipt = {
          type: 'pdf' as const,
          uri: asset.uri,
          url: asset.uri,
          name: asset.name || `receipt_${Date.now()}.pdf`
        };
        
        onReceiptSelect(receipt);
        
        // Auto-analyze receipt
        if (onAnalyze) {
          setActiveAnalyzeType('pdf');
          try {
            await onAnalyze({ type: 'pdf', uri: asset.uri });
          } catch (error) {
            console.error("Analysis error:", error);
          } finally {
            setActiveAnalyzeType(null);
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick PDF. Please try again.');
      console.error(error);
    } finally {
      setActiveUploadType(null);
    }
  };

  const handleRemoveReceipt = () => {
    Alert.alert(
      "Remove Receipt",
      "Are you sure you want to remove this receipt?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: () => onReceiptSelect(null)
        }
      ]
    );
  };

  if (currentReceipt && currentReceipt.url) {
    return (
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginTop: SPACING.sm
      }}>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: SPACING.sm
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: currentReceipt.type === 'pdf' ? colors.danger + '20' : colors.accent + '20',
            alignItems: "center",
            justifyContent: "center",
            marginRight: SPACING.md
          }}>
            <Ionicons 
              name={currentReceipt.type === 'pdf' ? 'document-text' : 'image'} 
              size={20} 
              color={currentReceipt.type === 'pdf' ? colors.danger : colors.accent} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              ...TYPOGRAPHY.base,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 2
            }}>
              {currentReceipt.name}
            </Text>
            <Text style={{
              ...TYPOGRAPHY.sm,
              color: colors.textMuted
            }}>
              {currentReceipt.type.toUpperCase()} Receipt
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleRemoveReceipt}
            style={{
              padding: SPACING.sm,
              borderRadius: RADIUS.md,
              backgroundColor: colors.danger + '20'
            }}
          >
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
        
        {/* Receipt Preview */}
        <View style={{
          width: "100%",
          height: 120,
          backgroundColor: colors.bg,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.borderLight,
          overflow: "hidden"
        }}>
          {currentReceipt.type === 'image' && (currentReceipt.uri || currentReceipt.url) ? (
            <Image 
              source={{ uri: currentReceipt.uri || currentReceipt.url }} 
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <>
              <Ionicons 
                name={currentReceipt.type === 'pdf' ? 'document-text' : 'image'} 
                size={32} 
                color={colors.textMuted} 
              />
              <Text style={{ 
                color: colors.textMuted, 
                ...TYPOGRAPHY.sm,
                textAlign: "center",
                marginTop: SPACING.xs
              }}>
                {currentReceipt.type === 'pdf' ? 'PDF Receipt' : 'Receipt Image'}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginTop: SPACING.sm
    }}>
      <Text style={{
        ...TYPOGRAPHY.base,
        fontWeight: "700",
        color: colors.text,
        marginBottom: SPACING.xs
      }}>
        Receipt upload (optional)
      </Text>
      
      <Text style={{
        ...TYPOGRAPHY.sm,
        color: colors.textMuted,
        marginBottom: SPACING.lg
      }}>
        Add a photo or PDF so we can auto-fill key details.
      </Text>

      <View style={{ flexDirection: "row", gap: SPACING.md }}>
        {/** Keep buttons in sync but show activity only on the active one */}
        {/** This prevents both tiles from animating when only one is used */}
        <TouchableOpacity
          onPress={handleImagePick}
          disabled={!!activeUploadType || !!activeAnalyzeType}
          style={{
            flex: 1,
            backgroundColor: colors.cardSecondary,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.borderLight,
            opacity: (activeUploadType || activeAnalyzeType) ? 0.6 : 1
          }}
        >
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.accent + "18",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING.xs
          }}>
            {activeUploadType === 'image' || activeAnalyzeType === 'image' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="camera-outline" size={18} color={colors.accent} />
            )}
          </View>
          <Text style={{
            ...TYPOGRAPHY.sm,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center"
          }}>
            {activeAnalyzeType === 'image' ? "Analyzing..." : activeUploadType === 'image' ? "Uploading..." : "Photo"}
          </Text>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
            JPG or PNG
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePDFPick}
          disabled={!!activeUploadType || !!activeAnalyzeType}
          style={{
            flex: 1,
            backgroundColor: colors.cardSecondary,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.borderLight,
            opacity: (activeUploadType || activeAnalyzeType) ? 0.6 : 1
          }}
        >
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.textMuted + "22",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING.xs
          }}>
            {activeUploadType === 'pdf' || activeAnalyzeType === 'pdf' ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
            )}
          </View>
          <Text style={{
            ...TYPOGRAPHY.sm,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center"
          }}>
            {activeAnalyzeType === 'pdf' ? "Analyzing..." : activeUploadType === 'pdf' ? "Uploading..." : "PDF"}
          </Text>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
            Up to 10 MB
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

