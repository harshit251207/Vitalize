import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loginUser } from '@/services/authService';
import { useTheme } from '@/hooks/use-theme';

function getLoginErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code?.replace('auth/', '');
  const messages: Record<string, string> = {
    'invalid-email': 'Enter a valid email address.',
    'invalid-credential': 'The email or password is incorrect.',
    'user-not-found': 'No account exists for this email address.',
    'wrong-password': 'The email or password is incorrect.',
    'too-many-requests': 'Too many attempts. Please try again later.',
  };

  return (code && messages[code]) || (code ? `Login failed: ${code}` : 'Unable to log in. Please try again.');
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const router = useRouter();
  const colors = useTheme();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both your email and password.');
      return;
    }

    setAuthError('');
    setIsSubmitting(true);
    try {
      await loginUser(email.trim(), password);
    } catch (error) {
      setAuthError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerSection}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="pulse" size={54} color={colors.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Vitalize</Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
            Health & Mobility Monitoring
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Log in to access your vitals & plans
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                accessibilityLabel="Email input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                accessibilityLabel="Password input"
              />
            </View>
          </View>

          {!!authError && (
            <View style={[styles.errorBox, { backgroundColor: (colors.danger || '#E53E3E') + '18' }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger || '#E53E3E'} style={styles.errorIcon} />
              <Text style={[styles.errorText, { color: colors.danger || '#E53E3E' }]}>{authError}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Login Button"
            activeOpacity={0.8}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Text style={styles.buttonText}>Log In</Text>
              <Ionicons name="arrow-forward" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => router.push('/(auth)/signup')}
          style={styles.linkButton}
          accessibilityRole="button"
          accessibilityLabel="Go to Signup"
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Don't have an account? <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
  },
  button: {
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    fontSize: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
