import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { timeAgo } from "@src/utils/helpers";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { Button, Card, Chip, Input, Toggle } from "@src/components/UI";
import Select from "@src/components/Select";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import ReceiptViewer from "@src/components/ReceiptViewer";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Circle } from "react-native-svg";
import { fetchHealthRecords, insertHealthRecord, updateHealthRecord, deleteHealthRecord, uploadHealthAttachment, insertNotification, fetchVetAppointments, insertVetAppointment, updateVetAppointment, deleteVetAppointment, fetchWellnessInputs, upsertWellnessInputs, getHealthAttachmentViewUrl, fetchWeightHistory, upsertWeightHistory } from "@src/services/supabaseData";
import analyzeClinicalSummary from "@src/services/clinicalSummaryAnalysis";
import storage from "@src/utils/storage";

const SETTINGS_KEY = "@kasper_settings";

interface PDFAttachment {
  id: string;
  name: string;
  uri: string;
  size?: number;
  path?: string;
  extracted?: {
    weight?: { value: number; unit?: string; confidence: number };
    heartRate?: { value: number; unit?: string; confidence: number };
    respiratoryRate?: { value: number; unit?: string; confidence: number };
    attitude?: { value: string; confidence: number };
    visitDate?: { value: string; confidence: number };
    visitType?: { value: string; confidence: number };
  };
}

interface HealthRecord {
  id: string;
  type: "vaccination" | "checkup" | "medication" | "grooming" | "other";
  title: string;
  date: string;
  createdAt?: string;
  notes?: string;
  vet?: string;
  pdfs?: PDFAttachment[];
}

interface VetAppointment {
  id: string;
  title: string;
  appointmentDate: string;
  appointmentTime?: string;
  clinicName?: string;
  doctorName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  reason?: string;
  notes?: string;
  status?: "scheduled" | "completed" | "canceled";
}


const filterOptions = [
  { label: "All", value: "all" },
  { label: "Vaccinations", value: "vaccination" },
  { label: "Checkups", value: "checkup" },
  { label: "Medications", value: "medication" },
  { label: "Grooming", value: "grooming" },
  { label: "Other", value: "other" }
];

