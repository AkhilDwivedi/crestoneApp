import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { colors, radius, spacing } from '../../src/theme';

const SOURCES = ['Website', 'Referral', 'Walk-in', 'Social'];
const TEMPS = ['hot', 'warm', 'cold'];

export default function NewLead() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Website');
  const [temperature, setTemperature] = useState('warm');
  const [budget, setBudget] = useState('');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!name || !phone) {
      Alert.alert('Required', 'Name and phone are required');
      return;
    }
    setBusy(true);
    try {
      await api.post('/leads', {
        name, phone, email: email || undefined, source, temperature,
        budget: budget ? Number(budget) : undefined,
        interest: interest || undefined,
        notes: notes || undefined,
      });
      router.replace('/(tabs)/leads');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail?.toString() || 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="new-lead-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Lead</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Full name *" testID="new-lead-name">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} placeholder="John Doe" />
          </Field>
          <Field label="Phone *" testID="new-lead-phone">
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholderTextColor={colors.textMuted} placeholder="+91 …" keyboardType="phone-pad" />
          </Field>
          <Field label="Email" testID="new-lead-email">
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholderTextColor={colors.textMuted} placeholder="email@example.com" autoCapitalize="none" keyboardType="email-address" />
          </Field>

          <Text style={styles.label}>Source</Text>
          <View style={styles.chips}>
            {SOURCES.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSource(s)}
                style={[styles.chip, source === s && styles.chipActive]}
                testID={`source-${s}`}
              >
                <Text style={[styles.chipText, source === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Temperature</Text>
          <View style={styles.chips}>
            {TEMPS.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTemperature(t)}
                style={[styles.chip, temperature === t && styles.chipActive]}
                testID={`temp-${t}`}
              >
                <Text style={[styles.chipText, temperature === t && styles.chipTextActive]}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Budget (₹)" testID="new-lead-budget">
            <TextInput style={styles.input} value={budget} onChangeText={setBudget} placeholderTextColor={colors.textMuted} placeholder="e.g. 12000000" keyboardType="numeric" />
          </Field>
          <Field label="Interest" testID="new-lead-interest">
            <TextInput style={styles.input} value={interest} onChangeText={setInterest} placeholderTextColor={colors.textMuted} placeholder="3BHK in Bandra" />
          </Field>
          <Field label="Notes" testID="new-lead-notes">
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholderTextColor={colors.textMuted} placeholder="Additional info…" multiline />
          </Field>

          <TouchableOpacity style={[styles.primary, busy && { opacity: 0.7 }]} onPress={onSubmit} disabled={busy} testID="new-lead-submit">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create lead</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, testID }: any) {
  return (
    <View style={{ marginBottom: 14 }} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  scroll: { padding: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: colors.bg2, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  primary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
