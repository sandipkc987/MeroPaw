import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Alert, Linking, ActivityIndicator, Platform, Modal, ScrollView } from "react-native";

let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch {
    console.warn("DateTimePicker not available");
  }
}

import { StatusBar } from "react-native";
import WebView from "react-native-webview";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { Ionicons } from "@expo/vector-icons";
import storage from "@src/utils/storage";
import { Input, Button } from "@src/components/UI";

const IN_APP_BROWSER_KEY = "@kasper_inapp_browser";

export type InAppBrowserContext = "vetVisit";

export interface InAppBrowserParams {
  url: string;
  context?: InAppBrowserContext;
  appointmentId?: string;
  clinicName?: string;
  userId?: string;
  petId?: string;
}

const VET_VISIT_DRAFT_KEY = "@kasper_vet_visit_draft";

export const SCHEDULE_VET_FROM_BROWSER_KEY = "@kasper_schedule_vet_from_browser";

export interface VetVisitDraft {
  url: string;
  clinicName?: string;
  savedAt: string;
}

export async function getVetVisitDraft(): Promise<VetVisitDraft | null> {
  const raw = await storage.getItem(VET_VISIT_DRAFT_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as VetVisitDraft;
    return d?.url ? d : null;
  } catch {
    return null;
  }
}

export async function clearVetVisitDraft(): Promise<void> {
  await storage.removeItem(VET_VISIT_DRAFT_KEY);
}

function parseDateToYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYYYYMMDDToDate(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToTimeString(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToHHmm(t: string): string | undefined {
  if (!t || !t.trim()) return undefined;
  const s = t.trim();
  const match =
    s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i) ||
    s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = (match[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  return undefined;
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeStringToDate(t: string): Date {
  const d = new Date();
  const hhmm = timeToHHmm(t);
  if (hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

function formatDisplayTime(t: string): string {
  if (!t || !t.trim()) return "";
  const match =
    t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i) ||
    t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = (match[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }
  return t;
}

function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Page";
  }
}

export default function InAppBrowserScreen() {
  const { colors, isDark } = useTheme();
  const { goBack, navigateTo } = useNavigation();
  const { user } = useAuth();
  const { activePetId } = usePets();

  const [params, setParams] = useState<InAppBrowserParams | null>(null);
  const [loading, setLoading] = useState(true);
  const webContainerRef = useRef<View>(null);
  const [confirmStep, setConfirmStep] = useState<"idle" | "date" | "review">("idle");
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmTime, setConfirmTime] = useState("");
  const [confirmClinicName, setConfirmClinicName] = useState("");
  const [expandedPicker, setExpandedPicker] = useState<"date" | "time" | null>(null);

  useEffect(() => {
    let mounted = true;
    storage.getItem(IN_APP_BROWSER_KEY).then((raw) => {
      if (!mounted) return;
      if (!raw) {
        goBack();
        return;
      }
      try {
        const p = JSON.parse(raw) as InAppBrowserParams;
        if (p?.url) {
          setParams(p);
        } else {
          goBack();
        }
      } catch {
        goBack();
      }
    });
    return () => {
      mounted = false;
    };
  }, [goBack]);

  const url = params?.url ? (params.url.startsWith("http") ? params.url : `https://${params.url}`) : "";
  const domain = params?.url ? getDomain(url) : "";
  const isWeb = Platform.OS === "web";

  const confirmDateObj = confirmDate && /^\d{4}-\d{2}-\d{2}$/.test(confirmDate)
    ? parseYYYYMMDDToDate(confirmDate)
    : new Date();
  const confirmTimeObj = timeStringToDate(confirmTime);

  const WebDatePicker = ({ value, onChange, onClose }: { value: Date; onChange: (d: Date) => void; onClose: () => void }) => {
    const [localDate, setLocalDate] = useState(value);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const calendarDays: Array<number | null> = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
    const changeMonth = (delta: number) => {
      const newDate = new Date(localDate);
      newDate.setMonth(month + delta);
      setLocalDate(newDate);
    };
    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={20} color={colors.text} /></TouchableOpacity>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>{months[month]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={20} color={colors.text} /></TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: SPACING.sm }}>
          {days.map((d) => <View key={d} style={{ width: "14.28%", alignItems: "center", paddingVertical: SPACING.xs }}><Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{d}</Text></View>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarDays.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={{ width: "14.28%", paddingVertical: SPACING.sm }} />;
            const dayDate = new Date(year, month, day);
            dayDate.setHours(0, 0, 0, 0);
            const valueDate = new Date(value);
            valueDate.setHours(0, 0, 0, 0);
            const isSelected = dayDate.getTime() === valueDate.getTime();
            const isToday = dayDate.getTime() === today.getTime();
            return (
              <TouchableOpacity key={day} onPress={() => { const d = new Date(year, month, day); onChange(d); }} style={{ width: "14.28%", alignItems: "center", paddingVertical: SPACING.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSelected ? colors.accent : isToday ? colors.accent + "20" : "transparent", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: isSelected ? colors.white : colors.text }}>{day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Button title="Done" onPress={onClose} style={{ marginTop: SPACING.md }} />
      </View>
    );
  };

  const WebTimePicker = ({ value, onChange, onClose }: { value: Date; onChange: (d: Date) => void; onClose: () => void }) => {
    const [localTime, setLocalTime] = useState(value);
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    const isAM = currentHour < 12;
    const displayHour = currentHour % 12 || 12;
    const updateTime = (hour: number, minute: number, am: boolean) => {
      const newTime = new Date(localTime);
      newTime.setHours(am ? hour : hour + 12, minute);
      setLocalTime(newTime);
      onChange(newTime);
    };
    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg }}>
        <View style={{ height: 200, marginBottom: SPACING.md, backgroundColor: colors.card, borderRadius: RADIUS.lg, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 40, marginTop: -20, backgroundColor: colors.accent + "15", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.accent + "40" }} />
          <View style={{ flexDirection: "row", height: "100%" }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }} snapToInterval={40} decelerationRate="fast">
              {hours.map((hour) => <TouchableOpacity key={hour} onPress={() => updateTime(hour, currentMinute, isAM)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}><Text style={{ ...TYPOGRAPHY.lg, color: displayHour === hour ? colors.accent : colors.textMuted, fontWeight: displayHour === hour ? "700" : "500" }}>{hour}</Text></TouchableOpacity>)}
            </ScrollView>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }} snapToInterval={40} decelerationRate="fast">
              {minutes.map((minute) => <TouchableOpacity key={minute} onPress={() => updateTime(displayHour, minute, isAM)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}><Text style={{ ...TYPOGRAPHY.lg, color: currentMinute === minute ? colors.accent : colors.textMuted, fontWeight: currentMinute === minute ? "700" : "500" }}>{minute.toString().padStart(2, "0")}</Text></TouchableOpacity>)}
            </ScrollView>
            <ScrollView style={{ flex: 0.8 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }} snapToInterval={40} decelerationRate="fast">
              {["AM", "PM"].map((period) => <TouchableOpacity key={period} onPress={() => updateTime(displayHour, currentMinute, period === "AM")} style={{ height: 40, alignItems: "center", justifyContent: "center" }}><Text style={{ ...TYPOGRAPHY.lg, color: (period === "AM") === isAM ? colors.accent : colors.textMuted, fontWeight: (period === "AM") === isAM ? "700" : "500" }}>{period}</Text></TouchableOpacity>)}
            </ScrollView>
          </View>
        </View>
        <Button title="Done" onPress={onClose} />
      </View>
    );
  };

  useEffect(() => {
    if (!isWeb || !url || typeof document === "undefined") return;
    const container = webContainerRef.current as unknown as HTMLElement | null;
    if (!container || !(container instanceof HTMLElement)) return;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", url);
    iframe.setAttribute("title", domain);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    container.appendChild(iframe);
    return () => {
      if (container.contains(iframe)) container.removeChild(iframe);
    };
  }, [isWeb, url, domain]);

  const clearAndGoBack = () => {
    storage.removeItem(IN_APP_BROWSER_KEY).catch(() => {});
    storage.removeItem(VET_VISIT_DRAFT_KEY).catch(() => {});
    goBack();
  };

  const saveDraftAndGoBack = async () => {
    if (params?.url) {
      await storage.setItem(VET_VISIT_DRAFT_KEY, JSON.stringify({
        url: params.url,
        clinicName: params.clinicName || "",
        savedAt: new Date().toISOString(),
      }));
    }
    storage.removeItem(IN_APP_BROWSER_KEY).catch(() => {});
    goBack();
  };

  const handleClose = () => {
    if (params?.context === "vetVisit") {
      Alert.alert(
        "Vet visit",
        "Did you book an appointment on the clinic's website?",
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => {
              Alert.alert(
                "Save draft?",
                "Save as draft so you can continue later?",
                [
                  { text: "Discard", style: "destructive", onPress: clearAndGoBack },
                  { text: "Save draft", onPress: saveDraftAndGoBack },
                ]
              );
            },
          },
          {
            text: "Yes",
            onPress: () => {
              setConfirmDate(new Date().toISOString().split("T")[0]);
              setConfirmTime("");
              setConfirmClinicName(params?.clinicName || domain || "");
              setExpandedPicker(null);
              setConfirmStep("date");
            },
          },
        ]
      );
    } else {
      clearAndGoBack();
    }
  };

  const handleConfirmNext = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmDate)) {
      Alert.alert("Select date", "Please select the appointment date.");
      return;
    }
    if (!confirmTime.trim()) {
      Alert.alert("Select time", "Please select the appointment time.");
      return;
    }
    const uid = params?.userId ?? user?.id;
    const pid = params?.petId ?? activePetId;
    if (!uid || !pid) {
      Alert.alert("Error", "Please sign in and select a pet to continue.");
      return;
    }
    setExpandedPicker(null);
    try {
      await storage.setItem(SCHEDULE_VET_FROM_BROWSER_KEY, JSON.stringify({
      userId: uid,
      petId: pid,
      clinicName: confirmClinicName.trim() || "",
      date: confirmDate,
      time: confirmTime.trim(),
      url: params?.url || "",
      appointmentId: params?.appointmentId,
    }));
      storage.removeItem(IN_APP_BROWSER_KEY).catch(() => {});
      storage.removeItem(VET_VISIT_DRAFT_KEY).catch(() => {});
      navigateTo("ScheduleVetVisit");
    } catch (e) {
      console.warn("InAppBrowser: Failed to save for Schedule Vet Visit", e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const showConfirmModal = params?.context === "vetVisit" && confirmStep === "date";

  const handleOpenInBrowser = () => {
    if (params?.url) {
      const url = params.url.startsWith("http") ? params.url : `https://${params.url}`;
      Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open in browser."));
    }
  };

  if (!params) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const headerTopPadding = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : SPACING.md;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: headerTopPadding }}>
      {/* Header: always on top and clickable (zIndex for web so it stays above WebView/iframe) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bgSecondary,
          zIndex: 9999,
          pointerEvents: "box-none",
          elevation: 10,
          ...(Platform.OS === "web" && { position: "relative" as const }),
        }}
      >
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={{ padding: SPACING.sm, minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-start" }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, flex: 1, marginHorizontal: SPACING.sm }} numberOfLines={1}>
          {domain}
        </Text>
        <TouchableOpacity
          onPress={handleOpenInBrowser}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={{ flexDirection: "row", alignItems: "center", padding: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: colors.card, minHeight: 44, justifyContent: "center" }}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={20} color={colors.accent} />
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, marginLeft: 4, fontWeight: "600" }}>Open in Browser</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!showConfirmModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.lg }}>
          <ScrollView style={{ width: "100%", maxWidth: 380 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight, ...SHADOWS.lg }}>
            <>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, marginBottom: SPACING.md }}>Enter appointment details</Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>Select the date and time you booked on the clinic&apos;s website.</Text>
                <Input value={confirmClinicName} onChangeText={setConfirmClinicName} placeholder="Clinic name" />
                <Pressable
                  onPress={() => setExpandedPicker((p) => (p === "date" ? null : "date"))}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 48,
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.md,
                    backgroundColor: pressed ? colors.borderLight : colors.bgSecondary,
                    borderRadius: RADIUS.md,
                    marginTop: SPACING.sm,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    gap: SPACING.sm,
                  })}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "500" }}>{confirmDate ? formatDisplayDate(confirmDate) : "Select date"}</Text>
                  </View>
                  <Ionicons name={expandedPicker === "date" ? "chevron-down" : "chevron-forward"} size={18} color={colors.textMuted} />
                </Pressable>
                {expandedPicker === "date" && (
                  <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.sm }}>
                    {Platform.OS === "web" ? (
                      <WebDatePicker value={confirmDateObj} onChange={(d) => { setConfirmDate(parseDateToYYYYMMDD(d)); setExpandedPicker(null); }} onClose={() => setExpandedPicker(null)} />
                    ) : DateTimePicker ? (
                      <View style={{ backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.borderLight }}>
                        <DateTimePicker value={confirmDateObj} mode="date" display="spinner" themeVariant={isDark ? "dark" : "light"} onChange={(e: any, d?: Date) => { if (d) setConfirmDate(parseDateToYYYYMMDD(d)); }} />
                        <Button title="Done" onPress={() => setExpandedPicker(null)} style={{ marginTop: SPACING.sm }} />
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center" }}>
                        <Input value={confirmDate} onChangeText={setConfirmDate} placeholder="Date (YYYY-MM-DD)" style={{ flex: 1 }} />
                        <Button title="Done" onPress={() => setExpandedPicker(null)} />
                      </View>
                    )}
                  </View>
                )}
                <Pressable
                  onPress={() => setExpandedPicker((p) => (p === "time" ? null : "time"))}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 48,
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.md,
                    backgroundColor: pressed ? colors.borderLight : colors.bgSecondary,
                    borderRadius: RADIUS.md,
                    marginTop: SPACING.sm,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    gap: SPACING.sm,
                  })}
                >
                  <Ionicons name="time-outline" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "500" }}>{confirmTime.trim() ? (formatDisplayTime(confirmTime) || confirmTime) : "Select time"}</Text>
                  </View>
                  <Ionicons name={expandedPicker === "time" ? "chevron-down" : "chevron-forward"} size={18} color={colors.textMuted} />
                </Pressable>
                {expandedPicker === "time" && (
                  <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.sm }}>
                    {Platform.OS === "web" ? (
                      <WebTimePicker value={confirmTimeObj} onChange={(d) => { setConfirmTime(dateToTimeString(d)); setExpandedPicker(null); }} onClose={() => setExpandedPicker(null)} />
                    ) : DateTimePicker ? (
                      <View style={{ backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.borderLight }}>
                        <DateTimePicker value={confirmTimeObj} mode="time" display="spinner" themeVariant={isDark ? "dark" : "light"} is24Hour={false} onChange={(e: any, d?: Date) => { if (d) setConfirmTime(dateToTimeString(d)); }} />
                        <Button title="Done" onPress={() => setExpandedPicker(null)} style={{ marginTop: SPACING.sm }} />
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center" }}>
                        <WebTimePicker value={confirmTimeObj} onChange={(d) => { setConfirmTime(dateToTimeString(d)); setExpandedPicker(null); }} onClose={() => setExpandedPicker(null)} />
                      </View>
                    )}
                  </View>
                )}
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }}>
                <Button title="Cancel" onPress={clearAndGoBack} style={{ flex: 1, backgroundColor: colors.bgSecondary }} titleStyle={{ color: colors.text }} />
                <Button title="Next" onPress={handleConfirmNext} style={{ flex: 1 }} />
              </View>
            </>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {isWeb ? (
        /* Web: WebView isn't supported; inject iframe so content loads and close button works */
        <View ref={webContainerRef} style={{ flex: 1, minHeight: 0 }} collapsable={false} />
      ) : (
        <>
          <WebView
            source={{ uri: url }}
            style={{ flex: 1 }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
          />
          {loading && (
            <View style={{ position: "absolute", top: 56 + headerTopPadding, left: 0, right: 0, alignItems: "center", paddingVertical: SPACING.sm }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export async function openInAppBrowser(params: InAppBrowserParams): Promise<void> {
  await storage.setItem(IN_APP_BROWSER_KEY, JSON.stringify(params));
}
