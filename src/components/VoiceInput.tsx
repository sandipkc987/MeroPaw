import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { THEME, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";

interface VoiceInputProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { type: string; title: string; note: string; date?: string; time?: string }) => void;
}

export default function VoiceInput({ visible, onClose, onSave }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock voice recognition - in real app, use expo-speech or react-native-voice
  const startRecording = () => {
    setIsRecording(true);
    setTranscript("");
    
    // Simulate voice input
    setTimeout(() => {
      setIsRecording(false);
      setIsProcessing(true);
      
      // Mock transcript examples
      const examples = [
        "My pet ate 1 cup kibble at 8 AM",
        "Vet appointment on October 30th at 2 PM",
        "Gave my pet heart medication",
        "My pet was very active today, played for 2 hours"
      ];
      
      setTimeout(() => {
        setTranscript(examples[Math.floor(Math.random() * examples.length)]);
        setIsProcessing(false);
      }, 2000);
    }, 3000);
  };

  const parseTranscript = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Detect category
    let type = "meal";
    if (lowerText.includes("vet") || lowerText.includes("appointment")) {
      type = "vet";
    } else if (lowerText.includes("medication") || lowerText.includes("medicine")) {
      type = "med";
    } else if (lowerText.includes("active") || lowerText.includes("played")) {
      type = "milestone";
    }

    // Extract date (simple regex)
    const dateMatch = text.match(/(\w+ \d+)/);
    const date = dateMatch ? dateMatch[1] : undefined;

    // Extract time
    const timeMatch = text.match(/(\d+:\d+|\d+ [AP]M)/);
    const time = timeMatch ? timeMatch[1] : undefined;

    return {
      type,
      title: text,
      note: `Voice input: ${text}`,
      date,
      time
    };
  };

  const handleSave = () => {
    if (transcript) {
      const parsed = parseTranscript(transcript);
      onSave(parsed);
      setTranscript("");
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: SPACING.lg
      }}>
        <View style={{
          backgroundColor: THEME.white,
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          width: "100%",
          maxWidth: 400,
          ...SHADOWS.lg
        }}>
          <Text style={{
            ...TYPOGRAPHY.xl,
            fontWeight: "700",
            color: THEME.text,
            marginBottom: SPACING.lg,
            textAlign: "center"
          }}>
            Voice Input
          </Text>

          {/* Recording Status */}
          <View style={{
            alignItems: "center",
            marginBottom: SPACING.xl
          }}>
            {isRecording ? (
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: THEME.error,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.md
              }}>
                <Text style={{ color: THEME.white, fontSize: 24 }}>🎤</Text>
              </View>
            ) : isProcessing ? (
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: THEME.accent,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.md
              }}>
                <Text style={{ color: THEME.white, fontSize: 24 }}>⏳</Text>
              </View>
            ) : (
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: THEME.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.md
              }}>
                <Text style={{ fontSize: 24 }}>🎤</Text>
              </View>
            )}

            <Text style={{
              ...TYPOGRAPHY.base,
              color: THEME.text,
              textAlign: "center"
            }}>
              {isRecording ? "Listening..." : isProcessing ? "Processing..." : "Tap to start recording"}
            </Text>
          </View>

          {/* Transcript Display */}
          {transcript ? (
            <View style={{
              backgroundColor: THEME.surface,
              borderRadius: RADIUS.lg,
              padding: SPACING.md,
              marginBottom: SPACING.lg
            }}>
              <Text style={{
                ...TYPOGRAPHY.sm,
                color: THEME.text,
                fontStyle: "italic"
              }}>
                "{transcript}"
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={{ gap: SPACING.md }}>
            {!transcript ? (
              <TouchableOpacity
                onPress={startRecording}
                style={{
                  backgroundColor: THEME.accent,
                  borderRadius: RADIUS.lg,
                  paddingVertical: SPACING.md,
                  alignItems: "center"
                }}
                disabled={isRecording || isProcessing}
              >
                <Text style={{
                  color: THEME.white,
                  ...TYPOGRAPHY.base,
                  fontWeight: "600"
                }}>
                  {isRecording ? "Recording..." : isProcessing ? "Processing..." : "Start Recording"}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handleSave}
                  style={{
                    backgroundColor: THEME.accent,
                    borderRadius: RADIUS.lg,
                    paddingVertical: SPACING.md,
                    alignItems: "center"
                  }}
                >
                  <Text style={{
                    color: THEME.white,
                    ...TYPOGRAPHY.base,
                    fontWeight: "600"
                  }}>
                    Save Entry
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setTranscript("")}
                  style={{
                    backgroundColor: THEME.surface,
                    borderRadius: RADIUS.lg,
                    paddingVertical: SPACING.md,
                    alignItems: "center"
                  }}
                >
                  <Text style={{
                    color: THEME.text,
                    ...TYPOGRAPHY.base,
                    fontWeight: "600"
                  }}>
                    Try Again
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: THEME.border,
                borderRadius: RADIUS.lg,
                paddingVertical: SPACING.md,
                alignItems: "center"
              }}
            >
              <Text style={{
                color: THEME.text,
                ...TYPOGRAPHY.base,
                fontWeight: "600"
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

