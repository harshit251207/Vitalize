import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signUpUser } from '@/services/authService';
import { useTheme } from '@/hooks/use-theme';

function getSignupErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code?.replace('auth/', '');
  const messages: Record<string, string> = {
    'email-already-in-use': 'This email is already in use. Try logging in instead.',
    'weak-password': 'Your password is too weak. Please choose a stronger password.',
    'invalid-email': 'Enter a valid email address.',
  };

  return (code && messages[code]) || (code ? `Sign up failed: ${code}` : 'Unable to create your account. Please try again.');
}

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const router = useRouter();
  const colors = useTheme();

  const handleSignup = async () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      setAuthError('Please enter your email, username, and password.');
      return;
    }

    setAuthError('');
    setIsSubmitting(true);
    try {
      await signUpUser(email.trim(), password, username.trim());
    } catch (error) {
      setAuthError(getSignupErrorMessage(error));
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
            <Ionicons name="person-add" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
            Join Vitalize for personal health monitoring
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
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
            <Text style={[styles.inputLabel, { color: colors.text }]}>Choose Username</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="person-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Choose a unique username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                accessibilityLabel="Username input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Choose Password</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Choose a password"
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
            onPress={handleSignup}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Signup Button"
            activeOpacity={0.8}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Text style={styles.buttonText}>Sign Up & Get Started</Text>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => router.push('/(auth)/login')}
          style={styles.linkButton}
          accessibilityRole="button"
          accessibilityLabel="Go to Login"
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account? <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Log In</Text>
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
