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

const TYPES = ['Apartment', 'Villa', 'Plot', 'Office'];
const STATUSES = ['Available', 'Reserved', 'Sold'];
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1776500588108-1e059459f14c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
  'https://images.unsplash.com/photo-1766603636483-84b2a2b8ee89?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
  'https://images.unsplash.com/photo-1761347603872-060d6e2debb9?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
  'https://images.unsplash.com/photo-1638454795595-0a0abf68614d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80',
];

export default function NewProperty() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [area, setArea] = useState('');
  const [type, setType] = useState('Apartment');
  const [status, setStatus] = useState('Available');
  const [image, setImage] = useState(SAMPLE_IMAGES[0]);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!title || !location || !price) {
      Alert.alert('Required', 'Title, location and price are required');
      return;
    }
    setBusy(true);
    try {
      await api.post('/properties', {
        title, location, price: Number(price),
        bedrooms: Number(bedrooms || 0),
        bathrooms: Number(bathrooms || 0),
        area_sqft: Number(area || 0),
        type, status, image_url: image, description: description || undefined,
      });
      router.replace('/(tabs)/properties');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail?.toString() || 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="new-prop-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Property</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Title *">
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textMuted} placeholder="Skyline Heights – 3BHK" testID="new-prop-title" />
          </Field>
          <Field label="Location *">
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor={colors.textMuted} placeholder="Bandra West, Mumbai" testID="new-prop-loc" />
          </Field>
          <Field label="Price (₹) *">
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholderTextColor={colors.textMuted} placeholder="35000000" keyboardType="numeric" testID="new-prop-price" />
          </Field>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Bedrooms">
                <TextInput style={styles.input} value={bedrooms} onChangeText={setBedrooms} placeholderTextColor={colors.textMuted} placeholder="3" keyboardType="numeric" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Bathrooms">
                <TextInput style={styles.input} value={bathrooms} onChangeText={setBathrooms} placeholderTextColor={colors.textMuted} placeholder="2" keyboardType="numeric" />
              </Field>
            </View>
          </View>

          <Field label="Area (sqft)">
            <TextInput style={styles.input} value={area} onChangeText={setArea} placeholderTextColor={colors.textMuted} placeholder="1450" keyboardType="numeric" />
          </Field>

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Status</Text>
          <View style={styles.chips}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Image</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {SAMPLE_IMAGES.map((u) => (
              <TouchableOpacity key={u} onPress={() => setImage(u)} style={[styles.imgBtn, image === u && { borderColor: colors.primary }]}>
                <View style={{ width: 100, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface }}>
                  <View style={{ width: 100, height: 70, backgroundColor: 'transparent' }} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Field label="Description">
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholderTextColor={colors.textMuted} placeholder="Premium sea-facing apartment…" multiline />
          </Field>

          <TouchableOpacity style={[styles.primary, busy && { opacity: 0.7 }]} onPress={onSubmit} disabled={busy} testID="new-prop-submit">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add property</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
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
  input: { backgroundColor: colors.bg2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  imgBtn: { borderWidth: 2, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  primary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
