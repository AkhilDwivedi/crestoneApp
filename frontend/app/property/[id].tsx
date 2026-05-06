import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, Property } from '../../src/api';
import { colors, formatINR, radius, spacing } from '../../src/theme';

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/properties/${id}`);
        setItem(data);
      } catch (e) {
        Alert.alert('Error', 'Failed to load property');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onDelete = () => {
    Alert.alert('Delete property', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.delete(`/properties/${id}`);
          router.back();
        },
      },
    ]);
  };

  if (loading || !item) {
    return <SafeAreaView style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="property-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Property</Text>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn} testID="property-delete">
          <Ionicons name="trash" size={20} color={colors.hot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }]}>
            <Ionicons name="business" size={56} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: item.status === 'Available' ? colors.won : item.status === 'Sold' ? colors.hot : colors.warm,
            }]} />
            <Text style={styles.statusText}>{item.status}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.statusText}>{item.type}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={colors.textMuted} />
            <Text style={styles.loc}>{item.location}</Text>
          </View>

          <Text style={styles.price}>{formatINR(item.price)}</Text>

          <View style={styles.featGrid}>
            <Feat icon="bed" label="Bedrooms" v={String(item.bedrooms)} />
            <Feat icon="water" label="Bathrooms" v={String(item.bathrooms)} />
            <Feat icon="resize" label="Area" v={`${item.area_sqft} sqft`} />
            <Feat icon="business" label="Type" v={item.type} />
          </View>

          {item.description ? (
            <View style={styles.descBox}>
              <Text style={styles.sectionTitle}>About this property</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feat({ icon, label, v }: { icon: any; label: string; v: string }) {
  return (
    <View style={styles.feat}>
      <View style={styles.featIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.featLabel}>{label}</Text>
      <Text style={styles.featValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hero: { width: '100%', height: 280 },
  body: { padding: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: colors.textSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  dot: { color: colors.textMuted, marginHorizontal: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 8 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  loc: { color: colors.textMuted, fontSize: 13 },
  price: { color: colors.primary, fontSize: 28, fontWeight: '800', marginTop: 16 },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: spacing.lg },
  feat: {
    width: '47%',
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  featIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  featLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  featValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  descBox: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.lg, gap: 8,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  descText: { color: colors.text, fontSize: 14, lineHeight: 22 },
});
