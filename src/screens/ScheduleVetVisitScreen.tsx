import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Modal, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { Button, Input } from "@src/components/UI";
import ScreenHeader from "@src/components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { getSupabaseClient } from "@src/services/supabaseClient";
import { supabaseUrl } from "@src/services/supabaseClient";
import storage from "@src/utils/storage";
import { openInAppBrowser, getVetVisitDraft, clearVetVisitDraft, SCHEDULE_VET_FROM_BROWSER_KEY } from "@src/screens/InAppBrowserScreen";
import {
  insertVetAppointment,
  updateVetAppointment,
  insertReminder,
  insertNotification,
  fetchVetAppointments,
  fetchSavedVet,
  upsertSavedVet,
} from "@src/services/supabaseData";
import {
  getVetSyncCalendarId,
  createVetCalendarEvent,
  updateVetCalendarEvent,
  deleteVetCalendarEvent,
} from "@src/services/calendarSync";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import { getZipFromCurrentLocation, hasLocationPermission } from "@src/utils/geo";

let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch {
    console.warn("DateTimePicker not available");
  }
}

const CONTAINER_GRADIENT = (accent: string) =>
  [accent + "14", accent + "08", "transparent"] as const;

const SAVED_VET_KEY = (userId: string, petId: string) =>
  `@kasper_saved_vet_${userId}_${petId}`;

type ScreenMode = "empty" | "hasAppointment" | "wizard";
type WizardStep = "choose" | "discover" | "details";

