import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Alert, Modal, Pressable, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { api, Lead } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, formatINR, radius, spacing, tempColor, typography } from '../../src/theme';

type WaTemplate = { id: string; title: string; icon: string; template: string };
type DocItem = { id: string; name: string; doc_type: string; size_bytes: number; uploaded_at: string };

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docBusy, setDocBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    try {
      const [leadResp, tplResp, docsResp] = await Promise.all([
        api.get(`/leads/${id}`),
        api.get('/whatsapp/templates'),
        api.get(`/leads/${id}/documents`),
      ]);
      setLead(leadResp.data);
      setTemplates(tplResp.data);
      setDocs(docsResp.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const generateSummary = async () => {
    if (!lead) return;
    setAiBusy(true);
    try {
      const { data } = await api.post(`/leads/${lead.id}/ai-summary`);
      setLead({ ...lead, ai_summary: data.ai_summary });
    } catch (e: any) {
      Alert.alert('AI Summary', e?.response?.data?.detail || 'Failed to generate');
    } finally {
      setAiBusy(false);
    }
  };

  const onCall = () => lead && Linking.openURL(`tel:${lead.phone.replace(/\s+/g, '')}`);
  const onWhatsApp = () => setWaOpen(true);
  const onEmail = () => lead?.email && Linking.openURL(`mailto:${lead.email}`);

  const sendTemplate = (tpl: WaTemplate) => {
    if (!lead) return;
    const msg = tpl.template
      .replace('{name}', lead.name)
      .replace('{interest}', lead.interest || 'the property you enquired about');
    const phone = lead.phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    setWaOpen(false);
  };

  const pickDocument = async () => {
    setDocBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) { setDocBusy(false); return; }
      const file = res.assets[0];
      // Read as base64
      const base64 = await fileToBase64(file.uri);
      if (!base64) throw new Error('Could not read file');
      const sizeMB = base64.length / 1_400_000;
      if (sizeMB > 3) {
        Alert.alert('Too large', `File is ~${sizeMB.toFixed(1)} MB. Max 3 MB.`);
        return;
      }
      await api.post(`/leads/${id}/documents`, {
        name: file.name,
        doc_type: guessType(file.name),
        content_base64: base64,
        mime_type: file.mimeType || 'application/octet-stream',
      });
      const r = await api.get(`/leads/${id}/documents`);
      setDocs(r.data);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Try another file');
    } finally {
      setDocBusy(false);
    }
  };

  const deleteDoc = async (docId: string) => {
    Alert.alert('Delete document', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.delete(`/leads/${id}/documents/${docId}`);
          setDocs((d) => d.filter((x) => x.id !== docId));
        },
      },
    ]);
  };

  const openAssign = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
      setAssignOpen(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const reassign = async (userId: string | null) => {
    try {
      const { data } = await api.put(`/leads/${id}/assign`, { assigned_to: userId });
      setLead(data);
      setAssignOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to reassign');
    }
  };

  const onDelete = () => {
    Alert.alert('Delete lead', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.delete(`/leads/${id}`);
          router.back();
        },
      },
    ]);
  };

  if (loading || !lead) {
    return <SafeAreaView style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  }

  const tc = tempColor(lead.temperature);
  const assignedUser = users.find((u) => u.id === (lead as any).assigned_to);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="lead-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn} testID="lead-delete">
          <Ionicons name="trash" size={20} color={colors.hot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: tc.bg }]}>
            <Text style={[styles.heroAvatarText, { color: tc.fg }]}>{lead.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{lead.name}</Text>
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: tc.bg }]}>
              <Text style={[styles.badgeText, { color: tc.fg }]}>{lead.temperature}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.glass }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{lead.status}</Text>
            </View>
          </View>
          <Text style={styles.heroSub}>via {lead.source}</Text>
        </View>

        <View style={styles.actions}>
          <ActionBtn icon="call" label="Call" onPress={onCall} testID="lead-action-call" />
          <ActionBtn icon="logo-whatsapp" label="WhatsApp" onPress={onWhatsApp} testID="lead-action-whatsapp" />
          <ActionBtn icon="mail" label="Email" onPress={onEmail} disabled={!lead.email} testID="lead-action-email" />
        </View>

        <View style={styles.aiCard} testID="lead-ai-card">
          <View style={styles.aiHead}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.aiBadgeText}>AI Insights</Text>
            </View>
            <TouchableOpacity onPress={generateSummary} disabled={aiBusy} testID="lead-ai-generate">
              <Text style={styles.linkText}>{aiBusy ? 'Generating…' : (lead.ai_summary ? 'Regenerate' : 'Generate')}</Text>
            </TouchableOpacity>
          </View>
          {aiBusy ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            : lead.ai_summary ? <Text style={styles.aiText}>{lead.ai_summary}</Text>
            : <Text style={styles.aiPlaceholder}>Tap "Generate" for an AI-powered lead summary and next-step recommendations.</Text>}
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <View style={styles.rowHead}>
              <Text style={styles.sectionTitle}>Assigned to</Text>
              <TouchableOpacity onPress={openAssign} testID="lead-reassign">
                <Text style={styles.linkText}>{assignedUser ? 'Change' : 'Assign'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.assignedName}>
              {assignedUser ? assignedUser.name : (lead as any).assigned_to ? 'Loading…' : 'Unassigned'}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Row icon="call" label="Phone" value={lead.phone} />
          <Row icon="mail" label="Email" value={lead.email || '—'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <Row icon="cash" label="Budget" value={formatINR(lead.budget)} />
          <Row icon="home" label="Interest" value={lead.interest || '—'} />
          <Row icon="document-text" label="Notes" value={lead.notes || '—'} />
        </View>

        <View style={styles.section}>
          <View style={styles.rowHead}>
            <Text style={styles.sectionTitle}>Documents ({docs.length})</Text>
            <TouchableOpacity onPress={pickDocument} disabled={docBusy} testID="lead-add-document">
              <Text style={styles.linkText}>{docBusy ? 'Uploading…' : '+ Add'}</Text>
            </TouchableOpacity>
          </View>
          {docs.length === 0 ? (
            <Text style={styles.aiPlaceholder}>No documents yet. Add Aadhaar, PAN, agreements, etc. (max 3 MB).</Text>
          ) : (
            docs.map((d) => (
              <View key={d.id} style={styles.docRow} testID={`doc-${d.id}`}>
                <View style={styles.docIcon}>
                  <Ionicons name="document" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.docMeta}>
                    {d.doc_type.toUpperCase()} · {(d.size_bytes / 1024).toFixed(0)} KB
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteDoc(d.id)} style={styles.docDel} testID={`doc-del-${d.id}`}>
                  <Ionicons name="trash" size={16} color={colors.hot} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* WhatsApp Templates Sheet */}
      <Modal visible={waOpen} transparent animationType="slide" onRequestClose={() => setWaOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setWaOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="whatsapp-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>WhatsApp Templates</Text>
            <Text style={styles.sheetSub}>Tap to send {lead.name}</Text>
            <FlatList
              data={templates}
              keyExtractor={(t) => t.id}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tplCard}
                  onPress={() => sendTemplate(item)}
                  testID={`wa-template-${item.id}`}
                >
                  <View style={styles.tplIcon}>
                    <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tplTitle}>{item.title}</Text>
                    <Text style={styles.tplPreview} numberOfLines={2}>
                      {item.template.replace('{name}', lead.name).replace('{interest}', lead.interest || '…')}
                    </Text>
                  </View>
                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                </TouchableOpacity>
              )}
              style={{ maxHeight: 480 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Sheet */}
      <Modal visible={assignOpen} transparent animationType="slide" onRequestClose={() => setAssignOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAssignOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="assign-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Assign lead to</Text>
            <Text style={styles.sheetSub}>{lead.name}</Text>
            <TouchableOpacity style={styles.userRow} onPress={() => reassign(null)}>
              <View style={[styles.userAvatar, { backgroundColor: colors.glass }]}>
                <Ionicons name="person-remove" size={18} color={colors.textMuted} />
              </View>
              <Text style={styles.userName}>Unassign</Text>
            </TouchableOpacity>
            <FlatList
              data={users}
              keyExtractor={(u) => u.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userRow} onPress={() => reassign(item.id)} testID={`assign-${item.id}`}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{item.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userRole}>{item.email} · {item.role}</Text>
                  </View>
                  {item.id === (lead as any).assigned_to ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

async function fileToBase64(uri: string): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function guessType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('aadhaar') || n.includes('aadhar')) return 'aadhaar';
  if (n.includes('pan')) return 'pan';
  if (n.includes('agreement') || n.includes('contract')) return 'agreement';
  if (n.endsWith('.pdf')) return 'document';
  if (/\.(jpg|jpeg|png)$/.test(n)) return 'image';
  return 'other';
}

function ActionBtn({ icon, label, onPress, disabled, testID }: any) {
  return (
    <TouchableOpacity style={[styles.actionBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} testID={testID}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 60 },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontWeight: '800', fontSize: 32 },
  heroName: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: spacing.lg },
  actionBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    paddingVertical: 14, borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { color: colors.text, fontWeight: '600', fontSize: 12 },
  aiCard: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    padding: 16, borderWidth: 1, borderColor: 'rgba(212,175,85,0.25)',
    marginBottom: spacing.lg,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  aiBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 0.8 },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  aiText: { color: colors.text, fontSize: 14, lineHeight: 22, marginTop: 12 },
  aiPlaceholder: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 20 },
  section: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    padding: 16, borderWidth: 1, borderColor: colors.border,
    marginBottom: 12, gap: 12,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  assignedName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowValue: { color: colors.text, fontSize: 14, marginTop: 2 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: 10, borderWidth: 1, borderColor: colors.border,
  },
  docIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  docMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  docDel: { padding: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: 20, gap: 8,
    borderWidth: 1, borderColor: colors.border,
    paddingBottom: 32,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  tplCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  tplIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  tplTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tplPreview: { color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: colors.primary, fontWeight: '800' },
  userName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  userRole: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
