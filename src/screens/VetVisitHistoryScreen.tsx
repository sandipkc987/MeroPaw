import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { openInAppBrowser } from "@src/screens/InAppBrowserScreen";
import { fetchVetAppointments } from "@src/services/supabaseData";

interface VetAppointment {
  id: string;
  title: string;
  appointmentDate: string;
  appointmentTime?: string;
  clinicName?: string;
  clinicWebsite?: string;
  clinicPhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  status?: string;
}

function formatDisplayDate(isoDate: string) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDisplayTime(t: string) {
  if (!t || !t.trim()) return "";
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  return t;
}

export default function VetVisitHistoryScreen() {
  const { colors } = useTheme();
  const { goBack, navigateTo } = useNavigation();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const activePetId = activePet?.id ?? null;
  const [appointments, setAppointments] = useState<VetAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const data = await fetchVetAppointments(user.id, activePetId);
        setAppointments(data);
      } catch (e) {
        console.warn("VetVisitHistory: Failed to load", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, activePetId]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments
    .filter((a) => a.appointmentDate >= today && a.status !== "canceled")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
  const past = appointments
    .filter((a) => a.appointmentDate < today && a.status !== "canceled")
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
  const canceled = appointments
    .filter((a) => a.status === "canceled")
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));

  const AppointmentCard = ({ apt, isCanceled }: { apt: VetAppointment; isCanceled?: boolean }) => (
    <View
      style={{
        padding: SPACING.lg,
        backgroundColor: colors.card,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: SPACING.sm,
        opacity: isCanceled ? 0.75 : 1,
      }}
    >
      <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
        {apt.clinicName || apt.title || "Vet Visit"}
      </Text>
      <Text style={{ ...TYPOGRAPHY.sm, color: isCanceled ? colors.textMuted : colors.accent, fontWeight: "600" }}>
        {formatDisplayDate(apt.appointmentDate)}
        {apt.appointmentTime ? ` at ${formatDisplayTime(apt.appointmentTime)}` : ""}
      </Text>
      {(apt.addressLine1 || apt.city) && (
        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 4 }} numberOfLines={1}>
          {[apt.addressLine1, [apt.city, apt.state, apt.zip].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </Text>
      )}
      {!isCanceled && (apt.clinicWebsite || apt.clinicPhone) && (
        <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: "wrap" }}>
          {apt.clinicWebsite ? (
            <TouchableOpacity
              onPress={async () => {
                const url = apt.clinicWebsite!.startsWith("http") ? apt.clinicWebsite! : `https://${apt.clinicWebsite}`;
                await openInAppBrowser({ url, context: "vetVisit", clinicName: apt.clinicName, appointmentId: apt.id, userId: user?.id ?? undefined, petId: activePetId ?? undefined });
                navigateTo("InAppBrowser");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="globe-outline" size={16} color={colors.accent} />
              <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.accent }}>Website</Text>
            </TouchableOpacity>
          ) : null}
          {apt.clinicPhone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${apt.clinicPhone!.replace(/\D/g, "")}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="call-outline" size={16} color={colors.text} />
              <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.text }}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {isCanceled && (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.sm, gap: 4 }}>
          <Ionicons name="close-circle" size={14} color={colors.textMuted} />
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>Canceled</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Vet Visit History"
        showBackButton
        onBackPress={goBack}
        centerTitle={false}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
        insetSeparator
      />
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          {upcoming.length > 0 && (
            <View style={{ marginTop: SPACING.lg }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm }}>
                Upcoming
              </Text>
              {upcoming.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} />
              ))}
            </View>
          )}
          {past.length > 0 && (
            <View style={{ marginTop: SPACING.xl }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm }}>
                Past
              </Text>
              {past.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} />
              ))}
            </View>
          )}
          {canceled.length > 0 && (
            <View style={{ marginTop: SPACING.xl }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm }}>
                Canceled
              </Text>
              {canceled.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} isCanceled />
              ))}
            </View>
          )}
          {upcoming.length === 0 && past.length === 0 && canceled.length === 0 && (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: SPACING.xxxl }}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} style={{ marginBottom: SPACING.md }} />
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text, marginBottom: SPACING.xs }}>No vet visits yet</Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center" }}>
                Scheduled and canceled appointments will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