interface VetAppointment {
  id: string;
  title: string;
  appointmentDate: string;
  appointmentTime?: string;
  clinicName?: string;
  clinicWebsite?: string;
  clinicPhone?: string;
  doctorName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  status?: "scheduled" | "confirmed" | "completed" | "canceled";
  calendarEventId?: string;
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

function timeStringToDate(t: string): Date {
  const d = new Date();
  const hhmm = timeToHHmm(t);
  if (hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

function dateToTimeString(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ScheduleVetVisitScreen() {
  const { colors, isDark } = useTheme();
  const { navigateTo, goBack, refreshVetVisitTrigger } = useNavigation();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const activePetId = activePet?.id ?? null;

  type VisitTypeValue = "routine" | "vaccination" | "sick" | "followup" | "emergency" | "groom" | "bath" | "boarding";
  const [visitType, setVisitType] = useState<VisitTypeValue>("routine");
  const [vetChoice, setVetChoice] = useState<"saved" | "discover">("discover");
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [searchZip, setSearchZip] = useState("");
  const [searchVetName, setSearchVetName] = useState("");
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(10);
  const [foundVets, setFoundVets] = useState<
    { name: string; address: string; website: string; phone: string }[]
  >([]);
  const [loadingVets, setLoadingVets] = useState(false);
  const [loadingMoreVets, setLoadingMoreVets] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [prefetchedZip, setPrefetchedZip] = useState<string | null>(null);
  const [prefetchedVets, setPrefetchedVets] = useState<{ name: string; address: string; website: string; phone: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [visitTypeDropdownOpen, setVisitTypeDropdownOpen] = useState(false);

  const [appointments, setAppointments] = useState<VetAppointment[]>([]);
  const [vetDraft, setVetDraft] = useState<{ url: string; clinicName?: string } | null>(null);
  const [savedVet, setSavedVet] = useState<{
    name: string;
    address: string;
    website: string;
    phone: string;
  } | null>(null);
  const [mode, setMode] = useState<ScreenMode>("empty");
  const [wizardStep, setWizardStep] = useState<WizardStep>("choose");
  const [vetActionSheetVisible, setVetActionSheetVisible] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<VetAppointment | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedVetForAction, setSelectedVetForAction] = useState<{
    name: string;
    address: string;
    website: string;
    phone: string;
  } | null>(null);

  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent?.contentOffset?.y ?? 0;
    if (y <= 0) {
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
  }, []);

  const petNamePossessive = activePet?.name ? `${activePet.name}'s` : "your pet's";

  const today = new Date().toISOString().split("T")[0];
  const upcomingAppointments = appointments
    .filter((a) => a.appointmentDate >= today && a.status !== "canceled")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const load = async () => {
      try {
        const data = await fetchVetAppointments(user.id, activePetId);
        setAppointments(data);
        const draft = await getVetVisitDraft();
        setVetDraft(draft || null);
        const raw = await storage.getItem(SAVED_VET_KEY(user.id, activePetId));
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.name) setSavedVet(parsed);
          } catch {}
        }
      } catch (e) {
        console.warn("ScheduleVetVisit: Failed to load appointments", e);
      }
    };
    load();
  }, [user?.id, activePetId, refreshVetVisitTrigger]);

  useEffect(() => {
    if (mode === "wizard") return;
    const hasUpcoming = appointments.some(
      (a) => a.appointmentDate >= new Date().toISOString().split("T")[0] && a.status !== "canceled"
    );
    setMode(hasUpcoming ? "hasAppointment" : "empty");
  }, [appointments, mode]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    storage.getItem(SCHEDULE_VET_FROM_BROWSER_KEY).then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data?.userId !== user?.id || data?.petId !== activePetId) return;
        setClinicName(data.clinicName || "");
        if (data.date) setDate(data.date);
        if (data.time) setTime(data.time);
        if (data.url) setSelectedVetWebsite(data.url.startsWith("http") ? data.url : `https://${data.url}`);
        if (data.appointmentId) setEditingAppointmentId(data.appointmentId);
        setMode("wizard");
        setWizardStep("details");
        storage.removeItem(SCHEDULE_VET_FROM_BROWSER_KEY).catch(() => {});
      } catch {
        storage.removeItem(SCHEDULE_VET_FROM_BROWSER_KEY).catch(() => {});
      }
    });
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId || mode !== "wizard") return;
    const key = `@kasper_schedule_vet_initial_${user.id}_${activePetId}`;
    storage.getItem(key).then((raw) => {
      if (!raw) return;
      try {
        const initial = JSON.parse(raw);
        if (initial.visitType) setVisitType(initial.visitType);
        if (initial.date) setDate(initial.date);
        storage.removeItem(key).catch(() => {});
      } catch {
        storage.removeItem(key).catch(() => {});
      }
    });
  }, [user?.id, activePetId, mode]);

  // Prefetch ZIP + vet search when screen mounts (if location allowed) to reduce lag when user reaches Discover
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const granted = await hasLocationPermission();
        if (!granted || cancelled) return;
        const zip = await getZipFromCurrentLocation();
        if (!zip || cancelled) return;
        setSearchZip(zip);
        const vets = await fetchVetsApi(8, zip);
        if (!cancelled && Array.isArray(vets) && vets.length > 0) {
          setPrefetchedZip(zip);
          setPrefetchedVets(vets);
        }
      } catch {
        // ignore prefetch errors
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Auto-fill ZIP from location when user enters Discover step (finding clinic)
  useEffect(() => {
    if (wizardStep !== "discover" || searchZip.trim()) return;
    let cancelled = false;
    setLoadingLocation(true);
    getZipFromCurrentLocation()
      .then((zip) => {
        if (!cancelled && zip) setSearchZip(zip);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLocation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wizardStep, searchZip]);

  // When user lands on Discover, use prefetched vets if ZIP matches (reduces lag)
  useEffect(() => {
    if (wizardStep !== "discover") return;
    const zipVal = searchZip.trim();
    if (!zipVal || prefetchedZip !== zipVal || !prefetchedVets?.length) return;
    setFoundVets(prefetchedVets);
  }, [wizardStep, searchZip, prefetchedZip, prefetchedVets]);

  const visitTypeOptions: { label: string; value: VisitTypeValue }[] = [
    { label: "Routine checkup", value: "routine" },
    { label: "Vaccination", value: "vaccination" },
    { label: "Sick visit", value: "sick" },
    { label: "Follow-up", value: "followup" },
    { label: "Emergency", value: "emergency" },
    { label: "Groom", value: "groom" },
    { label: "Bath", value: "bath" },
    { label: "Boarding", value: "boarding" },
  ];

  const fetchVetsApi = async (limit: number, zipOverride?: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const zipToUse = (zipOverride ?? searchZip).trim();
    if (!zipToUse) return [];
    const res = await fetch(`${supabaseUrl}/functions/v1/find-vets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        zipCode: zipToUse,
        radiusMiles: searchRadiusMiles,
        limit,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Search failed");
    return (data.vets && Array.isArray(data.vets)) ? data.vets : [];
  };

  const findVets = async () => {
    const zipVal = searchZip.trim();
    if (!zipVal) {
      Alert.alert("ZIP required", "Enter a ZIP code to find vets nearby.");
      return;
    }
    setLoadingVets(true);
    setFoundVets([]);
    try {
      const vets = await fetchVetsApi(8);
      const nameLower = searchVetName.trim().toLowerCase();
      const filtered = nameLower
        ? vets.filter((v: { name: string }) => String(v?.name ?? "").toLowerCase().includes(nameLower))
        : vets;
      setFoundVets(filtered);
      if (filtered.length === 0)
        Alert.alert("No results", nameLower ? "No vets match that name." : "No vets found for this area.");
    } catch (e) {
      console.error("findVets error:", e);
      Alert.alert("Error", "Search failed. Check your connection and try again.");
    } finally {
      setLoadingVets(false);
    }
  };

  const loadMoreVets = async () => {
    const zipVal = searchZip.trim();
    if (!zipVal || loadingMoreVets) return;
    setLoadingMoreVets(true);
    try {
      const vets = await fetchVetsApi(15);
      const nameLower = searchVetName.trim().toLowerCase();
      const filtered = nameLower
        ? vets.filter((v: { name: string }) => String(v?.name ?? "").toLowerCase().includes(nameLower))
        : vets;
      setFoundVets((prev) => {
        const seen = new Set(prev.map((v) => `${v.name}|${v.address}`));
        const newVets = filtered.filter((v) => !seen.has(`${v.name}|${v.address}`));
        return newVets.length > 0 ? [...prev, ...newVets] : prev;
      });
    } catch (e) {
      console.error("loadMoreVets error:", e);
      Alert.alert("Error", "Could not load more. Try again.");
    } finally {
      setLoadingMoreVets(false);
    }
  };

  const parseAddress = (full: string) => {
    const t = full.trim();
    const zipMatch = t.match(/\b(\d{5})(?:-(\d{4}))?\s*$/);
    const zipOut = zipMatch ? zipMatch[1] : "";
    let rest = zipMatch ? t.slice(0, zipMatch.index).trim() : t;
    const stateMatch = rest.match(/,?\s*([A-Z]{2})\s*$/i);
    const stateOut = stateMatch ? stateMatch[1].toUpperCase() : "";
    rest = stateMatch
      ? rest.slice(0, stateMatch.index).trim().replace(/^,\s*/, "")
      : rest;
    const parts = rest
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const cityOut = parts.length >= 1 ? parts[parts.length - 1] : "";
    const street =
      parts.length >= 2 ? parts.slice(0, -1).join(", ") : parts[0] || rest;
    return { street, city: cityOut, state: stateOut, zip: zipOut };
  };

  const [selectedVetWebsite, setSelectedVetWebsite] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");

  const applyVet = (vet: {
    name: string;
    address: string;
    website: string;
    phone: string;
  }, addToSaved?: boolean) => {
    setClinicName(vet.name);
    setSelectedVetWebsite(vet.website || "");
    setClinicPhone(vet.phone || "");
    const { street, city: c, state: s, zip: z } = parseAddress(vet.address);
    setAddressLine1(street);
    setCity(c);
    setState(s);
    setZip(z);
    setFoundVets([]);
    setSelectedVetForAction(null);
    setVetActionSheetVisible(false);
    if (addToSaved && user?.id && activePetId) {
      upsertSavedVet(user.id, activePetId, vet).then(() => setSavedVet(vet)).catch((e) =>
        console.warn("ScheduleVetVisit: Failed to save vet to Supabase", e)
      );
      setSavedVet(vet);
    }
    if (wizardStep === "discover") setWizardStep("details");
  };

  const formatDisplayDate = (isoDate: string) => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
    const d = new Date(isoDate + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDisplayTime = (t: string) => {
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
      if (!ampm && h >= 12)
        return `${h === 12 ? 12 : h - 12}:${String(m).padStart(2, "0")} PM`;
      if (!ampm && h < 12)
        return `${h === 0 ? 12 : h}:${String(m).padStart(2, "0")} AM`;
      return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${
        h >= 12 ? "PM" : "AM"
      }`;
    }
    return t;
  };

  const WebDatePicker = ({
    value,
    onChange,
    onClose,
  }: {
    value: Date;
    onChange: (date: Date) => void;
    onClose: () => void;
  }) => {
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
    const selectDate = (day: number) => {
      const newDate = new Date(year, month, day);
      onChange(newDate);
    };
    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={20} color={colors.text} /></TouchableOpacity>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>{months[month]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={20} color={colors.text} /></TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: SPACING.sm }}>
          {days.map((d) => (
            <View key={d} style={{ width: "14.28%", alignItems: "center", paddingVertical: SPACING.xs }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{d}</Text>
            </View>
          ))}
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
              <TouchableOpacity
                key={day}
                onPress={() => selectDate(day)}
                style={{ width: "14.28%", alignItems: "center", paddingVertical: SPACING.sm }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: isSelected ? colors.accent : isToday ? colors.accent + "20" : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
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

  const WebTimePicker = ({ value, onChange, onClose }: { value: Date; onChange: (date: Date) => void; onClose: () => void }) => {
    const [localTime, setLocalTime] = useState(value);
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const ampmOptions = ["AM", "PM"];
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
              {hours.map((hour) => (
                <TouchableOpacity key={hour} onPress={() => updateTime(hour, currentMinute, isAM)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...TYPOGRAPHY.lg, color: displayHour === hour ? colors.accent : colors.textMuted, fontWeight: displayHour === hour ? "700" : "500" }}>{hour}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }} snapToInterval={40} decelerationRate="fast">
              {minutes.map((minute) => (
                <TouchableOpacity key={minute} onPress={() => updateTime(displayHour, minute, isAM)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...TYPOGRAPHY.lg, color: currentMinute === minute ? colors.accent : colors.textMuted, fontWeight: currentMinute === minute ? "700" : "500" }}>{minute.toString().padStart(2, "0")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ flex: 0.8 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }} snapToInterval={40} decelerationRate="fast">
              {ampmOptions.map((period) => (
                <TouchableOpacity key={period} onPress={() => updateTime(displayHour, currentMinute, period === "AM")} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...TYPOGRAPHY.lg, color: (period === "AM") === isAM ? colors.accent : colors.textMuted, fontWeight: (period === "AM") === isAM ? "700" : "500" }}>{period}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <Button title="Done" onPress={onClose} />
      </View>
    );
  };

  const performSave = async () => {
    const visitLabel =
      visitTypeOptions.find((o) => o.value === visitType)?.label || "Vet Visit";
    const title = clinicName.trim() || visitLabel;
    const appointmentPayload = {
      title,
      appointmentDate: date,
      appointmentTime: time.trim() || undefined,
      clinicName: clinicName.trim() || undefined,
      clinicWebsite: selectedVetWebsite.trim() || undefined,
      clinicPhone: clinicPhone.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      reason: visitLabel,
      notes: notes.trim() || undefined,
      status: "scheduled" as const,
    };

    if (!user?.id || !activePetId) {
      Alert.alert("Error", "Please sign in and select a pet.");
      setSaving(false);
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Error", "Please select a date for the appointment.");
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      let appointmentId: string | undefined;
      const editingApt = editingAppointmentId
        ? appointments.find((a) => a.id === editingAppointmentId)
        : null;
      const calendarPayload = {
        title: appointmentPayload.title,
        appointment_date: appointmentPayload.appointmentDate,
        appointment_time: appointmentPayload.appointmentTime ?? null,
        clinic_name: appointmentPayload.clinicName ?? null,
        address_line1: appointmentPayload.addressLine1 ?? null,
        city: appointmentPayload.city ?? null,
        state: appointmentPayload.state ?? null,
        zip: appointmentPayload.zip ?? null,
        reason: appointmentPayload.reason ?? null,
        notes: appointmentPayload.notes ?? null,
      };

      if (editingAppointmentId) {
        await updateVetAppointment(user.id, editingAppointmentId, appointmentPayload);
        appointmentId = editingAppointmentId;
        setEditingAppointmentId(null);
        const calendarId = await getVetSyncCalendarId();
        if (calendarId && editingApt) {
          if (editingApt.calendarEventId) {
            await updateVetCalendarEvent(editingApt.calendarEventId, calendarPayload);
          } else {
            const eventId = await createVetCalendarEvent(calendarId, calendarPayload);
            if (eventId) {
              await updateVetAppointment(user.id, editingAppointmentId, { calendar_event_id: eventId });
            }
          }
        }
      } else {
        const inserted = await insertVetAppointment(user.id, activePetId, appointmentPayload);
        appointmentId = inserted?.id;
        const calendarId = await getVetSyncCalendarId();
        if (calendarId && appointmentId) {
          const eventId = await createVetCalendarEvent(calendarId, calendarPayload);
          if (eventId) {
            await updateVetAppointment(user.id, appointmentId, { calendar_event_id: eventId });
          }
        }
      }

      const hhmm = timeToHHmm(time);
      if (!editingAppointmentId) {
      await insertReminder(user.id, activePetId, {
        title: `Vet: ${title}`,
        note: notes.trim() || undefined,
        scheduledDate: date,
        scheduledTime: hhmm || "09:00",
        dateKey: date,
        active: true,
        hasNotification: true,
        completed: false,
        category: "other",
      }).catch((e) =>
        console.warn("ScheduleVetVisit: Failed to create reminder", e)
      );
      }

      await insertNotification(user.id, {
        petId: activePetId,
        kind: "health",
        title: "Appointment saved",
        message: `${clinicName.trim() || title} — ${formatDisplayDate(date)}${time.trim() ? ` at ${formatDisplayTime(time) || time}` : ""}.`,
        ctaLabel: "View health",
        metadata: {
          type: "vet_appointment",
          appointmentId: appointmentId || undefined,
        },
      }).catch((e) =>
        console.warn("ScheduleVetVisit: Failed to create notification", e)
      );

      const refreshed = await fetchVetAppointments(user.id, activePetId);
      setAppointments(refreshed);
      setMode("hasAppointment");
      setWizardStep("choose");
      setFoundVets([]);
      setEditingAppointmentId(null);
      const clinicLabel = clinicName.trim() || "your vet";
      const dateTimeStr = `${formatDisplayDate(date)}${time.trim() ? ` at ${formatDisplayTime(time) || time}` : ""}`;
      Alert.alert(
        "Appointment saved",
        `${activePet?.name || "Your pet"}'s visit at ${clinicLabel} on ${dateTimeStr} has been saved. A reminder was added to your list.`
      );
    } catch (e) {
      console.error("Save vet visit error:", e);
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const dateTimeStr = `${formatDisplayDate(date)}${time.trim() ? ` at ${formatDisplayTime(time) || time}` : ""}`;
    const summary = `${clinicName.trim() || "Vet Visit"}\n${dateTimeStr}`;
    Alert.alert(
      "Please review",
      "Have you confirmed everything is correct?\n\n" + summary,
      [
        { text: "Review again", style: "cancel" },
        { text: "Yes, save", onPress: () => performSave() },
      ]
    );
  };

  const handleBackFromWizard = () => {
    if (wizardStep === "choose") {
      setMode(appointments.length > 0 ? "hasAppointment" : "empty");
    } else if (wizardStep === "discover") {
      setWizardStep("choose");
    } else {
      setWizardStep("discover");
    }
  };

  const vetActionOptions: ActionSheetOption[] = selectedVetForAction
    ? [
        {
          label: "Add to Use my vet",
          icon: "heart-outline",
          onPress: () => applyVet(selectedVetForAction, true),
        },
        {
          label: "Use this vet (don't save)",
          icon: "checkmark-outline",
          onPress: () => applyVet(selectedVetForAction, false),
        },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Schedule Vet Visit"
        showBackButton
        onBackPress={() =>
          mode === "wizard" ? handleBackFromWizard() : goBack()
        }
        actionIcon="time-outline"
        onActionPress={() => navigateTo("VetVisitHistory")}
        centerTitle={false}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
      />

      {vetDraft && (
        <View style={{ marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: SPACING.md, backgroundColor: colors.accent + "18", borderRadius: RADIUS.md, borderLeftWidth: 4, borderLeftColor: colors.accent, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, flex: 1 }} numberOfLines={1}>
            Continue booking at {vetDraft.clinicName || "clinic"}?
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <TouchableOpacity
              onPress={async () => {
                await clearVetVisitDraft();
                setVetDraft(null);
              }}
              style={{ paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm }}
            >
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const url = vetDraft.url.startsWith("http") ? vetDraft.url : `https://${vetDraft.url}`;
                await openInAppBrowser({ url, context: "vetVisit", clinicName: vetDraft.clinicName, userId: user?.id ?? undefined, petId: activePetId ?? undefined });
                navigateTo("InAppBrowser");
              }}
              style={{ paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, backgroundColor: colors.accent, borderRadius: RADIUS.sm }}
            >
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.white, fontWeight: "600" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty state */}
      {mode === "empty" && (
        <View style={{ flex: 1, paddingHorizontal: SPACING.lg, justifyContent: "center", paddingBottom: SPACING.xxxl }}>
          <View style={{ alignItems: "center", marginBottom: SPACING.xl }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent + "18", alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg }}>
              <Ionicons name="calendar-outline" size={40} color={colors.accent} />
            </View>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: SPACING.sm }}>
              No vet visits scheduled
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", maxWidth: 280, marginBottom: SPACING.lg }}>
              Keep {petNamePossessive} health on track. Schedule an appointment, save clinic details, and we&apos;ll add a reminder for you.
            </Text>
          </View>
          <Button
            title="Schedule vet visit"
            onPress={() => { setEditingAppointmentId(null); setMode("wizard"); }}
          />
        </View>
      )}

      {/* Has appointment state - show all upcoming appointments */}
      {mode === "hasAppointment" && upcomingAppointments.length > 0 && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
            Upcoming appointments
          </Text>
          {upcomingAppointments.map((apt) => (
            <View
              key={apt.id}
              style={{
                marginBottom: SPACING.lg,
                borderRadius: RADIUS.lg,
                overflow: "hidden",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.borderLight,
                ...SHADOWS.sm,
              }}
            >
              <LinearGradient colors={CONTAINER_GRADIENT(colors.accent)} style={{ height: 24 }} />
              <View style={{ padding: SPACING.lg }}>
                {apt.clinicName ? (
                  <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginBottom: SPACING.xs }}>
                    {apt.clinicName}
                  </Text>
                ) : null}
                <Text style={{ ...TYPOGRAPHY.base, color: colors.accent, fontWeight: "600", marginBottom: SPACING.sm }}>
                  {formatDisplayDate(apt.appointmentDate)}
                  {apt.appointmentTime ? ` at ${formatDisplayTime(apt.appointmentTime) || apt.appointmentTime}` : ""}
                </Text>
                {(apt.addressLine1 || apt.city) && (
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.md }} numberOfLines={2}>
                    {[apt.addressLine1, [apt.city, apt.state, apt.zip].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </Text>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md }}>
                  {apt.clinicWebsite ? (
                    <TouchableOpacity
                      onPress={async () => {
                        const url = apt.clinicWebsite!.startsWith("http") ? apt.clinicWebsite! : `https://${apt.clinicWebsite}`;
                        await openInAppBrowser({ url, context: "vetVisit", clinicName: apt.clinicName, appointmentId: apt.id, userId: user?.id ?? undefined, petId: activePetId ?? undefined });
                        navigateTo("InAppBrowser");
                      }}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: colors.accent, borderRadius: RADIUS.md, gap: SPACING.xs }}
                    >
                      <Ionicons name="globe-outline" size={18} color="#fff" />
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: "#fff" }}>Book online</Text>
                    </TouchableOpacity>
                  ) : null}
                  {apt.clinicPhone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${apt.clinicPhone!.replace(/\D/g, "")}`).catch(() => Alert.alert("Error", "Could not open phone."))}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight, gap: SPACING.xs }}
                    >
                      <Ionicons name="call-outline" size={18} color={colors.text} />
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>Call clinic</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.md }}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingAppointmentId(apt.id);
                      setClinicName(apt.clinicName || "");
                      setSelectedVetWebsite(apt.clinicWebsite || "");
                      setClinicPhone(apt.clinicPhone || "");
                      setDoctorName(apt.doctorName || "");
                      setDate(apt.appointmentDate || date);
                      setTime(apt.appointmentTime || "");
                      setAddressLine1(apt.addressLine1 || "");
                      setCity(apt.city || "");
                      setState(apt.state || "");
                      setZip(apt.zip || "");
                      setNotes(apt.notes || "");
                      setMode("wizard");
                      setWizardStep("details");
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Reschedule</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setAppointmentToCancel(apt);
                      setShowCancelConfirm(true);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.textMuted }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
            <TouchableOpacity
              onPress={() => {
                setEditingAppointmentId(null);
                setClinicName("");
                setSelectedVetWebsite("");
                setClinicPhone("");
                setDoctorName("");
                setDate(new Date().toISOString().split("T")[0]);
                setTime("");
                setAddressLine1("");
                setCity("");
                setState("");
                setZip("");
                setNotes("");
                setMode("wizard");
                setWizardStep("choose");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Schedule another</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Wizard flow */}
      {mode === "wizard" && (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xxxl,
          gap: SPACING.lg,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {wizardStep === "choose" && (
          <>
            <View style={{ paddingTop: SPACING.sm }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                Step 1 of 2
              </Text>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text, marginTop: 4 }}>
                Choose visit type & vet
              </Text>
            </View>
            <View
              style={{
                borderRadius: RADIUS.lg,
                overflow: "hidden",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.borderLight,
                ...SHADOWS.sm,
              }}
            >
              <LinearGradient colors={CONTAINER_GRADIENT(colors.accent)} style={{ height: 24 }} />
              <View style={{ padding: SPACING.lg, gap: SPACING.lg }}>
                <View>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>Visit type</Text>
                  <TouchableOpacity
                    onPress={() => setVisitTypeDropdownOpen((o) => !o)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight }}
                  >
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text }}>{visitTypeOptions.find((o) => o.value === visitType)?.label || "Select type"}</Text>
                    <Ionicons name={visitTypeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  {visitTypeDropdownOpen && (
                    <View style={{ marginTop: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden" }}>
                      {visitTypeOptions.map((opt, idx) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => { setVisitType(opt.value); setVisitTypeDropdownOpen(false); }}
                          style={{ paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, backgroundColor: visitType === opt.value ? colors.accent + "15" : colors.card, borderBottomWidth: idx < visitTypeOptions.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                        >
                          <Text style={{ ...TYPOGRAPHY.base, color: visitType === opt.value ? colors.accent : colors.text, fontWeight: visitType === opt.value ? "600" : "400" }}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>Choose vet</Text>
                  <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                    <TouchableOpacity
                      onPress={() => { if (savedVet) { applyVet(savedVet, false); setWizardStep("details"); } }}
                      disabled={!savedVet}
                      style={{
                        flex: 1,
                        paddingVertical: SPACING.md,
                        alignItems: "center",
                        backgroundColor: vetChoice === "saved" ? colors.accent : savedVet ? colors.bgSecondary : colors.bgSecondary,
                        borderRadius: RADIUS.md,
                        borderWidth: 1,
                        borderColor: vetChoice === "saved" ? colors.accent : colors.borderLight,
                        opacity: savedVet ? 1 : 0.5,
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, color: vetChoice === "saved" ? colors.white : colors.text, fontWeight: vetChoice === "saved" ? "600" : "500" }}>
                        Use my vet
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setVetChoice("discover"); setWizardStep("discover"); }}
                      style={{
                        flex: 1,
                        paddingVertical: SPACING.md,
                        alignItems: "center",
                        backgroundColor: colors.accent,
                        borderRadius: RADIUS.md,
                        borderWidth: 1,
                        borderColor: colors.accent,
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.white, fontWeight: "600" }}>Discover</Text>
                    </TouchableOpacity>
                  </View>
                  {!savedVet && (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.xs }}>
                      Add your vet by tapping Discover.
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        {wizardStep === "discover" && (
          <View
            style={{
              borderRadius: RADIUS.lg,
              overflow: "hidden",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.borderLight,
              ...SHADOWS.sm,
            }}
          >
            <LinearGradient colors={CONTAINER_GRADIENT(colors.accent)} style={{ height: 24 }} />
            <View style={{ padding: SPACING.lg, gap: SPACING.sm }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>Find vets nearby</Text>
              <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center" }}>
                <Input value={searchZip} onChangeText={setSearchZip} placeholder="ZIP code (required)" keyboardType="number-pad" style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={async () => {
                    setLoadingLocation(true);
                    try {
                      const zip = await getZipFromCurrentLocation();
                      if (zip) {
                        setSearchZip(zip);
                      } else {
                        Alert.alert("Location", "Could not get your location. Enter your ZIP code manually or allow location access in settings.");
                      }
                    } catch {
                      Alert.alert("Location", "Could not get your location. Enter your ZIP code manually.");
                    } finally {
                      setLoadingLocation(false);
                    }
                  }}
                  disabled={loadingLocation}
                  accessibilityLabel="Use my location"
                  accessibilityHint="Fills ZIP code from your current location"
                  style={{
                    paddingVertical: SPACING.md,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.md,
                    backgroundColor: loadingLocation ? colors.borderLight : colors.accent + "18",
                    borderWidth: 1,
                    borderColor: colors.accent,
                  }}
                >
                  {loadingLocation ? (
                    <Ionicons name="hourglass-outline" size={22} color={colors.accent} />
                  ) : (
                    <Ionicons name="locate" size={22} color={colors.accent} />
                  )}
                </TouchableOpacity>
              </View>
              <Input value={searchVetName} onChangeText={setSearchVetName} placeholder="Vet or clinic name (optional)" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[5, 10, 15, 25].map((m) => (
                  <TouchableOpacity key={m} onPress={() => setSearchRadiusMiles(m)} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: searchRadiusMiles === m ? colors.accent : colors.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: searchRadiusMiles === m ? colors.accent : colors.borderLight }}>
                    <Text style={{ ...TYPOGRAPHY.xs, color: searchRadiusMiles === m ? colors.white : colors.text, fontWeight: searchRadiusMiles === m ? "600" : "500" }}>{m} mi</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={findVets} disabled={loadingVets} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md, backgroundColor: colors.accent, borderRadius: RADIUS.md, gap: SPACING.sm }}>
                {loadingVets ? <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: "#fff" }}>Searching...</Text> : <><Ionicons name="search" size={18} color="#fff" /><Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: "#fff" }}>Search</Text></>}
              </TouchableOpacity>
              {foundVets.length > 0 && (
                <View style={{ marginTop: SPACING.sm }}>
                  <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.textMuted, marginBottom: 8 }}>Tap a vet to select</Text>
                  {foundVets.map((vet, i) => (
                    <TouchableOpacity
                      key={`${vet.name}-${i}`}
                      onPress={() => { setSelectedVetForAction(vet); setVetActionSheetVisible(true); }}
                      style={{ paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexDirection: "row", alignItems: "center" }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }} numberOfLines={1}>{vet.name}</Text>
                        {vet.address ? <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }} numberOfLines={1}>{vet.address}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={loadMoreVets}
                    disabled={loadingMoreVets}
                    style={{ marginTop: SPACING.sm, paddingVertical: SPACING.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs }}
                  >
                    {loadingMoreVets ? (
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Loading more...</Text>
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                        <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.accent }}>Load more vets</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {wizardStep === "details" && (
        <>
        <View style={{ paddingTop: SPACING.sm }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
            Step 2 of 2
          </Text>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text, marginTop: 4 }}>
            Appointment details
          </Text>
        </View>

        {/* Main form card - consolidated like Expense/Health */}
        <View
          style={{
            borderRadius: RADIUS.lg,
            overflow: "hidden",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...SHADOWS.sm,
          }}
        >
          <LinearGradient
            colors={CONTAINER_GRADIENT(colors.accent)}
            style={{ height: 24 }}
          />
          <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.md }}>
            {selectedVetWebsite ? (
              <View style={{ marginBottom: SPACING.lg, padding: SPACING.md, backgroundColor: colors.accent + "12", borderRadius: RADIUS.md, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, fontWeight: "600", marginBottom: 4 }}>Book your appointment</Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm }}>Schedule directly on the clinic&apos;s website.</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const url = selectedVetWebsite.startsWith("http") ? selectedVetWebsite : `https://${selectedVetWebsite}`;
                    await openInAppBrowser({ url, context: "vetVisit", clinicName: clinicName.trim() || undefined, userId: user?.id ?? undefined, petId: activePetId ?? undefined });
                    navigateTo("InAppBrowser");
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}
                >
                  <Ionicons name="globe-outline" size={18} color={colors.accent} />
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>Open clinic website</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text, marginBottom: SPACING.sm }}>Visit type</Text>
              <TouchableOpacity
                onPress={() => setVisitTypeDropdownOpen((o) => !o)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight }}
              >
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text }}>{visitTypeOptions.find((o) => o.value === visitType)?.label || "Select type"}</Text>
                <Ionicons name={visitTypeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
              {visitTypeDropdownOpen && (
                <View style={{ marginTop: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden" }}>
                  {visitTypeOptions.map((opt, idx) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setVisitType(opt.value); setVisitTypeDropdownOpen(false); }}
                      style={{ paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, backgroundColor: visitType === opt.value ? colors.accent + "15" : colors.card, borderBottomWidth: idx < visitTypeOptions.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                    >
                      <Text style={{ ...TYPOGRAPHY.base, color: visitType === opt.value ? colors.accent : colors.text, fontWeight: visitType === opt.value ? "600" : "400" }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Clinic */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: SPACING.lg, marginTop: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm }}>
              Clinic
            </Text>
            <Input value={clinicName} onChangeText={setClinicName} placeholder="Clinic name (e.g., City Animal Clinic)" />
            <View style={{ marginTop: SPACING.sm }}>
              <Input value={selectedVetWebsite} onChangeText={setSelectedVetWebsite} placeholder="Website (optional)" keyboardType="url" />
            </View>
            <View style={{ marginTop: SPACING.sm }}>
              <Input value={clinicPhone} onChangeText={setClinicPhone} placeholder="Phone (optional)" keyboardType="phone-pad" />
            </View>
          </View>

          {/* Appointment */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: SPACING.lg, marginTop: SPACING.lg, gap: SPACING.sm }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Appointment
            </Text>
            <Input value={doctorName} onChangeText={setDoctorName} placeholder="Doctor (e.g., Dr. Patel)" />
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                backgroundColor: colors.bgSecondary,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: colors.borderLight,
                gap: SPACING.sm,
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "500" }}>
                  {date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "Select date"}
                </Text>
                {date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, marginTop: 2 }}>{formatDisplayDate(date)}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                backgroundColor: colors.bgSecondary,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: colors.borderLight,
                gap: SPACING.sm,
              }}
            >
              <Ionicons name="time-outline" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "500" }}>
                  {time.trim() ? (formatDisplayTime(time) || time) : "Select time"}
                </Text>
                {time.trim() ? (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, marginTop: 2 }}>{time}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Clinic address */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: SPACING.lg, marginTop: SPACING.lg, gap: SPACING.sm }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Address
            </Text>
            <Input value={addressLine1} onChangeText={setAddressLine1} placeholder="Street address" />
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <View style={{ flex: 1 }}><Input value={city} onChangeText={setCity} placeholder="City" /></View>
              <View style={{ width: 72 }}><Input value={state} onChangeText={(t) => setState(t.toUpperCase().slice(0, 2))} placeholder="State" /></View>
              <View style={{ width: 88 }}><Input value={zip} onChangeText={setZip} placeholder="ZIP" keyboardType="number-pad" /></View>
            </View>
          </View>

          {/* Notes */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: SPACING.lg, marginTop: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm }}>
              Notes
            </Text>
            <Input value={notes} onChangeText={setNotes} placeholder="Reason or notes (e.g., Annual checkup)" multiline numberOfLines={3} />
          </View>
        </View>
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <Button
            title="Back"
            onPress={handleBackFromWizard}
            style={{ flex: 1, backgroundColor: colors.bgSecondary }}
            titleStyle={{ color: colors.text }}
          />
          <Button
            title={saving ? "Saving..." : "Save"}
            onPress={handleSave}
            style={{ flex: 1 }}
            disabled={saving}
          />
        </View>
        </>
        )}
      </ScrollView>
      )}

      <ActionSheet
        visible={vetActionSheetVisible}
        title={selectedVetForAction?.name || "Select option"}
        message="Add to your saved vet or use for this visit only."
        options={vetActionOptions}
        onClose={() => { setVetActionSheetVisible(false); setSelectedVetForAction(null); }}
        centered
      />

      <ActionSheet
        visible={showCancelConfirm}
        title="Cancel appointment?"
        message="Do you want to cancel this appointment? You can reschedule anytime."
        centered
        options={[
          {
            label: "No, keep",
            icon: "close-outline",
            onPress: () => setShowCancelConfirm(false),
          },
          {
            label: "Yes, cancel",
            icon: "close-circle-outline",
            destructive: true,
            onPress: async () => {
              setShowCancelConfirm(false);
              const apt = appointmentToCancel;
              setAppointmentToCancel(null);
              if (!user?.id || !apt) return;
              try {
                if (apt.calendarEventId) {
                  await deleteVetCalendarEvent(apt.calendarEventId);
                }
                await updateVetAppointment(user.id, apt.id, {
                  status: "canceled",
                  calendar_event_id: null,
                });
                const refreshed = await fetchVetAppointments(user.id, activePetId!);
                setAppointments(refreshed);
              } catch (e) {
                Alert.alert("Error", "Could not cancel. Try again.");
              }
            },
          },
        ]}
        onClose={() => { setShowCancelConfirm(false); setAppointmentToCancel(null); }}
      />

      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.lg }}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: "100%", maxWidth: 380 }}>
            {Platform.OS === "web" ? (
              <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight, ...SHADOWS.lg }}>
              <WebDatePicker
                value={parseYYYYMMDDToDate(date)}
                onChange={(d) => {
                  setDate(parseDateToYYYYMMDD(d));
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
              </View>
            ) : DateTimePicker ? (
              <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight, ...SHADOWS.lg }}>
                <DateTimePicker
                  value={parseYYYYMMDDToDate(date)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant={isDark ? "dark" : "light"}
                  onChange={(event: any, selectedDate?: Date) => {
                    if (Platform.OS === "android") setShowDatePicker(false);
                    if (selectedDate) {
                      setDate(parseDateToYYYYMMDD(selectedDate));
                      if (Platform.OS === "ios") {
                        setShowDatePicker(false);
                      }
                    }
                    if (event?.type === "dismissed") setShowDatePicker(false);
                  }}
                />
                {Platform.OS === "ios" && (
                  <Button title="Done" onPress={() => setShowDatePicker(false)} style={{ marginTop: SPACING.md }} />
                )}
              </View>
            ) : (
              <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg }}>
                <Input value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" />
                <Button title="Done" onPress={() => setShowDatePicker(false)} style={{ marginTop: SPACING.md }} />
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.lg }}
          activeOpacity={1}
          onPress={() => setShowTimePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: "100%", maxWidth: 380 }}>
            {DateTimePicker ? (
              <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight, ...SHADOWS.lg }}>
                <DateTimePicker
                  value={timeStringToDate(time)}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant={isDark ? "dark" : "light"}
                  is24Hour={false}
                  onChange={(event: any, selectedDate?: Date) => {
                    if (Platform.OS === "android") setShowTimePicker(false);
                    if (selectedDate) {
                      setTime(dateToTimeString(selectedDate));
                      if (Platform.OS === "ios") setShowTimePicker(false);
                    }
                    if (event?.type === "dismissed") setShowTimePicker(false);
                  }}
                />
                {(Platform.OS === "ios" || Platform.OS === "web") && (
                  <Button title="Done" onPress={() => setShowTimePicker(false)} style={{ marginTop: SPACING.md }} />
                )}
              </View>
            ) : (
              <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight, ...SHADOWS.lg }}>
                <WebTimePicker
                  value={timeStringToDate(time)}
                  onChange={(d) => setTime(dateToTimeString(d))}
                  onClose={() => setShowTimePicker(false)}
                />
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