const HealthCard = ({
  record,
  onViewPDF,
  highlighted,
  onOpenActions,
}: {
  record: HealthRecord;
  onViewPDF?: (pdf: PDFAttachment) => void;
  highlighted?: boolean;
  onOpenActions?: () => void;
}) => {
  const { colors } = useTheme();
  const getTypeIcon = () => {
    switch (record.type) {
      case "vaccination": return "medical";
      case "checkup": return "checkmark-circle";
      case "medication": return "medkit";
      case "grooming": return "cut";
      default: return "document-text";
    }
  };

  const getTypeColor = () => {
    switch (record.type) {
      case "vaccination": return "#FF8A5B";
      case "checkup": return "#6E8BFF";
      case "medication": return "#F25DA2";
      case "grooming": return "#8F6CF3";
      default: return colors.accent;
    }
  };

  return (
    <Card elevated style={{ marginBottom: SPACING.md, borderWidth: highlighted ? 1 : 0, borderColor: highlighted ? colors.accent : "transparent" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: getTypeColor() + "15",
          alignItems: "center",
          justifyContent: "center",
          marginRight: SPACING.md
        }}>
          <Ionicons 
            name={getTypeIcon() as any}
            size={24} 
            color={getTypeColor()} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, flex: 1 }}>
              {record.title}
            </Text>
            {onOpenActions && (
              <TouchableOpacity onPress={onOpenActions}>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.xs }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: 4 }}>
              {record.date
                ? new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Date not set"}
            </Text>
            {record.vet && (
              <>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginHorizontal: 8 }}>•</Text>
                <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: 4 }}>
                  {record.vet}
                </Text>
              </>
            )}
          </View>
          {record.notes && (
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginTop: SPACING.xs, lineHeight: 20 }}>
              {record.notes}
            </Text>
          )}
          
          {/* PDF Attachments */}
          {record.pdfs && record.pdfs.length > 0 && (
            <View style={{ marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600", marginBottom: SPACING.xs }}>
                Attachments ({record.pdfs.length})
              </Text>
              {record.pdfs.map((pdf) => (
                <TouchableOpacity
                  key={pdf.id}
                  onPress={() => onViewPDF?.(pdf)}
                  style={{
                    width: "100%",
                    marginTop: SPACING.xs,
                    backgroundColor: colors.surface,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 56, height: 56, backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="document-text-outline" size={22} color={colors.danger} />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Attachment</Text>
                      <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                        {pdf.name}
                      </Text>
                      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                        Tap to view
                      </Text>
                    </View>
                    <View style={{ paddingRight: SPACING.md }}>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

// ---------- Wellness Score Helpers ----------
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const WEIGHT_BASELINE_WINDOW_DAYS = 60;
const WEIGHT_RECENCY_WINDOW_DAYS = 60;
const WEIGHT_ALERT_RECENT_DAYS = 14;

const daysBetween = (dateA: string | Date, dateB: string | Date) => {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / MS_PER_DAY;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const normalizePercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return clamp(value * 100, 0, 100);
  return clamp(value, 0, 100);
};

type PreventiveCare = {
  vaccinesUpToDate: boolean;
  parasiteControlCurrent: boolean;
  vaccinesDueDate?: string;
  parasiteControlDueDate?: string;
};

type MedicalHistory = {
  chronicConditionsCount: number;
  medicationCompliance: number;
  recentSymptomsLogged: number;
};

type WeightStatus = {
  lastRecordedDaysAgo: number;
  percentChange: number;
  hasBaseline: boolean;
};

type WeightEntry = {
  weight: number;
  date: string;
  source?: "manual" | "pdf";
};

const scorePreventive = (p: PreventiveCare) => {
  const now = new Date();
  const decayOverdue = (dueDate?: string, maxPoints = 0) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    const daysOverdue = (now.getTime() - due.getTime()) / MS_PER_DAY;
    if (daysOverdue <= 0) return maxPoints;
    const decayWindowDays = 90;
    return clamp(maxPoints * (1 - daysOverdue / decayWindowDays), 0, maxPoints);
  };

  let vaccinesScore = p.vaccinesUpToDate ? 35 : 0;
  const vaccinesDueScore = decayOverdue(p.vaccinesDueDate, 35);
  if (vaccinesDueScore != null) vaccinesScore = vaccinesDueScore;

  let parasiteScore = p.parasiteControlCurrent ? 15 : 0;
  const parasiteDueScore = decayOverdue(p.parasiteControlDueDate, 15);
  if (parasiteDueScore != null) parasiteScore = parasiteDueScore;

  return clamp(vaccinesScore + parasiteScore, 0, 50);
};

const scoreMedical = (m: MedicalHistory) => {
  let score = 30 - Math.min(m.chronicConditionsCount * 5, 15);
  const compliancePct = normalizePercent(m.medicationCompliance);
  const compliancePenalty = clamp((100 - compliancePct) / 10, 0, 10);
  score -= compliancePenalty;
  const symptomPenalty = clamp(Math.max(m.recentSymptomsLogged - 1, 0), 0, 5);
  score -= symptomPenalty;
  return clamp(score, 0, 30);
};

const scoreWeight = (w: WeightStatus) => {
  const recency = Number.isFinite(w.lastRecordedDaysAgo)
    ? clamp(10 * (1 - w.lastRecordedDaysAgo / WEIGHT_RECENCY_WINDOW_DAYS), 0, 10)
    : 0;
  if (!w.hasBaseline) return clamp(recency, 0, 20);

  const pct = Math.abs(w.percentChange);
  let stability = 0;
  if (pct < 3) stability = 10;
  else if (pct < 6) stability = 8;
  else if (pct < 10) stability = 5;
  else if (pct < 15) stability = 2;

  return clamp(recency + stability, 0, 20);
};

const ProgressBar = ({ value, max }: { value: number; max: number }) => {
  const { colors } = useTheme();
  const pct = Math.round((value / max) * 100);
  return (
    <View style={{
      height: 4,
      width: "100%",
      backgroundColor: colors.bgSecondary,
      borderRadius: RADIUS.pill,
      overflow: "hidden"
    }}>
      <View
        style={{
          height: "100%",
          width: `${Math.min(pct, 100)}%`,
          backgroundColor: colors.accent,
          borderRadius: RADIUS.pill
        }}
      />
    </View>
  );
};

const ToggleRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.card,
        marginBottom: SPACING.sm
      }}
    >
      <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{label}</Text>
      <Toggle
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
};

const NumberAdjustRow = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) => {
  const { colors } = useTheme();
  const decrease = () => onChange(clamp(value - step, min, max));
  const increase = () => onChange(clamp(value + step, min, max));

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.card,
        marginBottom: SPACING.sm
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          onPress={decrease}
          disabled={value <= min}
          style={{
            padding: SPACING.xs,
            opacity: value <= min ? 0.3 : 1,
            marginRight: SPACING.xs
          }}
        >
          <Ionicons name="remove-circle" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
          {value}{suffix ? suffix : ""}
        </Text>
        <TouchableOpacity
          onPress={increase}
          disabled={value >= max}
          style={{
            padding: SPACING.xs,
            opacity: value >= max ? 0.3 : 1,
            marginLeft: SPACING.xs
          }}
        >
          <Ionicons name="add-circle" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AddHealthRecordModal = ({
  visible,
  onClose,
  onSave,
  onDelete,
  initialRecord,
  startMode = "manual",
  petId,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (record: Omit<HealthRecord, "id">) => Promise<void>;
  onDelete?: () => void;
  initialRecord?: HealthRecord | null;
  startMode?: "manual" | "upload";
  petId?: string | null;
  userId?: string | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<HealthRecord["type"]>("checkup");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vetName, setVetName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfs, setPdfs] = useState<PDFAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"success" | "warning" | null>(null);
  const [autoPickDone, setAutoPickDone] = useState(false);
  const isEdit = !!initialRecord;
  const lastAnalyzedRef = useRef<string | null>(null);

  const formatLocalDate = (value: string) => {
    const trimmed = value.trim();
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const parsed = new Date(dateOnlyMatch ? `${trimmed}T00:00:00` : trimmed);
    if (Number.isNaN(parsed.getTime())) return "";
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newPDF: PDFAttachment = {
          id: String(Date.now()),
          name: asset.name || "document.pdf",
          uri: asset.uri,
          size: asset.size,
        };
        setPdfs(prev => [...prev, newPDF]);
      }
    } catch (error) {
      console.error("Error picking PDF:", error);
      Alert.alert("Error", "Failed to pick PDF");
    }
  };

  const removePDF = (pdfId: string) => {
    setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }
    try {
      setIsSaving(true);
      const vetLabel = [vetName.trim(), clinicName.trim()].filter(Boolean).join(" · ");
      await onSave({
      type,
      title: title.trim(),
      date,
      vet: vetLabel || undefined,
      notes: notes.trim() || undefined,
      pdfs: pdfs.length > 0 ? pdfs : undefined,
    });
    // Reset form
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVetName("");
    setClinicName("");
    setNotes("");
    setPdfs([]);
    setAnalysisSummary(null);
    setAnalysisStatus(null);
    onClose();
    } catch (error) {
      console.error("HealthScreen: Failed to save health record", error);
      Alert.alert("Error", "Could not save health record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const applyVetLabel = (label: string) => {
    const parts = label.split("·").map(part => part.trim()).filter(Boolean);
    setVetName(parts[0] || "");
    setClinicName(parts.slice(1).join(" · "));
  };

  useEffect(() => {
    if (!visible) return;
    if (initialRecord) {
      setTitle(initialRecord.title || "");
      setType(initialRecord.type || "checkup");
      setDate(initialRecord.date || new Date().toISOString().split('T')[0]);
      applyVetLabel(initialRecord.vet || "");
      setNotes(initialRecord.notes || "");
      setPdfs(initialRecord.pdfs || []);
      return;
    }
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVetName("");
    setClinicName("");
    setNotes("");
    setPdfs([]);
  }, [visible, initialRecord]);

  useEffect(() => {
    if (!visible) {
      setAutoPickDone(false);
      return;
    }
    if (startMode === "upload" && !autoPickDone && !isEdit) {
      setAutoPickDone(true);
      pickPDF();
    }
  }, [visible, startMode, autoPickDone, isEdit]);

  useEffect(() => {
    if (!visible || pdfs.length === 0) return;
    const latest = pdfs[pdfs.length - 1];
    if (!latest?.id || lastAnalyzedRef.current === latest.id) return;
    lastAnalyzedRef.current = latest.id;

    const runAnalysis = async () => {
      let summarySet = false;
      try {
        setIsAnalyzing(true);
        setAnalysisSummary(null);
        setAnalysisStatus(null);
        if (Platform.OS === "web" && latest.uri) {
          const pdfjsLib = await loadPdfJs();
          if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
            const resp = await fetch(latest.uri);
            const buffer = await resp.arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
            let text = "";
            for (let i = 1; i <= doc.numPages; i += 1) {
              const page = await doc.getPage(i);
              const content = await page.getTextContent();
              text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
            }
            const extraction = await analyzeClinicalSummary("", text, petId || undefined);
            const visitDate = extraction?.normalized?.visitDate?.value;
            if (visitDate) {
              const formatted = formatLocalDate(visitDate);
              if (formatted) setDate(formatted);
            }
            const doctor = extraction?.normalized?.doctorName?.value;
            const clinic = extraction?.normalized?.clinicName?.value;
            const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
            if (vetLabel) {
              applyVetLabel(vetLabel);
            }
            if (visitDate || vetLabel) {
              setAnalysisSummary("Auto-filled visit date and vet details from this PDF.");
              setAnalysisStatus("success");
              summarySet = true;
            } else {
              setAnalysisSummary("We couldn't detect a vet name or date. Please enter them manually.");
              setAnalysisStatus("warning");
              summarySet = true;
            }
            return;
          }
          // Fallback: upload + server-side extraction when pdf.js is unavailable
          if (!userId) {
            setAnalysisSummary("Sign in to auto-fill visit details.");
            setAnalysisStatus("warning");
            summarySet = true;
            return;
          }
        }

        if (!userId) {
          setAnalysisSummary("Sign in to auto-fill visit details.");
          setAnalysisStatus("warning");
          summarySet = true;
          return;
        }

        let filePath = latest.path;
        let viewUrl = latest.uri;
        if (!filePath && latest.uri) {
          const uploaded = await uploadHealthAttachment(userId, latest.uri, latest.name);
          filePath = uploaded.path;
          viewUrl = uploaded.uri;
          setPdfs(prev =>
            prev.map(item =>
              item.id === latest.id ? { ...item, uri: viewUrl, path: filePath } : item
            )
          );
        }
        if (!filePath) throw new Error("Upload missing file path");
        const extraction = await analyzeClinicalSummary(filePath, undefined, petId || undefined);
        const visitDate = extraction?.normalized?.visitDate?.value;
        if (visitDate) {
          const formatted = formatLocalDate(visitDate);
          if (formatted) setDate(formatted);
        }
        const doctor = extraction?.normalized?.doctorName?.value;
        const clinic = extraction?.normalized?.clinicName?.value;
        const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
        if (vetLabel) {
          applyVetLabel(vetLabel);
        }
        if (visitDate || vetLabel) {
          setAnalysisSummary("Auto-filled visit date and vet details from this PDF.");
          setAnalysisStatus("success");
          summarySet = true;
        } else {
          setAnalysisSummary("We couldn't detect a vet name or date. Please enter them manually.");
          setAnalysisStatus("warning");
          summarySet = true;
        }
      } catch (error) {
        console.warn("HealthScreen: Failed to analyze PDF for autofill", error);
        setAnalysisSummary("We couldn't analyze this PDF. Please enter details manually.");
        setAnalysisStatus("warning");
        summarySet = true;
      } finally {
        if (!summarySet) {
          setAnalysisSummary("We couldn't analyze this PDF. Please enter details manually.");
          setAnalysisStatus("warning");
        }
        setIsAnalyzing(false);
      }
    };

    runAnalysis();
  }, [visible, pdfs, userId, petId]);

  const typeOptions: { label: string; value: HealthRecord["type"]; icon: string }[] = [
    { label: "Vaccination", value: "vaccination", icon: "medical" },
    { label: "Checkup", value: "checkup", icon: "checkmark-circle" },
    { label: "Medication", value: "medication", icon: "medkit" },
    { label: "Grooming", value: "grooming", icon: "cut" },
    { label: "Other", value: "other", icon: "document-text" },
  ];
  const typeSelectOptions = typeOptions.map(option => ({
    label: option.label,
    value: option.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.black + "80", 
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING.lg
      }}>
        <View style={{ 
          width: "100%",
          maxWidth: 420,
          backgroundColor: colors.card,
          borderRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "88%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          overflow: "hidden",
          ...SHADOWS.lg
        }}>
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: SPACING.md,
            paddingBottom: SPACING.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight
          }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {isEdit ? "Edit Health Record" : "Add Health Record"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: SPACING.sm }}
          >
            <View>
              <View style={{ marginBottom: SPACING.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
                  Record type
                </Text>
                <View style={{ position: "relative" }}>
                  <Select
                    value={type}
                    onChange={(v) => setType(v as HealthRecord["type"])}
                    options={typeSelectOptions}
                    modalTitle="Record type"
                    modalIcon="list-outline"
                    width={170}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: [{ translateY: -8 }],
                    }}
                  >
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </View>
                </View>
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Upload clinical summary (optional)
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                    PDF Attachments
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={pickPDF}
                  activeOpacity={0.85}
                  style={{
                    padding: SPACING.md,
                    borderRadius: RADIUS.lg,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    backgroundColor: colors.cardSecondary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} />
                    <View style={{ marginLeft: SPACING.sm }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, fontWeight: "600" }}>
                        Upload clinical summary
                      </Text>
                      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                        PDF only • Auto-extract vitals
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {analysisSummary && (
                  <View style={{
                    marginTop: SPACING.sm,
                    padding: SPACING.sm,
                    backgroundColor: analysisStatus === "warning" ? colors.warningLight : colors.successLight,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: analysisStatus === "warning" ? colors.warning : colors.success,
                  }}>
                    <Text style={{
                      ...TYPOGRAPHY.sm,
                      color: analysisStatus === "warning" ? colors.warning : colors.success,
                      fontWeight: "600"
                    }}>
                      {analysisStatus === "warning" ? "Needs manual review" : "Clinical summary analyzed"}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, marginTop: 2 }}>
                      {analysisSummary}
                    </Text>
                  </View>
                )}

                {pdfs.length > 0 && (
                  <View style={{ marginTop: SPACING.sm }}>
                    {pdfs.map((pdf) => (
                      <View
                        key={pdf.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: SPACING.sm,
                          backgroundColor: colors.bgSecondary,
                          borderRadius: RADIUS.md,
                          marginBottom: SPACING.xs,
                        }}
                      >
                        <Ionicons name="document-text" size={20} color={colors.accent} />
                        <View style={{ marginLeft: SPACING.sm, flex: 1 }}>
                          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }} numberOfLines={1}>
                            {pdf.name}
                          </Text>
                          {typeof pdf.size === "number" && (
                            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                              {(pdf.size / 1024 / 1024).toFixed(2)} MB
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => removePDF(pdf.id)}>
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {isAnalyzing && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: SPACING.md,
                    backgroundColor: colors.accent + "10",
                    borderRadius: RADIUS.md,
                    marginTop: SPACING.sm,
                  }}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: SPACING.sm }} />
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                      Analyzing clinical summary...
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Visit title
                </Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Annual checkup"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  Visit date
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Auto-filled from receipt
                </Text>
                <Input
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Veterinarian
                </Text>
                <Input
                  value={vetName}
                  onChangeText={setVetName}
                  placeholder="Dr. Smith"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Clinic
                </Text>
                <Input
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="CityVet"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Additional notes (optional)
                </Text>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about the visit"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>

          <View style={{ 
            flexDirection: "row", 
            marginTop: SPACING.lg,
            paddingTop: SPACING.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight
          }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title={isSaving ? "Saving..." : (isEdit ? "Update" : "Save")}
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
          {isEdit && onDelete && (
            <Button
              title="Delete Record"
              onPress={onDelete}
              style={{ marginTop: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.danger }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const AddAppointmentModal = ({
  visible,
  onClose,
  onSave,
  onDelete,
  initialAppointment
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (appointment: Omit<VetAppointment, "id">) => Promise<void>;
  onDelete?: () => void;
  initialAppointment?: VetAppointment | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!initialAppointment;

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }
    if (!appointmentDate) {
      Alert.alert("Error", "Please enter a date");
      return;
    }
    try {
      setIsSaving(true);
      await onSave({
        title: title.trim(),
        appointmentDate,
        appointmentTime: appointmentTime.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        doctorName: doctorName.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "scheduled",
      });
      setTitle("");
      setAppointmentDate(new Date().toISOString().split("T")[0]);
      setAppointmentTime("");
      setClinicName("");
      setDoctorName("");
      setAddressLine1("");
      setCity("");
      setState("");
      setZip("");
      setReason("");
      setNotes("");
      onClose();
    } catch (error) {
      console.error("HealthScreen: Failed to save appointment", error);
      Alert.alert("Error", "Could not save appointment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (initialAppointment) {
      setTitle(initialAppointment.title || "");
      setAppointmentDate(initialAppointment.appointmentDate || new Date().toISOString().split("T")[0]);
      setAppointmentTime(initialAppointment.appointmentTime || "");
      setClinicName(initialAppointment.clinicName || "");
      setDoctorName(initialAppointment.doctorName || "");
      setAddressLine1(initialAppointment.addressLine1 || "");
      setCity(initialAppointment.city || "");
      setState(initialAppointment.state || "");
      setZip(initialAppointment.zip || "");
      setReason(initialAppointment.reason || "");
      setNotes(initialAppointment.notes || "");
      return;
    }
    setTitle("");
    setAppointmentDate(new Date().toISOString().split("T")[0]);
    setAppointmentTime("");
    setClinicName("");
    setDoctorName("");
    setAddressLine1("");
    setCity("");
    setState("");
    setZip("");
    setReason("");
    setNotes("");
  }, [visible, initialAppointment]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%"
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {isEdit ? "Edit Vet Visit" : "Schedule Vet Visit"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View>
              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Title *"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Annual Checkup"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Date *"
                  value={appointmentDate}
                  onChangeText={setAppointmentDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Time"
                  value={appointmentTime}
                  onChangeText={setAppointmentTime}
                  placeholder="HH:MM"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Clinic"
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="Clinic name"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Doctor"
                  value={doctorName}
                  onChangeText={setDoctorName}
                  placeholder="Doctor name"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Address"
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="Street address"
                />
              </View>

              <View style={{ flexDirection: "row", marginBottom: SPACING.md }}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Input
                    label="City"
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                  />
                </View>
                <View style={{ width: 90, marginRight: SPACING.sm }}>
                  <Input
                    label="State"
                    value={state}
                    onChangeText={setState}
                    placeholder="ST"
                  />
                </View>
                <View style={{ width: 100 }}>
                  <Input
                    label="ZIP"
                    value={zip}
                    onChangeText={setZip}
                    placeholder="ZIP"
                  />
                </View>
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Reason"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason for visit"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title={isSaving ? "Saving..." : (isEdit ? "Update" : "Save")}
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
          {isEdit && onDelete && (
            <Button
              title="Delete Visit"
              onPress={onDelete}
              style={{ marginTop: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.danger }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const ScheduleVetVisitModal = ({
  visible,
  onClose,
  initialValues,
  onPrefillApplied,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initialValues?: {
    visitType?: "routine" | "vaccination" | "sick" | "followup" | "emergency";
    date?: string;
    weight?: string;
    heartRate?: string;
    respRate?: string;
    attitude?: "BAR" | "QAR" | "L" | "D";
  };
  onPrefillApplied?: () => void;
  onSave?: (appointment: VetAppointment) => void;
}) => {
  const { colors } = useTheme();
  const [visitType, setVisitType] = useState<"routine" | "vaccination" | "sick" | "followup" | "emergency">("routine");
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
  const [weight, setWeight] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respRate, setRespRate] = useState("");
  const [attitude, setAttitude] = useState<"" | "BAR" | "QAR" | "L" | "D">("");
  const visitTypeOptions: { label: string; value: typeof visitType }[] = [
    { label: "Routine checkup", value: "routine" },
    { label: "Vaccination", value: "vaccination" },
    { label: "Sick visit", value: "sick" },
    { label: "Follow-up", value: "followup" },
    { label: "Emergency", value: "emergency" },
  ];
  const attitudeOptions: { label: string; value: "BAR" | "QAR" | "L" | "D" }[] = [
    { label: "BAR", value: "BAR" },
    { label: "QAR", value: "QAR" },
    { label: "L", value: "L" },
    { label: "D", value: "D" },
  ];

  const resetForm = () => {
    setVisitType("routine");
    setVetChoice("discover");
    setClinicName("");
    setDoctorName("");
    setDate(new Date().toISOString().split("T")[0]);
    setTime("");
    setAddressLine1("");
    setCity("");
    setState("");
    setZip("");
    setNotes("");
    setWeight("");
    setHeartRate("");
    setRespRate("");
    setAttitude("");
  };

  const handleSave = () => {
    const visitLabel = visitTypeOptions.find((option) => option.value === visitType)?.label || "Vet Visit";
    onSave?.({
      id: `${Date.now()}`,
      title: clinicName.trim() || visitLabel,
      appointmentDate: date,
      appointmentTime: time.trim() || undefined,
      clinicName: clinicName.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      notes: notes.trim() || undefined,
      status: "scheduled",
    });
    Alert.alert("Saved", "This vet visit is saved locally for now.");
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    resetForm();
    if (initialValues) {
      if (initialValues.visitType) setVisitType(initialValues.visitType);
      if (initialValues.date) setDate(initialValues.date);
      if (initialValues.weight) setWeight(initialValues.weight);
      if (initialValues.heartRate) setHeartRate(initialValues.heartRate);
      if (initialValues.respRate) setRespRate(initialValues.respRate);
      if (initialValues.attitude) setAttitude(initialValues.attitude);
      onPrefillApplied?.();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%"
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              Schedule Vet Visit
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.md }}>
            <View style={{ gap: SPACING.md }}>
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Visit Type
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row" }}>
                    {visitTypeOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setVisitType(option.value)}
                        style={{
                          paddingVertical: SPACING.sm,
                          paddingHorizontal: SPACING.md,
                          backgroundColor: visitType === option.value ? colors.accent : colors.bgSecondary,
                          borderRadius: RADIUS.md,
                          marginRight: SPACING.sm,
                        }}
                      >
                        <Text style={{
                          ...TYPOGRAPHY.sm,
                          color: visitType === option.value ? colors.white : colors.text,
                          fontWeight: visitType === option.value ? "600" : "500"
                        }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Choose Vet
                </Text>
                <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                  <TouchableOpacity
                    onPress={() => setVetChoice("saved")}
                    style={{
                      flex: 1,
                      paddingVertical: SPACING.sm,
                      alignItems: "center",
                      backgroundColor: vetChoice === "saved" ? colors.accent : colors.bgSecondary,
                      borderRadius: RADIUS.md,
                    }}
                  >
                    <Text style={{
                      ...TYPOGRAPHY.sm,
                      color: vetChoice === "saved" ? colors.white : colors.text,
                      fontWeight: vetChoice === "saved" ? "600" : "500"
                    }}>
                      Use my vet
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setVetChoice("discover")}
                    style={{
                      flex: 1,
                      paddingVertical: SPACING.sm,
                      alignItems: "center",
                      backgroundColor: vetChoice === "discover" ? colors.accent : colors.bgSecondary,
                      borderRadius: RADIUS.md,
                    }}
                  >
                    <Text style={{
                      ...TYPOGRAPHY.sm,
                      color: vetChoice === "discover" ? colors.white : colors.text,
                      fontWeight: vetChoice === "discover" ? "600" : "500"
                    }}>
                      Discover
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.xs }}>
                  {vetChoice === "saved"
                    ? "Saved vet auto-fill will be available in phase 2."
                    : "Clinic search will be available in phase 2. Enter details below for now."}
                </Text>
              </View>

              <Input
                label="Clinic name"
                value={clinicName}
                onChangeText={setClinicName}
                placeholder="e.g., City Animal Clinic"
              />
              <Input
                label="Weight (lb)"
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g., 25.4"
                keyboardType="numeric"
              />
              <Input
                label="Heart Rate (bpm)"
                value={heartRate}
                onChangeText={setHeartRate}
                placeholder="e.g., 140"
                keyboardType="numeric"
              />
              <Input
                label="Respiratory Rate (breaths/min)"
                value={respRate}
                onChangeText={setRespRate}
                placeholder="e.g., 35"
                keyboardType="numeric"
              />
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Attitude
                </Text>
                <View style={{ flexDirection: "row" }}>
                  {attitudeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setAttitude(option.value)}
                      style={{
                        paddingVertical: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                        backgroundColor: attitude === option.value ? colors.accent : colors.bgSecondary,
                        borderRadius: RADIUS.md,
                        marginRight: SPACING.sm,
                      }}
                    >
                      <Text style={{
                        ...TYPOGRAPHY.sm,
                        color: attitude === option.value ? colors.white : colors.text,
                        fontWeight: attitude === option.value ? "600" : "500"
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.xs }}>
                  BAR = Bright Alert Responsive · QAR = Quiet Alert Responsive
                </Text>
              </View>
              <Input
                label="Doctor"
                value={doctorName}
                onChangeText={setDoctorName}
                placeholder="e.g., Dr. Patel"
              />
              <Input
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />
              <Input
                label="Time"
                value={time}
                onChangeText={setTime}
                placeholder="e.g., 2:00 PM"
              />
              <Input
                label="Address"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="Street address"
              />
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="City"
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Input
                    label="State"
                    value={state}
                    onChangeText={setState}
                    placeholder="State"
                  />
                </View>
              </View>
              <Input
                label="ZIP"
                value={zip}
                onChangeText={setZip}
                placeholder="ZIP code"
                keyboardType="number-pad"
              />
              <Input
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Reason or notes"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const loadPdfJs = (() => {
  let loader: Promise<any> | null = null;
  return () => {
    if (Platform.OS !== "web") return Promise.resolve(null);
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
    if (loader) return loader;
    loader = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js";
      script.onload = () => resolve((window as any).pdfjsLib);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return loader;
  };
})();

const ManualHealthStatusModal = ({
  visible,
  onClose,
  onSave,
  initialValues,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => void;
  initialValues?: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string };
}) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  const [heartRate, setHeartRate] = useState(initialValues?.heartRate || "");
  const [respRate, setRespRate] = useState(initialValues?.respiratoryRate || "");
  const [attitude, setAttitude] = useState(initialValues?.attitude || "");
  const [weightError, setWeightError] = useState("");
  const [heartRateError, setHeartRateError] = useState("");
  const [respRateError, setRespRateError] = useState("");

  const parseWeight = (value?: { value: number; unit?: string } | string) => {
    if (!value) {
      setWeight("");
      setWeightUnit("lb");
      return;
    }
    if (typeof value === "object" && "value" in value) {
      setWeight(String(value.value ?? ""));
      setWeightUnit(value.unit === "kg" ? "kg" : "lb");
      return;
    }
    setWeight(String(value));
  };

  useEffect(() => {
    if (!visible) return;
    parseWeight(initialValues?.weight);
    setHeartRate(initialValues?.heartRate || "");
    setRespRate(initialValues?.respiratoryRate || "");
    setAttitude(initialValues?.attitude || "");
    setWeightError("");
    setHeartRateError("");
    setRespRateError("");
  }, [visible, initialValues]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "center", padding: SPACING.lg }}>
        <View style={{
          backgroundColor: colors.card,
          borderRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...SHADOWS.lg
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xs }}>
            <View>
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, letterSpacing: -0.2 }}>
                Update health status
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                Enter current vitals
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: SPACING.md }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: SPACING.md }}>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.textMuted }}>
                Vitals
              </Text>

              <View style={{
                padding: SPACING.sm,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                backgroundColor: colors.cardSecondary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text }}>Weight</Text>
                <View style={{ flexDirection: "row", borderRadius: RADIUS.pill, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight }}>
                  {(["lb", "kg"] as const).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => setWeightUnit(unit)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                        backgroundColor: weightUnit === unit ? colors.accent : "transparent",
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, color: weightUnit === unit ? colors.white : colors.textMuted, fontWeight: "600" }}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                value={weight}
                onChangeText={setWeight}
                placeholder={`e.g., 25.4 ${weightUnit}`}
                keyboardType="decimal-pad"
              />
              {weightError ? (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                  {weightError}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 34, justifyContent: "flex-end" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
                      Heart rate (bpm)
                    </Text>
                  </View>
                  <Input
                    value={heartRate}
                    onChangeText={setHeartRate}
                    placeholder="140"
                    keyboardType="number-pad"
                  />
                  {heartRateError ? (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                      {heartRateError}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 34, justifyContent: "flex-end" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
                      Respiratory rate
                    </Text>
                  </View>
                  <Input
                    value={respRate}
                    onChangeText={setRespRate}
                    placeholder="35"
                    keyboardType="number-pad"
                  />
                  {respRateError ? (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                      {respRateError}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                  Mental status
                </Text>
                <View style={{
                  flexDirection: "row",
                  borderRadius: RADIUS.md,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  backgroundColor: colors.cardSecondary,
                }}>
                  {["BAR", "QAR", "L", "D"].map((code, idx) => (
                    <TouchableOpacity
                      key={code}
                      onPress={() => setAttitude(code)}
                      style={{
                        flex: 1,
                        paddingVertical: SPACING.sm,
                        alignItems: "center",
                        borderRightWidth: idx === 3 ? 0 : 1,
                        borderRightColor: colors.borderLight,
                        backgroundColor: attitude === code ? colors.accent : "transparent",
                      }}
                    >
                      <Text style={{
                        ...TYPOGRAPHY.sm,
                        color: attitude === code ? colors.white : colors.textMuted,
                        fontWeight: attitude === code ? "600" : "500"
                      }}>
                        {code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.xs }}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginLeft: SPACING.xs }}>
                    What do these mean?
                  </Text>
                </View>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.xs }}>
                  BAR: Bright, Alert, Responsive
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  QAR: Quiet, Alert, Responsive
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  L: Lethargic
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  D: Depressed
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={{ height: 1, backgroundColor: colors.borderLight, marginTop: SPACING.lg }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", marginTop: SPACING.sm }}>
            You can update this later.
          </Text>

          <View style={{ flexDirection: "row", marginTop: SPACING.md }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={() => {
                const isNumber = (val: string) => val.trim() === "" || !Number.isNaN(Number(val));
                const nextWeightError = isNumber(weight) ? "" : "Enter a valid weight";
                const nextHeartError = isNumber(heartRate) ? "" : "Enter a valid heart rate";
                const nextRespError = isNumber(respRate) ? "" : "Enter a valid respiratory rate";
                setWeightError(nextWeightError);
                setHeartRateError(nextHeartError);
                setRespRateError(nextRespError);
                if (nextWeightError || nextHeartError || nextRespError) return;
                const parsedWeight = weight.trim() !== ""
                  ? { value: Number(weight), unit: weightUnit }
                  : undefined;
                onSave({ weight: parsedWeight, heartRate, respiratoryRate: respRate, attitude });
              }}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};


export default function HealthScreen() {
  const { colors } = useTheme();
  const { registerAddHealthRecordCallback, navigateTo } = useNavigation();
  const { activePetId, getActivePet } = usePets();
  const { user } = useAuth();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);
  const [actionSheetVariant, setActionSheetVariant] = useState<"list" | "quick">("list");
  const [actionSheetFooter, setActionSheetFooter] = useState<string | undefined>(undefined);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [showVetVisitModal, setShowVetVisitModal] = useState(false);
  const [healthRecordStartMode, setHealthRecordStartMode] = useState<"manual" | "upload">("manual");
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showManualStatusModal, setShowManualStatusModal] = useState(false);
  const [manualStatus, setManualStatus] = useState<{
    updatedAt: string;
    source?: "manual" | "auto";
    weight?: { value: number; unit?: string } | string;
    heartRate?: string;
    respiratoryRate?: string;
    attitude?: string;
  } | null>(null);
  const [manualStatusPrefill, setManualStatusPrefill] = useState<{
    weight?: { value: number; unit?: string } | string;
    heartRate?: string;
    respiratoryRate?: string;
    attitude?: string;
  } | null>(null);
  const [summaryPrefill, setSummaryPrefill] = useState<{
    visitType?: "routine" | "vaccination" | "sick" | "followup" | "emergency";
    date?: string;
    weight?: string;
    heartRate?: string;
    respRate?: string;
    attitude?: "BAR" | "QAR" | "L" | "D";
  } | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<{ type: "pdf"; url: string; name: string } | null>(null);
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);
  const [appointments, setAppointments] = useState<VetAppointment[]>([]);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<VetAppointment | null>(null);
  const [preventive, setPreventive] = useState<PreventiveCare>({
    vaccinesUpToDate: true,
    parasiteControlCurrent: true,
  });
  const [medical, setMedical] = useState<MedicalHistory>({
    chronicConditionsCount: 1,
    medicationCompliance: 80,
    recentSymptomsLogged: 1,
  });
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [activeWellnessTab, setActiveWellnessTab] = useState<"preventive" | "medical" | "weight">("preventive");
  const [wellnessHydrated, setWellnessHydrated] = useState(false);
  const wellnessLoadRef = useRef({ inputs: false, weight: false });
  const wellnessInitialScoreRef = useRef<number | null>(null);
  const wellnessScoreSeededRef = useRef(false);
  const wellnessUserChangedRef = useRef(false);
  const markWellnessUserChanged = useCallback(() => {
    wellnessUserChangedRef.current = true;
  }, []);

  useEffect(() => {
    wellnessLoadRef.current = { inputs: false, weight: false };
    wellnessInitialScoreRef.current = null;
    wellnessScoreSeededRef.current = false;
    setWellnessHydrated(false);
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const loadWellnessInputs = async () => {
      try {
        const remote = await fetchWellnessInputs(user.id, activePetId);
        if (remote?.preventive) setPreventive(remote.preventive);
        if (remote?.medical) setMedical(remote.medical);
        if (typeof remote?.score === "number") {
          wellnessInitialScoreRef.current = remote.score;
        }
        wellnessLoadRef.current.inputs = true;
        setWellnessHydrated(wellnessLoadRef.current.inputs && wellnessLoadRef.current.weight);
      } catch (error) {
        console.error("HealthScreen: Failed to load wellness inputs:", error);
      }
    };
    loadWellnessInputs();
  }, [user?.id, activePetId]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWeightHistory = useCallback(async () => {
    if (!activePetId) {
      setWeightHistory([]);
      return;
    }
    const key = user?.id ? `@kasper_weight_history_${user.id}_${activePetId}` : "";
    let remoteEntries: WeightEntry[] = [];
    if (user?.id) {
      try {
        remoteEntries = await fetchWeightHistory(user.id, activePetId);
      } catch (error) {
        console.error("HealthScreen: Failed to load weight history", error);
      }
    }

    let localEntries: WeightEntry[] = [];
    if (key) {
      const raw = await storage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          localEntries = Array.isArray(parsed) ? parsed : [];
        } catch {
          localEntries = [];
        }
      }
    }

    const merged = normalizeWeightEntries([...remoteEntries, ...localEntries]);
    setWeightHistory(merged);

    wellnessLoadRef.current.weight = true;
    setWellnessHydrated(wellnessLoadRef.current.inputs && wellnessLoadRef.current.weight);

    if (user?.id && merged.length > remoteEntries.length) {
      upsertWeightHistory(user.id, activePetId, merged).catch((error) => {
        console.warn("HealthScreen: Failed to sync weight history", error);
      });
    }
  }, [activePetId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadWeightHistory();
    };
    if (!cancelled) {
      run();
    }
    return () => {
      cancelled = true;
    };
  }, [loadWeightHistory]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadWeightHistory();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWeightHistory]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const key = `@kasper_weight_history_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(weightHistory)).catch(() => {});
  }, [user?.id, activePetId, weightHistory]);

  useEffect(() => {
    registerAddHealthRecordCallback(async () => {
      const mode = await storage.getItem("@kasper_health_record_start_mode");
      if (mode === "upload" || mode === "manual") {
        setHealthRecordStartMode(mode);
      } else {
        setHealthRecordStartMode("manual");
      }
      storage.removeItem("@kasper_health_record_start_mode").catch(() => {});
      setShowAddModal(true);
    });
  }, [registerAddHealthRecordCallback]);

  useEffect(() => {
    const loadTarget = async () => {
      const raw = await storage.getItem("@kasper_notification_target");
      if (!raw) return;
      try {
        const target = JSON.parse(raw);
        if (target?.type === "health" && target?.id) {
          if (target?.action === "edit") {
            const found = healthRecords.find(record => record.id === target.id);
            if (found) {
              setEditingRecord(found);
              setShowEditModal(true);
              storage.removeItem("@kasper_notification_target").catch(() => {});
              return;
            }
          }
          setPendingRecordId(target.id);
        }
      } catch {
        return;
      }
    };
    loadTarget();
  }, [healthRecords, manualStatus]);

  const getStatusValue = (status: any, key: "weight" | "heartRate" | "respiratoryRate" | "attitude") => {
    if (!status) return "N/A";
    const value = status[key];
    if (value && typeof value === "object" && "value" in value) {
      return value.value ?? "N/A";
    }
    return value || "N/A";
  };

  const getStatusUnit = (status: any, key: "weight") => {
    if (!status) return "";
    const value = status[key];
    if (value && typeof value === "object" && "unit" in value) {
      return value.unit || "";
    }
    return "lb";
  };

  const getAppointmentTimestamp = (appointment: VetAppointment) => {
    const dateTs = new Date(appointment.appointmentDate).getTime();
    return Number.isNaN(dateTs) ? 0 : dateTs;
  };

  const nextAppointment = useMemo(() => {
    if (appointments.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appointments
      .filter((appointment) => appointment.status !== "canceled")
      .filter((appointment) => getAppointmentTimestamp(appointment) >= today.getTime())
      .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b));
    return upcoming[0] || null;
  }, [appointments]);

  useEffect(() => {
    const loadHealthRecords = async () => {
      if (!user?.id || !activePetId) {
        setHealthRecords([]);
            return;
          }
      try {
        const remote = await fetchHealthRecords(user.id, activePetId);
        setHealthRecords(remote);
      } catch (error) {
        console.error("HealthScreen: Failed to load health records:", error);
        setHealthRecords([]);
      }
    };

    loadHealthRecords();
  }, [activePetId, user?.id]);

  const weightMetrics = useMemo(() => {
    if (weightHistory.length === 0) {
      return {
        hasHistory: false,
        lastRecordedDaysAgo: 999,
        percentChange: 0,
        hasBaseline: false,
        baselineWeight: null as number | null,
        baselineSampleCount: 0,
        recentSampleCount: 0,
        lastWeight: null as number | null,
        previousWeight: null as number | null,
        lastDate: null as string | null,
      };
    }
    const sorted = [...weightHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];
    const previous = sorted[1];
    const now = new Date();
    const latestDate = new Date(latest.date);
    const lastRecordedDaysAgo = Number.isNaN(latestDate.getTime())
      ? 999
      : Math.max(0, Math.round(daysBetween(now, latestDate)));

    const recentWindowStart = new Date(now.getTime() - WEIGHT_BASELINE_WINDOW_DAYS * MS_PER_DAY);
    const recent = sorted.filter((entry) => {
      const entryDate = new Date(entry.date);
      return !Number.isNaN(entryDate.getTime()) && entryDate >= recentWindowStart;
    });
    const baselineCandidates = recent.filter((entry, idx) => idx !== 0);
    const baselineWeight = median(baselineCandidates.map((entry) => entry.weight));
    const hasBaseline = baselineWeight != null && baselineWeight !== 0;
    const percentChange = hasBaseline
      ? ((latest.weight - (baselineWeight as number)) / (baselineWeight as number)) * 100
      : 0;

    return {
      hasHistory: true,
      lastRecordedDaysAgo,
      percentChange,
      hasBaseline,
      baselineWeight,
      baselineSampleCount: baselineCandidates.length,
      recentSampleCount: recent.length,
      lastWeight: latest.weight,
      previousWeight: previous?.weight ?? null,
      lastDate: latest.date,
    };
  }, [weightHistory]);

  const preventiveScore = useMemo(() => scorePreventive(preventive), [preventive]);
  const medicalScore = useMemo(() => scoreMedical(medical), [medical]);
  const weightScore = useMemo(
    () => (weightMetrics.hasHistory ? scoreWeight(weightMetrics) : 0),
    [weightMetrics]
  );
  const totalScore = useMemo(
    () => clamp(Math.round(preventiveScore + medicalScore + weightScore), 0, 100),
    [preventiveScore, medicalScore, weightScore]
  );
  
  const getScoreLabel = (score: number) => {
    if (score >= 90) return { text: "Excellent", color: colors.success };
    if (score >= 75) return { text: "Good", color: colors.accent };
    if (score >= 60) return { text: "Fair", color: "#f59e0b" };
    return { text: "Needs Attention", color: colors.danger };
  };
  
  const scoreLabel = useMemo(() => getScoreLabel(totalScore), [totalScore, colors]);
  const displayScore = wellnessHydrated ? totalScore : null;
  const displayScoreLabel = wellnessHydrated ? scoreLabel : { text: "Loading", color: colors.textMuted };

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    if (!wellnessHydrated) return;
    const timer = setTimeout(() => {
      upsertWellnessInputs(user.id, activePetId, {
        preventive,
        medical,
        score: totalScore,
      }).catch((error) => {
        console.error("HealthScreen: Failed to save wellness inputs:", error);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [user?.id, activePetId, preventive, medical, totalScore, wellnessHydrated]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    if (!wellnessHydrated) return;
    let cancelled = false;
    const run = async () => {
      try {
        const stored = await storage.getItem(SETTINGS_KEY);
        const settings = stored ? JSON.parse(stored) : {};
        const weightAlertEnabled = settings.weightAlert !== undefined ? settings.weightAlert : true;
        const weightThreshold = settings.weightThreshold !== undefined ? settings.weightThreshold : 5;
        const wellnessUpdatesEnabled = settings.wellnessUpdates !== undefined ? settings.wellnessUpdates : true;
        const wellnessCadence =
          settings.wellnessCadence === "monthly" || settings.wellnessCadence === "weekly"
            ? settings.wellnessCadence
            : "weekly";

        const weightAlertKey = `@kasper_weight_alert_last_${user.id}_${activePetId}`;
        const wellnessScoreKey = `@kasper_wellness_score_last_${user.id}_${activePetId}`;
        const wellnessCadenceKey = `@kasper_wellness_cadence_last_${user.id}_${activePetId}`;

        if (weightAlertEnabled && weightMetrics.hasHistory && weightHistory.length >= 3) {
          const latestDate = weightMetrics.lastDate;
          const latestWeight = weightMetrics.lastWeight;
          const baselineWeight = weightMetrics.baselineWeight;
          const daysSinceLatest = weightMetrics.lastRecordedDaysAgo;
          const hasBaseline = weightMetrics.hasBaseline;

          if (latestDate && latestWeight != null && baselineWeight != null && hasBaseline) {
            if (daysSinceLatest <= WEIGHT_ALERT_RECENT_DAYS) {
              const lastNotified = await storage.getItem(weightAlertKey);
              if (!lastNotified || lastNotified !== latestDate) {
                const pctLatest = Math.abs(((latestWeight - baselineWeight) / baselineWeight) * 100);
                if (pctLatest >= weightThreshold) {
                  const now = new Date();
                  const recentWeights = weightHistory.filter((entry) => {
                    return daysBetween(now, entry.date) <= WEIGHT_ALERT_RECENT_DAYS;
                  });
                  const latestDirection = Math.sign(latestWeight - baselineWeight);
                  const confirmed = recentWeights.some((entry) => {
                    if (entry.date === latestDate) return false;
                    const pct = Math.abs(((entry.weight - baselineWeight) / baselineWeight) * 100);
                    const direction = Math.sign(entry.weight - baselineWeight);
                    return pct >= weightThreshold && direction === latestDirection;
                  });

                  if (confirmed) {
                    await insertNotification(user.id, {
                      petId: activePetId,
                      kind: "health",
                      title: "Weight change detected",
                      message: `Weight changed by ${pctLatest.toFixed(1)}% (threshold ±${weightThreshold}%).`,
                    });
                  } else {
                    await insertNotification(user.id, {
                      petId: activePetId,
                      kind: "health",
                      title: "Re-weigh to confirm",
                      message: "A weight change was detected. Please log another weight to confirm.",
                    });
                  }
                  await storage.setItem(weightAlertKey, latestDate);
                }
              }
            }
          }
        }

        if (wellnessUpdatesEnabled) {
          const now = Date.now();
          const cadenceMs = wellnessCadence === "monthly"
            ? 1000 * 60 * 60 * 24 * 30
            : 1000 * 60 * 60 * 24 * 7;
          const lastCadenceRaw = await storage.getItem(wellnessCadenceKey);
          const lastCadenceTs = lastCadenceRaw ? new Date(lastCadenceRaw).getTime() : 0;
          const cadenceDue = !Number.isFinite(lastCadenceTs) || now - lastCadenceTs >= cadenceMs;

          if (cadenceDue) {
            await insertNotification(user.id, {
              petId: activePetId,
              kind: "health",
              title: wellnessCadence === "monthly" ? "Monthly wellness summary" : "Weekly wellness summary",
              message: `Current wellness score: ${totalScore}/100.`,
            });
            await storage.setItem(wellnessCadenceKey, new Date(now).toISOString());
          }

          const lastScoreRaw = await storage.getItem(wellnessScoreKey);
          if (!wellnessScoreSeededRef.current) {
            const seedScore = wellnessInitialScoreRef.current ?? totalScore;
            await storage.setItem(wellnessScoreKey, `${seedScore}`);
            wellnessScoreSeededRef.current = true;
          } else if (!lastScoreRaw) {
            await storage.setItem(wellnessScoreKey, `${totalScore}`);
          } else if (wellnessUserChangedRef.current) {
            const lastScore = Number(lastScoreRaw);
            if (!Number.isNaN(lastScore) && Math.abs(totalScore - lastScore) >= 1) {
              await insertNotification(user.id, {
                petId: activePetId,
                kind: "health",
                title: "Wellness score updated",
                message: `Score changed from ${lastScore} to ${totalScore}.`,
              });
            }
            await storage.setItem(wellnessScoreKey, `${totalScore}`);
            wellnessUserChangedRef.current = false;
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("HealthScreen: Failed to evaluate health alerts", error);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activePetId, weightHistory, weightMetrics, totalScore]);

  const wellnessTabs: { key: "preventive" | "medical" | "weight"; label: string }[] = [
    { key: "preventive", label: "Preventive Care" },
    { key: "medical", label: "Medical History" },
    { key: "weight", label: "Weight & Check-ins" },
  ];

  const filteredRecords = healthRecords.filter(record => 
    selectedFilter === "all" || record.type === selectedFilter
  );
  const latestExtractedRecord = useMemo(() => {
    const entries = healthRecords
      .map((record) => {
        const recordTime = record.createdAt || record.date || new Date().toISOString();
        const extracted = (record.pdfs || [])
          .map((pdf) => pdf.extracted)
          .find((item) => item);
        if (!extracted) return null;
        return { extracted, recordTime };
      })
      .filter(Boolean) as { extracted: any; recordTime: string }[];
    if (entries.length === 0) return null;
    entries.sort((a, b) => new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime());
    return entries[0] || null;
  }, [healthRecords]);

  const latestExtractedStatus = useMemo(() => {
    if (!manualStatus && !latestExtractedRecord) return null;
    if (!manualStatus) return latestExtractedRecord?.extracted || null;
    if (!latestExtractedRecord) return manualStatus;
    const manualTime = new Date(manualStatus.updatedAt).getTime();
    const extractedTime = new Date(latestExtractedRecord.recordTime).getTime();
    if (!Number.isFinite(manualTime)) return latestExtractedRecord.extracted;
    if (!Number.isFinite(extractedTime)) return manualStatus;
    return manualTime >= extractedTime ? manualStatus : latestExtractedRecord.extracted;
  }, [manualStatus, latestExtractedRecord]);

  const latestStatusMeta = useMemo(() => {
    if (!manualStatus && !latestExtractedRecord) return null;
    if (!manualStatus) {
      return {
        source: "From PDF",
        ts: new Date(latestExtractedRecord?.recordTime || Date.now()).getTime(),
      };
    }
    if (!latestExtractedRecord) {
      return {
        source: manualStatus.source === "auto" ? "From PDF" : "Manual entry",
        ts: new Date(manualStatus.updatedAt).getTime(),
      };
    }
    const manualTime = new Date(manualStatus.updatedAt).getTime();
    const extractedTime = new Date(latestExtractedRecord.recordTime).getTime();
    if (!Number.isFinite(manualTime)) return { source: "From PDF", ts: extractedTime };
    if (!Number.isFinite(extractedTime)) {
      return {
        source: manualStatus.source === "auto" ? "From PDF" : "Manual entry",
        ts: manualTime,
      };
    }
    return manualTime >= extractedTime
      ? { source: manualStatus.source === "auto" ? "From PDF" : "Manual entry", ts: manualTime }
      : { source: "From PDF", ts: extractedTime };
  }, [manualStatus, latestExtractedRecord]);

  const latestWeightEntry = useMemo(() => {
    if (!weightHistory.length) return null;
    return weightHistory[0] || null;
  }, [weightHistory]);

  const latestWeightTs = useMemo(() => {
    if (!latestWeightEntry) return null;
    const ts = new Date(latestWeightEntry.date).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [latestWeightEntry]);

  const healthStatusMeta = useMemo(() => {
    if (latestWeightTs && (!latestStatusMeta || latestWeightTs > latestStatusMeta.ts)) {
      return { source: "Weight history", ts: latestWeightTs };
    }
    return latestStatusMeta;
  }, [latestStatusMeta, latestWeightTs]);

  useEffect(() => {
    if (!pendingRecordId || healthRecords.length === 0) return;
    const exists = healthRecords.some(record => record.id === pendingRecordId);
    if (!exists) return;
    setHighlightedRecordId(pendingRecordId);
    storage.removeItem("@kasper_notification_target").catch(() => {});
    setPendingRecordId(null);
    setTimeout(() => setHighlightedRecordId(null), 6000);
  }, [pendingRecordId, healthRecords]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const loadPrefill = async () => {
      const key = `@kasper_health_status_prefill_${user.id}_${activePetId}`;
      const raw = await storage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        setSummaryPrefill(parsed);
        setShowVetVisitModal(true);
      } catch {
        return;
      } finally {
        storage.removeItem(key).catch(() => {});
      }
    };
    loadPrefill();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setAppointments([]);
      return;
    }
    const key = `@kasper_vet_appointments_${user.id}_${activePetId}`;
    const loadAppointments = async () => {
      const raw = await storage.getItem(key);
      if (!raw) {
        setAppointments([]);
        return;
      }
      try {
        setAppointments(JSON.parse(raw));
      } catch {
        setAppointments([]);
      }
    };
    loadAppointments();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setManualStatus(null);
      return;
    }
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    const loadManualStatus = async () => {
      const raw = await storage.getItem(key);
      if (!raw) {
        setManualStatus(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setManualStatus(parsed);
      } catch {
        setManualStatus(null);
      }
    };
    loadManualStatus();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!manualStatus?.weight) return;
    const weightValue = typeof manualStatus.weight === "object" && "value" in manualStatus.weight
      ? Number(manualStatus.weight.value)
      : Number(manualStatus.weight);
    if (!Number.isFinite(weightValue)) return;
    addWeightEntry({
      weight: weightValue,
      date: manualStatus.updatedAt || new Date().toISOString(),
      source: manualStatus.source === "auto" ? "pdf" : "manual",
    });
  }, [manualStatus]);


  const handleSaveManualStatus = async (payload: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => {
    if (!user?.id || !activePetId) return;
    const base = latestExtractedStatus || manualStatus || {};
    const nextWeight = payload.weight ?? (base as any).weight ?? undefined;
    const next = {
      updatedAt: new Date().toISOString(),
      source: "manual" as const,
      weight: nextWeight,
      heartRate: payload.heartRate?.trim() || (base as any).heartRate || undefined,
      respiratoryRate: payload.respiratoryRate?.trim() || (base as any).respiratoryRate || undefined,
      attitude: payload.attitude?.trim() || (base as any).attitude || undefined,
    };
    if (payload.weight) {
      const weightValue = typeof payload.weight === "object" && "value" in payload.weight
        ? Number(payload.weight.value)
        : Number(payload.weight);
      if (Number.isFinite(weightValue)) {
        markWellnessUserChanged();
        addWeightEntry({ weight: weightValue, date: next.updatedAt, source: "manual" });
      }
    }
    setManualStatus(next);
    setShowManualStatusModal(false);
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(next)).catch(() => {});
  };

  const buildManualPrefill = (extracted: any) => {
    if (!extracted) return null;
    const prefill = {
      weight: normalizeStatusValue(extracted.weight),
      heartRate: normalizeStatusValue(extracted.heartRate),
      respiratoryRate: normalizeStatusValue(extracted.respiratoryRate),
      attitude: normalizeStatusValue(extracted.attitude),
    };
    if (!prefill.weight && !prefill.heartRate && !prefill.respiratoryRate && !prefill.attitude) {
      return null;
    }
    return prefill;
  };

  const normalizeStatusValue = (value: any) => {
    if (value == null) return undefined;
    if (typeof value === "object" && "value" in value) {
      return value.value != null ? String(value.value) : undefined;
    }
    if (typeof value === "string") return value.trim() || undefined;
    if (typeof value === "number") return String(value);
    return undefined;
  };

  const toValidDateIso = (value?: string) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  };

  const normalizeWeightEntries = (entries: WeightEntry[]) => {
    const next = entries
      .filter((item) => Number.isFinite(item.weight))
      .filter((item) => !Number.isNaN(new Date(item.date).getTime()));
    const deduped = new Map<string, WeightEntry>();
    next.forEach((item) => {
      deduped.set(`${item.date}|${item.weight}`, item);
    });
    return Array.from(deduped.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const addWeightEntry = (entry: WeightEntry) => {
    setWeightHistory((prev) => {
      return normalizeWeightEntries([...prev, entry]);
    });
    const isValidEntry =
      Number.isFinite(entry.weight) && !Number.isNaN(new Date(entry.date).getTime());
    if (isValidEntry && user?.id && activePetId) {
      upsertWeightHistory(user.id, activePetId, [entry]).catch((error) => {
        console.warn("HealthScreen: Failed to sync weight entry", error);
      });
    }
  };

  const buildMergedStatusFromExtracted = (extracted: any, fallback: any) => {
    if (!extracted) return null;
    const next = {
      updatedAt: new Date().toISOString(),
      source: "auto" as const,
      weight: normalizeStatusValue(extracted.weight) ?? normalizeStatusValue(fallback?.weight),
      heartRate: normalizeStatusValue(extracted.heartRate) ?? normalizeStatusValue(fallback?.heartRate),
      respiratoryRate: normalizeStatusValue(extracted.respiratoryRate) ?? normalizeStatusValue(fallback?.respiratoryRate),
      attitude: normalizeStatusValue(extracted.attitude) ?? normalizeStatusValue(fallback?.attitude),
    };
    if (!next.weight && !next.heartRate && !next.respiratoryRate && !next.attitude) {
      return null;
    }
    return next;
  };

  const persistManualStatus = async (next: any) => {
    if (!user?.id || !activePetId || !next) return;
    setManualStatus(next);
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(next)).catch(() => {});
  };

  const getMissingVitals = (extracted: any) => {
    if (!extracted) return ["weight", "heartRate", "respiratoryRate", "attitude"];
    const missing = [];
    if (!normalizeStatusValue(extracted.weight)) missing.push("weight");
    if (!normalizeStatusValue(extracted.heartRate)) missing.push("heartRate");
    if (!normalizeStatusValue(extracted.respiratoryRate)) missing.push("respiratoryRate");
    if (!normalizeStatusValue(extracted.attitude)) missing.push("attitude");
    return missing;
  };

  const buildVetLabel = (extracted: any) => {
    if (!extracted) return undefined;
    const doctor = extracted.doctorName?.value || "";
    const clinic = extracted.clinicName?.value || "";
    if (doctor && clinic) return `${doctor} · ${clinic}`;
    return doctor || clinic || undefined;
  };

  const handleSaveRecord = async (recordData: Omit<HealthRecord, "id">) => {
    if (!user?.id || !activePetId) {
      Alert.alert("Sign in required", "Please sign in to save health records.");
      return;
    }
    try {
      let attachments = recordData.pdfs || [];
      if (attachments.length > 0) {
        const uploaded = await Promise.all(
          attachments.map(async pdf => {
            if (pdf.path) return pdf;
            try {
              const upload = await uploadHealthAttachment(user.id, pdf.uri, pdf.name);
              return { ...pdf, uri: upload.uri, path: upload.path };
            } catch (error) {
              console.error("HealthScreen: Failed to upload attachment", error);
              return pdf;
            }
          })
        );
        attachments = uploaded;
      }

      if (attachments.length > 0) {
        const enriched = await Promise.all(
          attachments.map(async pdf => {
            if (!pdf.path) return pdf;
            try {
              let rawText: string | undefined;
              if (Platform.OS === "web" && pdf.uri) {
                const pdfjsLib = await loadPdfJs();
                if (pdfjsLib) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
                  const resp = await fetch(pdf.uri);
                  const buffer = await resp.arrayBuffer();
                  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
                  let text = "";
                  for (let i = 1; i <= doc.numPages; i += 1) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
                  }
                  rawText = text;
                }
              }
              const extraction = await analyzeClinicalSummary(pdf.path, rawText, activePetId || undefined);
              if (extraction?.normalized) {
                return { ...pdf, extracted: extraction.normalized };
              }
            } catch (error) {
              console.warn("HealthScreen: Clinical summary extraction failed", error);
            }
            return pdf;
          })
        );
        attachments = enriched;
      }

      const extracted = attachments
        .map((pdf) => pdf.extracted)
        .find((item) => item);
      const inferredVet = buildVetLabel(extracted);
      const resolvedVet = recordData.vet || inferredVet;

      const inserted = await insertHealthRecord(user.id, activePetId, {
        ...recordData,
        vet: resolvedVet,
        pdfs: attachments.length > 0 ? attachments : undefined,
      });

      const newRecord: HealthRecord = {
        ...recordData,
        id: inserted.id,
        vet: resolvedVet,
        pdfs: attachments.length > 0 ? attachments : undefined,
      };
      setHealthRecords(prev => [newRecord, ...prev]);
      insertNotification(user.id, {
        petId: activePetId,
        kind: "health",
        title: "Health record added",
        message: recordData.title ? `Added: ${recordData.title}.` : "A new health record was added.",
        ctaLabel: "View health",
        metadata: { type: "health_record", recordId: inserted.id },
      }).catch(error => {
        console.error("HealthScreen: Failed to create notification:", error);
      });
      const previous = healthRecords.find(record => record.type === recordData.type && record.date);
      if (previous?.date) {
        const recordDate = new Date(recordData.date);
        const prevDate = new Date(previous.date);
        if (!Number.isNaN(recordDate.getTime()) && !Number.isNaN(prevDate.getTime())) {
          const deltaDays = Math.abs(
            Math.round((recordDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          if (deltaDays >= 30) {
            insertNotification(user.id, {
              petId: activePetId,
              kind: "health",
              title: "Health trend update",
              message: `Last ${recordData.type} was ${deltaDays} days ago.`,
              ctaLabel: "View health",
              metadata: { type: "health_trend", recordId: inserted.id, deltaDays },
            }).catch(error => {
              console.error("HealthScreen: Failed to create trend notification:", error);
            });
          }
        }
      }

      if (attachments.length > 0) {
        const extractedWeight = normalizeStatusValue(extracted?.weight);
        if (extractedWeight) {
          const weightValue = Number(extractedWeight);
          if (Number.isFinite(weightValue)) {
            markWellnessUserChanged();
            addWeightEntry({
              weight: weightValue,
              date: toValidDateIso(recordData.date),
              source: "pdf",
            });
          }
        }
        const prefill = buildManualPrefill(extracted);
        const missing = getMissingVitals(extracted);
        const fallbackStatus = latestExtractedStatus || manualStatus;
        const mergedStatus = buildMergedStatusFromExtracted(extracted, fallbackStatus);
        if (mergedStatus) {
          persistManualStatus(mergedStatus).catch(() => {});
        }
        if (missing.length > 0) {
          Alert.alert(
            "Health record added",
            "Some vitals were missing. Do you want to enter them now?",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Enter manually",
                onPress: () => {
                  setManualStatusPrefill(prefill);
                  setShowManualStatusModal(true);
                },
              },
            ]
          );
        } else {
          Alert.alert("Success", "Health record added successfully!");
        }
      } else {
        Alert.alert("Success", "Health record added successfully!");
      }
    } catch (error) {
      console.error("HealthScreen: Failed to save health record:", error);
      Alert.alert("Error", "Could not save health record. Please try again.");
    }
  };

  const saveRecordEdits = async (recordData: Omit<HealthRecord, "id">) => {
    if (!user?.id || !editingRecord) return;
    try {
      let attachments = recordData.pdfs || [];
      if (attachments.length > 0) {
        const uploaded = await Promise.all(
          attachments.map(async pdf => {
            if (pdf.path) return pdf;
            try {
              const upload = await uploadHealthAttachment(user.id, pdf.uri, pdf.name);
              return { ...pdf, uri: upload.uri, path: upload.path };
            } catch (error) {
              console.error("HealthScreen: Failed to upload attachment", error);
              return pdf;
            }
          })
        );
        attachments = uploaded;
      }

      if (attachments.length > 0) {
        const enriched = await Promise.all(
          attachments.map(async pdf => {
            if (!pdf.path) return pdf;
            if (pdf.extracted) return pdf;
            try {
              let rawText: string | undefined;
              if (Platform.OS === "web" && pdf.uri) {
                const pdfjsLib = await loadPdfJs();
                if (pdfjsLib) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
                  const resp = await fetch(pdf.uri);
                  const buffer = await resp.arrayBuffer();
                  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
                  let text = "";
                  for (let i = 1; i <= doc.numPages; i += 1) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
                  }
                  rawText = text;
                }
              }
              const extraction = await analyzeClinicalSummary(pdf.path, rawText, activePetId || undefined);
              if (extraction?.normalized) {
                return { ...pdf, extracted: extraction.normalized };
              }
            } catch (error) {
              console.warn("HealthScreen: Clinical summary extraction failed", error);
            }
            return pdf;
          })
        );
        attachments = enriched;
      }

      await updateHealthRecord(user.id, editingRecord.id, {
        ...recordData,
        pdfs: attachments.length > 0 ? attachments : undefined,
      });
      setHealthRecords(prev =>
        prev.map(record =>
          record.id === editingRecord.id
            ? { ...record, ...recordData, pdfs: attachments.length > 0 ? attachments : undefined }
            : record
        )
      );
      setShowEditModal(false);
      setEditingRecord(null);
      Alert.alert("Saved", "Health record updated successfully!");
    } catch (error) {
      console.error("HealthScreen: Failed to update health record", error);
      Alert.alert("Error", "Could not update health record. Please try again.");
    }
  };

  const removeHealthRecord = async (recordId: string) => {
    if (!user?.id) return;
    try {
      setHealthRecords(prev => prev.filter(record => record.id !== recordId));
      await deleteHealthRecord(user.id, recordId);
      if (editingRecord?.id === recordId) {
        setShowEditModal(false);
        setEditingRecord(null);
      }
    } catch (error) {
      console.error("HealthScreen: Failed to delete health record", error);
      Alert.alert("Error", "Could not delete health record. Please try again.");
    }
  };

  const openHealthActions = (record: HealthRecord) => {
    setActionSheetVariant("list");
    setActionSheetTitle("Health record");
    setActionSheetFooter(undefined);
    setActionSheetOptions([
      {
        label: "Edit",
        icon: "create-outline",
        onPress: () => {
          setEditingRecord(record);
          setShowEditModal(true);
        },
      },
      {
        label: "Delete",
        icon: "trash-outline",
        onPress: () => removeHealthRecord(record.id),
      },
    ]);
    setActionSheetVisible(true);
  };

  const handleViewPDF = async (pdf: PDFAttachment) => {
    let url = pdf.uri;
    if (pdf.path) {
      url = (await getHealthAttachmentViewUrl(pdf.path)) || url;
    }
    if (!url) {
      Alert.alert("Attachment unavailable", "This attachment does not have a viewable link yet.");
      return;
    }
    setSelectedAttachment({ type: "pdf", url, name: pdf.name });
    setShowAttachmentViewer(true);
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screen Header */}
      <ScreenHeader
        title="Health"
        actionIcon="paw"
        onActionPress={() => setShowAddModal(true)}
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
      />

      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 120
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Header */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.lg,
          backgroundColor: colors.bg,
        }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
            Track {petNamePossessive} health and medical history
          </Text>
        </View>

        {/* Wellness Score */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <Card>
            <View style={{ paddingVertical: SPACING.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                    Wellness Score
                  </Text>
                  {healthStatusMeta && (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 4 }}>
                      Updated {timeAgo(healthStatusMeta.ts)} ago
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: SPACING.sm }}>
                    <Text style={{ ...TYPOGRAPHY["3xl"], fontWeight: "800", color: displayScoreLabel.color }}>
                      {displayScore ?? "--"}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginLeft: SPACING.sm }}>
                      {displayScoreLabel.text}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
                  <Svg width="120" height="120" viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="52" stroke={colors.borderLight} strokeWidth="10" fill="none" />
                    <Circle
                      cx="60"
                      cy="60"
                      r="52"
                      stroke={colors.accent}
                      strokeWidth="10"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 52}
                      strokeDashoffset={2 * Math.PI * 52 * (1 - (displayScore ?? 0) / 100)}
                      transform="rotate(-90 60 60)"
                    />
                  </Svg>
                  <View style={{ position: "absolute", alignItems: "center" }}>
                    <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "700", color: colors.text }}>
                      {displayScore ?? "--"}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>out of 100</Text>
                  </View>
                </View>
              </View>

              {/* Health Status */}
              <View style={{ marginTop: SPACING.lg }}>
                <View style={{ marginBottom: SPACING.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                      Health Status
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                      {healthStatusMeta && (
                        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                          {healthStatusMeta.source} · {timeAgo(healthStatusMeta.ts)} ago
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setActionSheetVariant("quick");
                          setActionSheetTitle("Update health status");
                          setActionSheetFooter("You can edit your health record later.");
                          setActionSheetOptions([
                            {
                              label: "Upload PDF",
                              icon: "cloud-upload-outline",
                              iconColor: "#7C3AED",
                              subtitle: "Auto-fill from receipt",
                              onPress: () => {
                                storage.setItem("@kasper_health_record_start_mode", "upload");
                                setShowAddModal(true);
                              },
                            },
                            {
                              label: "Add manually",
                              icon: "create-outline",
                              iconColor: "#64748B",
                              subtitle: "Enter details yourself",
                              onPress: () => setShowManualStatusModal(true),
                            },
                          ]);
                          setActionSheetVisible(true);
                        }}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: RADIUS.pill,
                          backgroundColor: colors.bgSecondary,
                          borderWidth: 1,
                          borderColor: colors.borderLight,
                        }}
                      >
                        <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, fontWeight: "600" }}>Update</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View style={{ gap: SPACING.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Weight</Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                      {latestWeightEntry?.weight ?? getStatusValue(latestExtractedStatus, "weight")}{" "}
                      {latestWeightEntry ? "lb" : getStatusUnit(latestExtractedStatus, "weight")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Heart Rate</Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                      {getStatusValue(latestExtractedStatus, "heartRate")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Respiratory Rate</Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                      {getStatusValue(latestExtractedStatus, "respiratoryRate")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Attitude</Text>
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                      {getStatusValue(latestExtractedStatus, "attitude")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowScoreBreakdown(true)}
                  style={{
                    marginTop: SPACING.md,
                    paddingVertical: SPACING.sm,
                    alignItems: "center",
                    borderRadius: RADIUS.md,
                    backgroundColor: colors.bgSecondary,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>Score Breakdown</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm }}>
            Adjust the inputs to see how routine care impacts {petNamePossessive} wellness.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPreventive({ vaccinesUpToDate: true, parasiteControlCurrent: true });
              setMedical({ chronicConditionsCount: 1, medicationCompliance: 80, recentSymptomsLogged: 1 });
            }}
            activeOpacity={0.85}
            style={{
              width: "100%",
              backgroundColor: colors.cardSecondary,
              borderWidth: 1,
              borderColor: colors.borderLight,
              borderRadius: RADIUS.xl,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.lg,
              ...SHADOWS.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.accent + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: SPACING.sm,
                  }}
                >
                  <Ionicons name="refresh" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
                    Reset wellness inputs
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                    Restore default values
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <Button title="Schedule Vet Visit" onPress={() => setShowVetVisitModal(true)} />
          {nextAppointment && (
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: SPACING.sm }}>
              Next visit:{" "}
              {new Date(nextAppointment.appointmentDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {nextAppointment.appointmentTime ? ` • ${nextAppointment.appointmentTime}` : ""}
              {nextAppointment.clinicName ? ` • ${nextAppointment.clinicName}` : ""}
            </Text>
          )}
        </View>

        {/* Health History */}
        <View style={{ 
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg
        }}>
          <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "600", marginBottom: SPACING.md, color: colors.text }}>
            Health History
          </Text>
          
          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ marginBottom: SPACING.md, paddingRight: SPACING.lg }}
          >
            {filterOptions.map((option, index) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={selectedFilter === option.value}
                onPress={() => setSelectedFilter(option.value)}
                style={{ marginRight: index < filterOptions.length - 1 ? SPACING.sm : 0 }}
              />
            ))}
          </ScrollView>

          {/* Health Records */}
          {filteredRecords.length === 0 ? (
            <Card>
              <EmptyState
                icon="medical-outline"
                title="No health records yet"
                subtitle="Add vaccinations, checkups, or medications."
                ctaLabel="Add health record"
                onPress={() => setShowAddModal(true)}
              />
            </Card>
          ) : (
            filteredRecords.map(record => (
              <HealthCard
                key={record.id}
                record={record}
                onViewPDF={handleViewPDF}
                highlighted={record.id === highlightedRecordId}
                onOpenActions={() => openHealthActions(record)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <AddHealthRecordModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveRecord}
        startMode={healthRecordStartMode}
        petId={activePetId}
        userId={user?.id || null}
      />

      <AddHealthRecordModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRecord(null);
        }}
        onSave={saveRecordEdits}
        onDelete={() => editingRecord && removeHealthRecord(editingRecord.id)}
        initialRecord={editingRecord}
        petId={activePetId}
        userId={user?.id || null}
      />

      <ActionSheet
        visible={actionSheetVisible}
        title={actionSheetTitle}
        options={actionSheetOptions}
        variant={actionSheetVariant}
        footerText={actionSheetFooter}
        onClose={() => {
          setActionSheetVisible(false);
          setActionSheetFooter(undefined);
        }}
      />

      <ManualHealthStatusModal
        visible={showManualStatusModal}
        onClose={() => {
          setShowManualStatusModal(false);
          setManualStatusPrefill(null);
        }}
        onSave={handleSaveManualStatus}
        initialValues={manualStatusPrefill || manualStatus || undefined}
      />

      <Modal visible={showScoreBreakdown} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            paddingTop: SPACING.lg,
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.xl,
            maxHeight: "90%"
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
                Score Breakdown
              </Text>
              <TouchableOpacity onPress={() => setShowScoreBreakdown(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                  paddingHorizontal: SPACING.xs,
                  gap: SPACING.sm
                }}
              >
                {wellnessTabs.map((tab) => {
                  const isActive = activeWellnessTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setActiveWellnessTab(tab.key)}
                      style={{
                        paddingVertical: SPACING.sm,
                        paddingHorizontal: SPACING.sm,
                        alignItems: "center",
                        flexShrink: 0
                      }}
                    >
                      <View style={{ alignItems: "center" }}>
                        <Text
                          style={{
                            ...TYPOGRAPHY.sm,
                            fontWeight: isActive ? "700" : "600",
                            color: isActive ? colors.accent : colors.textMuted
                          }}
                        >
                          {tab.label}
                        </Text>
                        <View
                          style={{
                            height: 3,
                            alignSelf: "stretch",
                            backgroundColor: isActive ? colors.accent : "transparent",
                            marginTop: SPACING.xs,
                            borderRadius: RADIUS.pill
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ paddingTop: SPACING.lg }}>
                {activeWellnessTab === "preventive" && (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                      <Ionicons name="medical" size={18} color={colors.accent} style={{ marginRight: SPACING.xs }} />
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                        Preventive Care · <Text style={{ color: colors.textMuted }}>Score {preventiveScore}/50</Text>
                      </Text>
                    </View>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm }}>
                      Tracks routine prevention. Vaccines and parasite control each add points toward the total.
                    </Text>
                    <ProgressBar value={preventiveScore} max={50} />
                    <View style={{ marginTop: SPACING.sm }}>
                      <ToggleRow
                        label="Vaccines up-to-date"
                        value={preventive.vaccinesUpToDate}
                        onChange={(v) => {
                          markWellnessUserChanged();
                          setPreventive(prev => ({ ...prev, vaccinesUpToDate: v }));
                        }}
                      />
                      <ToggleRow
                        label="Parasite control current"
                        value={preventive.parasiteControlCurrent}
                        onChange={(v) => {
                          markWellnessUserChanged();
                          setPreventive(prev => ({ ...prev, parasiteControlCurrent: v }));
                        }}
                      />
                    </View>
                  </View>
                )}

                {activeWellnessTab === "medical" && (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                      <Ionicons name="bandage" size={18} color={colors.accent} style={{ marginRight: SPACING.xs }} />
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                        Medical History · <Text style={{ color: colors.textMuted }}>Score {medicalScore}/30</Text>
                      </Text>
                    </View>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm }}>
                      Fewer chronic conditions and higher medication compliance increase this score.
                    </Text>
                    <ProgressBar value={medicalScore} max={30} />
                    <View style={{ marginTop: SPACING.sm }}>
                      <NumberAdjustRow
                        label="Chronic conditions"
                        value={medical.chronicConditionsCount}
                        min={0}
                        max={5}
                        onChange={(v) => {
                          markWellnessUserChanged();
                          setMedical(prev => ({ ...prev, chronicConditionsCount: v }));
                        }}
                      />
                      <NumberAdjustRow
                        label="Medication compliance"
                        value={medical.medicationCompliance}
                        min={0}
                        max={100}
                        step={5}
                        suffix="%"
                        onChange={(v) => {
                          markWellnessUserChanged();
                          setMedical(prev => ({ ...prev, medicationCompliance: v }));
                        }}
                      />
                      <NumberAdjustRow
                        label="Symptoms logged (30d)"
                        value={medical.recentSymptomsLogged}
                        min={0}
                        max={10}
                        onChange={(v) => {
                          markWellnessUserChanged();
                          setMedical(prev => ({ ...prev, recentSymptomsLogged: v }));
                        }}
                      />
                    </View>
                  </View>
                )}

                {activeWellnessTab === "weight" && (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                      <Ionicons name="barbell" size={18} color={colors.accent} style={{ marginRight: SPACING.xs }} />
                      <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                        Weight & Check-ins · <Text style={{ color: colors.textMuted }}>Score {weightScore}/20</Text>
                      </Text>
                    </View>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.sm }}>
                      Recent weight logs and smaller changes score higher. Longer gaps or big swings lower it.
                    </Text>
                    <ProgressBar value={weightScore} max={20} />
                    <View style={{ marginTop: SPACING.sm, gap: SPACING.sm }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Last weight log</Text>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                          {weightMetrics.hasHistory && weightMetrics.lastDate
                            ? `${new Date(weightMetrics.lastDate).toLocaleDateString()}`
                            : "N/A"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Days since last</Text>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                          {weightMetrics.hasHistory ? `${weightMetrics.lastRecordedDaysAgo} d` : "N/A"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Change vs baseline</Text>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                          {weightMetrics.hasHistory && weightMetrics.hasBaseline
                            ? `${Math.round(weightMetrics.percentChange)}%`
                            : "N/A"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScheduleVetVisitModal
        visible={showVetVisitModal}
        onClose={() => setShowVetVisitModal(false)}
        initialValues={summaryPrefill || undefined}
        onPrefillApplied={() => setSummaryPrefill(null)}
        onSave={(appointment) => {
          if (!user?.id || !activePetId) return;
          const next = [...appointments, appointment];
          setAppointments(next);
          const key = `@kasper_vet_appointments_${user.id}_${activePetId}`;
          storage.setItem(key, JSON.stringify(next)).catch(() => {});
        }}
      />

      {selectedAttachment && (
        <ReceiptViewer
          visible={showAttachmentViewer}
          onClose={() => {
            setShowAttachmentViewer(false);
            setSelectedAttachment(null);
          }}
          receipt={selectedAttachment}
        />
      )}
    </View>
  );
}

