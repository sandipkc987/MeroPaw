import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, Switch, Platform, ActivityIndicator } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { timeAgo } from "@src/utils/helpers";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { Button, Card, Chip, Input } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import ReceiptViewer from "@src/components/ReceiptViewer";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Circle } from "react-native-svg";
import { fetchHealthRecords, insertHealthRecord, updateHealthRecord, deleteHealthRecord, uploadHealthAttachment, insertNotification, fetchVetAppointments, insertVetAppointment, updateVetAppointment, deleteVetAppointment, fetchWellnessInputs, upsertWellnessInputs, getHealthAttachmentViewUrl } from "@src/services/supabaseData";
import analyzeClinicalSummary from "@src/services/clinicalSummaryAnalysis";
import storage from "@src/utils/storage";

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

type PreventiveCare = {
  vaccinesUpToDate: boolean;
  parasiteControlCurrent: boolean;
};

type MedicalHistory = {
  chronicConditionsCount: number;
  medicationCompliance: number;
  recentSymptomsLogged: number;
};

type WeightStatus = {
  lastRecordedMonthsAgo: number;
  percentChange: number;
};

type WeightEntry = {
  weight: number;
  date: string;
  source?: "manual" | "pdf";
};

const scorePreventive = (p: PreventiveCare) => {
  let score = 0;
  score += p.vaccinesUpToDate ? 35 : 0;
  score += p.parasiteControlCurrent ? 15 : 0;
  return clamp(score, 0, 50);
};

const scoreMedical = (m: MedicalHistory) => {
  let score = 30 - Math.min(m.chronicConditionsCount * 5, 15);
  const compliancePenalty = clamp(10 - m.medicationCompliance / 10, 0, 10);
  score -= compliancePenalty;
  score -= Math.min(m.recentSymptomsLogged, 5);
  return clamp(score, 0, 30);
};

