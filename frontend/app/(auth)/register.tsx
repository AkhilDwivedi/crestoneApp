import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, formatApiError } from '../../src/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr('');
    if (!name || !email || password.length < 6) {
      setErr('Please fill all fields. Password must be at least 6 chars.');
      return;
    }
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="register-back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.brandWrap}>
            <View style={styles.brandIcon}>
              <Ionicons name="business" size={28} color={colors.text} />
            </View>
            <Text style={styles.brandName}>Create account</Text>
            <Text style={styles.brandTag}>Start managing your portfolio</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              testID="register-name-input"
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
            <TextInput
              testID="register-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <TextInput
              testID="register-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

            <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={onSubmit} disabled={busy} testID="register-submit-button">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={typography.body}>Have an account?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity testID="goto-login-link">
                  <Text style={styles.linkText}> Sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  brandWrap: { alignItems: 'center', marginVertical: spacing.lg },
  brandIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  brandName: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  brandTag: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  err: { color: colors.hot, marginTop: 12, fontSize: 13 },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  linkText: { color: colors.primary, fontWeight: '700' },
});
