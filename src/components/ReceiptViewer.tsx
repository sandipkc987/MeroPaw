import React from "react";
import { View, Text, TouchableOpacity, Modal, Image, Share, Linking, Alert, Platform } from "react-native";
import WebView from "react-native-webview";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";

interface ReceiptViewerProps {
  visible: boolean;
  onClose: () => void;
  receipt: {
    type: 'image' | 'pdf';
    url: string;
    name: string;
  };
}

export default function ReceiptViewer({ visible, onClose, receipt }: ReceiptViewerProps) {
  const { colors } = useTheme();
  const hasUrl = Boolean(receipt.url);
  const canEmbedPdf = receipt.type === "pdf" && Platform.OS !== "web";
  const canEmbedPdfWeb = receipt.type === "pdf" && Platform.OS === "web";
  const pdfViewerUrl = receipt.url
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(receipt.url)}`
    : "";

  const handleOpen = async () => {
    if (!receipt.url) {
      Alert.alert("Receipt unavailable", "This receipt does not have a viewable link yet.");
      return;
    }
    try {
      await Linking.openURL(receipt.url);
    } catch (error) {
      console.error("Receipt open error:", error);
      Alert.alert("Open failed", "Unable to open this receipt.");
    }
  };

  const handleShare = async () => {
    if (!receipt.url) {
      Alert.alert("Receipt unavailable", "This receipt does not have a shareable link yet.");
      return;
    }
    try {
      await Share.share({
        title: receipt.name,
        url: receipt.url,
        message: receipt.url,
      });
    } catch (error) {
      console.error("Receipt share error:", error);
      Alert.alert("Share failed", "Unable to share this receipt.");
    }
  };
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center"
      }}>
        {/* Header */}
        <View style={{
          position: "absolute",
          top: 50,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACING.lg,
          zIndex: 10
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontSize: 20, color: colors.white, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
          
          <Text style={{
            ...TYPOGRAPHY.lg,
            fontWeight: "700",
            color: colors.white
          }}>
            {receipt.name}
          </Text>
          
          <View style={{ width: 40 }} />
        </View>

        {/* Receipt Content */}
        <View style={{
          width: "90%",
          height: "70%",
          backgroundColor: colors.card,
          borderRadius: RADIUS.xl,
          padding: SPACING.lg,
          alignItems: "center",
          justifyContent: "center",
          ...SHADOWS.xl
        }}>
          {receipt.type === "image" && receipt.url ? (
            <Image
              source={{ uri: receipt.url }}
              style={{ width: "100%", height: "100%", borderRadius: RADIUS.lg }}
              resizeMode="contain"
            />
          ) : canEmbedPdf && receipt.url ? (
            <WebView
              source={{ uri: pdfViewerUrl }}
              originWhitelist={["*"]}
              style={{ width: "100%", height: "100%", borderRadius: RADIUS.lg }}
            />
          ) : canEmbedPdfWeb && receipt.url ? (
            <View style={{ width: "100%", height: "100%", borderRadius: RADIUS.lg, overflow: "hidden" }}>
              {React.createElement("iframe", {
                src: pdfViewerUrl,
                style: { width: "100%", height: "100%", border: "none" },
                title: receipt.name,
              })}
            </View>
          ) : receipt.type === "pdf" && receipt.url ? (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.danger + "20",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.lg
              }}>
                <Text style={{ fontSize: 32 }}>📄</Text>
              </View>
              <Text style={{
                ...TYPOGRAPHY.xl,
                fontWeight: "700",
                color: colors.text,
                marginBottom: SPACING.sm,
                textAlign: "center"
              }}>
                PDF preview unavailable
              </Text>
              <Text style={{
                ...TYPOGRAPHY.base,
                color: colors.textMuted,
                textAlign: "center"
              }}>
                Use Open to view in your browser.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: receipt.type === 'pdf' ? colors.danger + '20' : colors.accent + '20',
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.lg
              }}>
                <Text style={{ fontSize: 32 }}>
                  {receipt.type === 'pdf' ? '📄' : '📷'}
                </Text>
              </View>
              <Text style={{
                ...TYPOGRAPHY.xl,
                fontWeight: "700",
                color: colors.text,
                marginBottom: SPACING.sm,
                textAlign: "center"
              }}>
                {receipt.type === 'pdf' ? 'PDF Receipt' : 'Receipt Image'}
              </Text>
              <Text style={{
                ...TYPOGRAPHY.base,
                color: colors.textMuted,
                textAlign: "center"
              }}>
                {receipt.name}
              </Text>
              {!hasUrl && (
                <Text style={{
                  ...TYPOGRAPHY.sm,
                  color: colors.textMuted,
                  textAlign: "center",
                  marginTop: SPACING.sm
                }}>
                  No receipt link available.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{
          position: "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: SPACING.md,
          paddingHorizontal: SPACING.lg
        }}>
          <TouchableOpacity
            onPress={handleOpen}
            disabled={!hasUrl}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 999,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.xl,
              minWidth: 140,
              alignItems: "center",
              opacity: hasUrl ? 1 : 0.5,
              ...SHADOWS.sm
            }}
          >
            <Text style={{
              ...TYPOGRAPHY.base,
              fontWeight: "700",
              color: colors.white
            }}>
              Open
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleShare}
            disabled={!hasUrl}
            style={{
              backgroundColor: colors.card,
              borderRadius: 999,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.xl,
              minWidth: 140,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.borderLight,
              opacity: hasUrl ? 1 : 0.5
            }}
          >
            <Text style={{
              ...TYPOGRAPHY.base,
              fontWeight: "700",
              color: colors.text
            }}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

