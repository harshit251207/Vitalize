import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/AuthContext';
import { Storage } from '@/services/storage';
import { useTheme } from '@/hooks/use-theme';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Details', 'Please choose both a username and password.');
      return;
    }

    try {
      const storedUsers = await Storage.getItem('users');
      const users = storedUsers ? JSON.parse(storedUsers) : {};

      if (users[username]) {
        Alert.alert('Username Unavailable', 'This username is already taken. Please choose another.');
        return;
      }

      users[username] = password;
      await Storage.setItem('users', JSON.stringify(users));
      
      // Auto login after signup
      await login(username);
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred during signup.');
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

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }]} 
            onPress={handleSignup}
            accessibilityRole="button"
            accessibilityLabel="Signup Button"
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign Up & Get Started</Text>
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
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
});
