import React from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  StatusBar,
  Text,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PinchZoomableImage from "@src/components/PinchZoomableImage";

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

export default function ImageZoomLightbox({ visible, uri, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: Platform.OS === "ios" ? 54 : 40,
            paddingHorizontal: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
            Pinch to zoom
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <PinchZoomableImage uri={uri} resetKey={uri} />
      </View>
    </Modal>
  );
}
