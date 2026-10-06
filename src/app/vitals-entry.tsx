import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { NotAuthenticatedError, addVitalReading } from '@/services/vitalsService';
import { useTheme } from '@/hooks/use-theme';

export default function VitalsEntryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weight, setWeight] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save your vitals.');
      return;
    }

    if (!bpSys && !bpDia && !bloodSugar && !heartRate && !weight) {
      Alert.alert('Missing Entry', 'Please fill in at least one vital sign reading before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await addVitalReading({
        systolic: bpSys ? parseInt(bpSys, 10) : undefined,
        diastolic: bpDia ? parseInt(bpDia, 10) : undefined,
        bloodSugar: bloodSugar ? parseInt(bloodSugar, 10) : undefined,
        heartRate: heartRate ? parseInt(heartRate, 10) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
      });

      Alert.alert('Saved Successfully', 'Your vitals log has been updated.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      const firebaseError = e as { code?: string; message?: string };
      console.error('[VitalsEntry] save failed', {
        errorCode: firebaseError.code ?? '(none)',
        errorMessage: firebaseError.message ?? String(e),
        uid: user,
      });
      const message =
        e instanceof NotAuthenticatedError
          ? e.message
          : firebaseError.message
            ? `${firebaseError.code ?? 'unknown'}: ${firebaseError.message}`
            : 'Could not save your vitals log. Please check your connection and try again.';
      Alert.alert('Save Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Navigation Bar */}
        <View style={styles.topHeader}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Log Vitals</Text>
          <TouchableOpacity 
            style={[styles.closeCircle, { backgroundColor: colors.backgroundElement }]} 
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your metrics below. Fields left blank will not be recorded.
        </Text>

        {/* Blood Pressure Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.bp + '18' }]}>
              <Ionicons name="heart" size={20} color={colors.bp} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Blood Pressure</Text>
            <Text style={[styles.unitBadge, { color: colors.textSecondary }]}>mmHg</Text>
          </View>

          <View style={styles.bpRow}>
            <View style={styles.bpField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Systolic</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="120"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={bpSys}
                onChangeText={setBpSys}
              />
            </View>
            <Text style={[styles.slashText, { color: colors.textSecondary }]}>/</Text>
            <View style={styles.bpField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Diastolic</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="80"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={bpDia}
                onChangeText={setBpDia}
              />
            </View>
          </View>
        </View>

        {/* Blood Sugar Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.sugar + '18' }]}>
              <Ionicons name="water" size={20} color={colors.sugar} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Blood Sugar</Text>
            <Text style={[styles.unitBadge, { color: colors.textSecondary }]}>mg/dL</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="e.g. 98"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={bloodSugar}
            onChangeText={setBloodSugar}
          />
        </View>

        {/* Heart Rate Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.heartRate + '18' }]}>
              <Ionicons name="fitness" size={20} color={colors.heartRate} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Heart Rate</Text>
            <Text style={[styles.unitBadge, { color: colors.textSecondary }]}>bpm</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="e.g. 72"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={heartRate}
            onChangeText={setHeartRate}
          />
        </View>

        {/* Weight Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.weight + '18' }]}>
              <Ionicons name="scale" size={20} color={colors.weight} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Body Weight</Text>
            <Text style={[styles.unitBadge, { color: colors.textSecondary }]}>kg</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="e.g. 68"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} 
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="checkmark" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Vitals Log'}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 24,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 20,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  unitBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bpField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  slashText: {
    fontSize: 28,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