const scoreWeight = (w: WeightStatus) => {
  let score = 0;
  if (w.lastRecordedMonthsAgo <= 3) score += 10;
  else if (w.lastRecordedMonthsAgo <= 6) score += 6;
  else if (w.lastRecordedMonthsAgo <= 12) score += 3;

  const pct = Math.abs(w.percentChange);
  if (pct < 5) score += 10;
  else if (pct < 10) score += 6;
  else if (pct < 15) score += 2;

  return clamp(score, 0, 20);
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgSecondary, true: colors.accent + "55" }}
        thumbColor={value ? colors.accent : colors.white}
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
  const [vet, setVet] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfs, setPdfs] = useState<PDFAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"success" | "warning" | null>(null);
  const [autoPickDone, setAutoPickDone] = useState(false);
  const isEdit = !!initialRecord;
  const lastAnalyzedRef = useRef<string | null>(null);

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
      await onSave({
      type,
      title: title.trim(),
      date,
      vet: vet.trim() || undefined,
      notes: notes.trim() || undefined,
      pdfs: pdfs.length > 0 ? pdfs : undefined,
    });
    // Reset form
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVet("");
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

  useEffect(() => {
    if (!visible) return;
    if (initialRecord) {
      setTitle(initialRecord.title || "");
      setType(initialRecord.type || "checkup");
      setDate(initialRecord.date || new Date().toISOString().split('T')[0]);
      setVet(initialRecord.vet || "");
      setNotes(initialRecord.notes || "");
      setPdfs(initialRecord.pdfs || []);
      return;
    }
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVet("");
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
              const parsed = new Date(visitDate);
              if (!Number.isNaN(parsed.getTime())) {
                setDate(parsed.toISOString().split("T")[0]);
              }
            }
            const doctor = extraction?.normalized?.doctorName?.value;
            const clinic = extraction?.normalized?.clinicName?.value;
            const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
            if (vetLabel) {
              setVet(vetLabel);
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
          const parsed = new Date(visitDate);
          if (!Number.isNaN(parsed.getTime())) {
            setDate(parsed.toISOString().split("T")[0]);
          }
        }
        const doctor = extraction?.normalized?.doctorName?.value;
        const clinic = extraction?.normalized?.clinicName?.value;
        const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
        if (vetLabel) {
          setVet(vetLabel);
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
  }, [visible, pdfs, userId, petId, vet]);

  const typeOptions: { label: string; value: HealthRecord["type"]; icon: string }[] = [
    { label: "Vaccination", value: "vaccination", icon: "medical" },
    { label: "Checkup", value: "checkup", icon: "checkmark-circle" },
    { label: "Medication", value: "medication", icon: "medkit" },
    { label: "Grooming", value: "grooming", icon: "cut" },
    { label: "Other", value: "other", icon: "document-text" },
  ];

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
          maxHeight: "85%"
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {isEdit ? "Edit Health Record" : "Add Health Record"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View>
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                  Upload Clinical Summary
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.md }}>
                  Upload a PDF so we can auto-fill the visit date and vet details.
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
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Type
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row" }}>
                    {typeOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setType(option.value)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: SPACING.sm,
                          paddingHorizontal: SPACING.md,
                          backgroundColor: type === option.value ? colors.accent : colors.bgSecondary,
                          borderRadius: RADIUS.md,
                          marginRight: SPACING.sm,
                        }}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={18}
                          color={type === option.value ? colors.white : colors.textMuted}
                          style={{ marginRight: SPACING.xs }}
                        />
                        <Text style={{
                          ...TYPOGRAPHY.sm,
                          color: type === option.value ? colors.white : colors.text,
                          fontWeight: type === option.value ? "600" : "500"
                        }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Visit title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Annual checkup"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Visit date"
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Veterinarian / Clinic"
                  value={vet}
                  onChangeText={setVet}
                  placeholder="Dr. Smith · CityVet"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about the visit"
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
  onSave: (payload: { weight?: string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => void;
  initialValues?: { weight?: string; heartRate?: string; respiratoryRate?: string; attitude?: string };
}) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState(initialValues?.weight || "");
  const [heartRate, setHeartRate] = useState(initialValues?.heartRate || "");
  const [respRate, setRespRate] = useState(initialValues?.respiratoryRate || "");
  const [attitude, setAttitude] = useState(initialValues?.attitude || "");

  useEffect(() => {
    if (!visible) return;
    setWeight(initialValues?.weight || "");
    setHeartRate(initialValues?.heartRate || "");
    setRespRate(initialValues?.respiratoryRate || "");
    setAttitude(initialValues?.attitude || "");
  }, [visible, initialValues]);

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
              Update Health Status
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: SPACING.md }}>
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Weight (lb)
                </Text>
                <Input
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g., 25.4"
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Heart Rate (bpm)
                </Text>
                <Input
                  value={heartRate}
                  onChangeText={setHeartRate}
                  placeholder="e.g., 140"
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Respiratory Rate (breaths/min)
                </Text>
                <Input
                  value={respRate}
                  onChangeText={setRespRate}
                  placeholder="e.g., 35"
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                  Attitude
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {["BAR", "QAR", "L", "D"].map((code) => (
                    <TouchableOpacity
                      key={code}
                      onPress={() => setAttitude(code)}
                      style={{
                        paddingVertical: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                        backgroundColor: attitude === code ? colors.accent : colors.bgSecondary,
                        borderRadius: RADIUS.md,
                        marginRight: SPACING.sm,
                        marginBottom: SPACING.sm,
                      }}
                    >
                      <Text style={{
                        ...TYPOGRAPHY.sm,
                        color: attitude === code ? colors.white : colors.text,
                        fontWeight: attitude === code ? "600" : "500"
                      }}>
                        {code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  BAR = Bright Alert Responsive · QAR = Quiet Alert Responsive
                </Text>
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
              title="Save"
              onPress={() => onSave({ weight, heartRate, respiratoryRate: respRate, attitude })}
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
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [showVetVisitModal, setShowVetVisitModal] = useState(false);
  const [healthRecordStartMode, setHealthRecordStartMode] = useState<"manual" | "upload">("manual");
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showManualStatusModal, setShowManualStatusModal] = useState(false);
  const [manualStatus, setManualStatus] = useState<{
    updatedAt: string;
    source?: "manual" | "auto";
    weight?: string;
    heartRate?: string;
    respiratoryRate?: string;
    attitude?: string;
  } | null>(null);
  const [manualStatusPrefill, setManualStatusPrefill] = useState<{
    weight?: string;
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

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const loadWellnessInputs = async () => {
      try {
        const remote = await fetchWellnessInputs(user.id, activePetId);
        if (remote?.preventive) setPreventive(remote.preventive);
        if (remote?.medical) setMedical(remote.medical);
      } catch (error) {
        console.error("HealthScreen: Failed to load wellness inputs:", error);
      }
    };
    loadWellnessInputs();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const timer = setTimeout(() => {
      upsertWellnessInputs(user.id, activePetId, { preventive, medical }).catch((error) => {
        console.error("HealthScreen: Failed to save wellness inputs:", error);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [user?.id, activePetId, preventive, medical]);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setWeightHistory([]);
      return;
    }
    const key = `@kasper_weight_history_${user.id}_${activePetId}`;
    const loadWeightHistory = async () => {
      const raw = await storage.getItem(key);
      if (!raw) {
        setWeightHistory([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setWeightHistory(Array.isArray(parsed) ? parsed : []);
      } catch {
        setWeightHistory([]);
      }
    };
    loadWeightHistory();
  }, [user?.id, activePetId]);

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
        lastRecordedMonthsAgo: 999,
        percentChange: 0,
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
    const monthsAgo = Number.isNaN(latestDate.getTime())
      ? 999
      : Math.max(0, Math.round((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const percentChange = previous && previous.weight !== 0
      ? ((latest.weight - previous.weight) / previous.weight) * 100
      : 0;
    return {
      hasHistory: true,
      lastRecordedMonthsAgo: monthsAgo,
      percentChange,
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
    const weightValue = Number(manualStatus.weight);
    if (!Number.isFinite(weightValue)) return;
    addWeightEntry({
      weight: weightValue,
      date: manualStatus.updatedAt || new Date().toISOString(),
      source: manualStatus.source === "auto" ? "pdf" : "manual",
    });
  }, [manualStatus]);


  const handleSaveManualStatus = async (payload: { weight?: string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => {
    if (!user?.id || !activePetId) return;
    const base = latestExtractedStatus || manualStatus || {};
    const next = {
      updatedAt: new Date().toISOString(),
      source: "manual" as const,
      weight: payload.weight?.trim() || (base as any).weight || undefined,
      heartRate: payload.heartRate?.trim() || (base as any).heartRate || undefined,
      respiratoryRate: payload.respiratoryRate?.trim() || (base as any).respiratoryRate || undefined,
      attitude: payload.attitude?.trim() || (base as any).attitude || undefined,
    };
    const trimmedWeight = payload.weight?.trim();
    if (trimmedWeight) {
      const weightValue = Number(trimmedWeight);
      if (Number.isFinite(weightValue)) {
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

  const addWeightEntry = (entry: WeightEntry) => {
    setWeightHistory((prev) => {
      const next = [...prev, entry]
        .filter((item) => Number.isFinite(item.weight))
        .filter((item) => !Number.isNaN(new Date(item.date).getTime()));
      const deduped = new Map<string, WeightEntry>();
      next.forEach((item) => {
        deduped.set(`${item.date}|${item.weight}`, item);
      });
      return Array.from(deduped.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });
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
                  {latestStatusMeta && (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 4 }}>
                      Updated {timeAgo(latestStatusMeta.ts)} ago
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: SPACING.sm }}>
                    <Text style={{ ...TYPOGRAPHY["3xl"], fontWeight: "800", color: scoreLabel.color }}>
                      {totalScore}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginLeft: SPACING.sm }}>
                      {scoreLabel.text}
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
                      strokeDashoffset={2 * Math.PI * 52 * (1 - totalScore / 100)}
                      transform="rotate(-90 60 60)"
                    />
                  </Svg>
                  <View style={{ position: "absolute", alignItems: "center" }}>
                    <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "700", color: colors.text }}>
                      {totalScore}
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
                      {latestStatusMeta && (
                        <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                          {latestStatusMeta.source} · {timeAgo(latestStatusMeta.ts)} ago
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setActionSheetVariant("quick");
                          setActionSheetTitle("Update health status");
                          setActionSheetOptions([
                            {
                              label: "Upload PDF",
                              icon: "cloud-upload-outline",
                              iconColor: "#7C3AED",
                              onPress: () => {
                                storage.setItem("@kasper_health_record_start_mode", "upload");
                                setShowAddModal(true);
                              },
                            },
                            {
                              label: "Add manually",
                              icon: "create-outline",
                              iconColor: "#64748B",
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
                      {getStatusValue(latestExtractedStatus, "weight")} {getStatusUnit(latestExtractedStatus, "weight")}
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
        onClose={() => setActionSheetVisible(false)}
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
                        onChange={(v) => setPreventive(prev => ({ ...prev, vaccinesUpToDate: v }))}
                      />
                      <ToggleRow
                        label="Parasite control current"
                        value={preventive.parasiteControlCurrent}
                        onChange={(v) => setPreventive(prev => ({ ...prev, parasiteControlCurrent: v }))}
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
                        onChange={(v) => setMedical(prev => ({ ...prev, chronicConditionsCount: v }))}
                      />
                      <NumberAdjustRow
                        label="Medication compliance"
                        value={medical.medicationCompliance}
                        min={0}
                        max={100}
                        step={5}
                        suffix="%"
                        onChange={(v) => setMedical(prev => ({ ...prev, medicationCompliance: v }))}
                      />
                      <NumberAdjustRow
                        label="Symptoms logged (30d)"
                        value={medical.recentSymptomsLogged}
                        min={0}
                        max={10}
                        onChange={(v) => setMedical(prev => ({ ...prev, recentSymptomsLogged: v }))}
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
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Months since last</Text>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                          {weightMetrics.hasHistory ? `${weightMetrics.lastRecordedMonthsAgo} mo` : "N/A"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Weight change</Text>
                        <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                          {weightMetrics.hasHistory
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

