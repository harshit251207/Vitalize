import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useCategory } from '@/store/AuthContext';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { useTheme } from '@/hooks/use-theme';
import { VitalsService } from '@/services/vitalsService';
import { UserProfile } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WellnessBanner } from '@/components/WellnessBanner';
import { fetchUserProfile, updateUserDisplayName } from '@/services/authService';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { category } = useCategory();
  const colors = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [isNameEditorOpen, setIsNameEditorOpen] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      void VitalsService.getUserProfile(user).then((vitalsProfile) => {
        if (active) setProfile(vitalsProfile);
      }).catch((error: unknown) => {
        console.error('[Profile] Could not load health profile:', error);
      });
      void fetchUserProfile(user).then((accountProfile) => {
        if (!active) return;
        const savedName = accountProfile?.username;
        setDisplayName(typeof savedName === 'string' ? savedName.trim() : '');
      }).catch((error: unknown) => {
        console.error('[Profile] Could not load account name:', error);
      });
      return () => {
        active = false;
      };
    }, [user])
  );

  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  const openNameEditor = () => {
    setNameDraft(displayName);
    setNameError('');
    setIsNameEditorOpen(true);
  };

  const saveDisplayName = async () => {
    if (!user) return;
    setIsSavingName(true);
    setNameError('');
    try {
      await updateUserDisplayName(user, nameDraft);
      setDisplayName(nameDraft.trim().replace(/\s+/g, ' '));
      setIsNameEditorOpen(false);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : 'Could not update your name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Profile & Settings</Text>

        <WellnessBanner
          variant="profile"
          title="Your care, your way"
          subtitle="Keep your health details close at hand."
        />

        {/* User Hero Card */}
        <View style={[styles.userCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>

          <Text style={[styles.usernameText, { color: colors.text }]}>{displayName || 'Your name'}</Text>
          <Text style={[styles.userRoleText, { color: colors.textSecondary }]}>Vitalize Account</Text>
          <TouchableOpacity
            style={[styles.editNameButton, { borderColor: colors.primary }]}
            onPress={openNameEditor}
            accessibilityRole="button"
            accessibilityLabel="Change your name"
          >
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            <Text style={[styles.editNameText, { color: colors.primary }]}>Edit name</Text>
          </TouchableOpacity>
        </View>

        {/* Disability Category Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medical" size={22} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Disability Classification</Text>
          </View>

          <Text style={[styles.categoryValueText, { color: category ? colors.primary : colors.textSecondary }]}>
            {category ? CATEGORY_LABELS[category] : 'Not classified yet'}
          </Text>

          <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
            {category
              ? 'Your workout exercises and diet guidelines are tailored to this mobility classification.'
              : 'Upload a report photo or select your category to unlock personalized plans.'}
          </Text>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary }]} 
            onPress={() => router.push(category ? '/report-upload?change=1' : '/report-upload')}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>
              {category ? 'Change category' : 'Classify Disability'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.emergencyButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
          onPress={() => router.push('/emergency-contacts')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Manage emergency contacts"
        >
          <Ionicons name="people-outline" size={22} color={colors.danger} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.emergencyButtonTitle, { color: colors.text }]}>Emergency contacts</Text>
            <Text style={[styles.emergencyButtonSubtitle, { color: colors.textSecondary }]}>
              Manage family and ambulance numbers
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Calorie Calculator Profile Info */}
        {profile?.calorieCalculator && (
          <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition Parameters</Text>
            </View>

            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Weight / Height:</Text>
              <Text style={[styles.rangeValue, { color: colors.text }]}>
                {profile.calorieCalculator.weightKg} kg / {profile.calorieCalculator.heightCm} cm
              </Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Age & Gender:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                {profile.calorieCalculator.age} yrs • {profile.calorieCalculator.gender}
              </Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Activity Level:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                {profile.calorieCalculator.activityLevel}
              </Text>
            </View>
          </View>
        )}

        {/* Healthy Ranges Info Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Target Healthy Ranges</Text>
          </View>

          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Systolic BP Max:</Text>
            <Text style={[styles.rangeValue, { color: colors.text }]}>{profile?.healthyRanges?.bpSysMax || 120} mmHg</Text>
          </View>
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Blood Sugar Max:</Text>
            <Text style={[styles.rangeValue, { color: colors.text }]}>{profile?.healthyRanges?.sugarMax || 140} mg/dL</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { borderColor: colors.danger }]} 
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Logout Button"
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.logoutButtonText, { color: colors.danger }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={isNameEditorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNameEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.nameEditor, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.nameEditorTitle, { color: colors.text }]}>Change your name</Text>
            <Text style={[styles.nameEditorDescription, { color: colors.textSecondary }]}>
              This name appears on your profile and future community posts.
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                { color: colors.text, borderColor: nameError ? colors.danger : colors.border, backgroundColor: colors.background },
              ]}
              value={nameDraft}
              onChangeText={(value) => {
                setNameDraft(value.slice(0, 40));
                setNameError('');
              }}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => void saveDisplayName()}
              accessibilityLabel="Your display name"
            />
            {!!nameError && <Text style={[styles.nameError, { color: colors.danger }]}>{nameError}</Text>}
            <View style={styles.nameEditorActions}>
              <TouchableOpacity
                style={[styles.nameCancelButton, { borderColor: colors.border }]}
                onPress={() => setIsNameEditorOpen(false)}
                disabled={isSavingName}
                accessibilityRole="button"
              >
                <Text style={[styles.nameCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nameSaveButton, { backgroundColor: colors.primary }]}
                onPress={() => void saveDisplayName()}
                disabled={isSavingName}
                accessibilityRole="button"
                accessibilityLabel="Save name"
              >
                {isSavingName
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.nameSaveText}>Save name</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  userCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  usernameText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  editNameButton: {
    minHeight: 36,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  userRoleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryValueText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  categoryDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emergencyButton: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emergencyButtonSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rangeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#00000066',
  },
  nameEditor: {
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  nameEditorTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
  },
  nameEditorDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    fontSize: 16,
  },
  nameError: {
    fontSize: 13,
    lineHeight: 18,
  },
  nameEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  nameCancelButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nameSaveButton: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
