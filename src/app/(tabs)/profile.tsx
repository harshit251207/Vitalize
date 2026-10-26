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
import {
  fetchNutritionProfile,
  saveNutritionProfile,
  type NutritionDetails,
} from '@/services/nutritionProfileService';
import type { ActivityLevel, Gender } from '@/services/calorieCalculator';

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
  const [nutritionDetails, setNutritionDetails] = useState<NutritionDetails | null>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [heightDraft, setHeightDraft] = useState('');
  const [ageDraft, setAgeDraft] = useState('');
  const [genderDraft, setGenderDraft] = useState<Gender>('male');
  const [activityDraft, setActivityDraft] = useState<ActivityLevel>('sedentary');
  const [allergies, setAllergies] = useState('');
  const [allergiesDraft, setAllergiesDraft] = useState('');
  const [isNutritionEditorOpen, setIsNutritionEditorOpen] = useState(false);
  const [isSavingNutrition, setIsSavingNutrition] = useState(false);
  const [nutritionError, setNutritionError] = useState('');
  const [nutritionLoadError, setNutritionLoadError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      void VitalsService.getUserProfile(user).then((vitalsProfile) => {
        if (!active) return;
        setProfile(vitalsProfile);
        if (vitalsProfile.calorieCalculator) {
          setNutritionDetails((current) => current ?? vitalsProfile.calorieCalculator ?? null);
        }
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
      void fetchNutritionProfile(user).then((savedNutrition) => {
        if (!active) return;
        setNutritionLoadError('');
        if (savedNutrition.details) setNutritionDetails(savedNutrition.details);
        setAllergies(savedNutrition.previousAllergies);
      }).catch((error: unknown) => {
        console.error('[Profile] Could not load nutrition details:', error);
        if (active) setNutritionLoadError('Could not load saved nutrition details. Reopen Profile to try again.');
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

  const openNutritionEditor = () => {
    setWeightDraft(nutritionDetails ? String(nutritionDetails.weightKg) : '');
    setHeightDraft(nutritionDetails ? String(nutritionDetails.heightCm) : '');
    setAgeDraft(nutritionDetails ? String(nutritionDetails.age) : '');
    setGenderDraft(nutritionDetails?.gender ?? 'male');
    setActivityDraft(nutritionDetails?.activityLevel ?? 'sedentary');
    setAllergiesDraft(allergies);
    setNutritionError('');
    setIsNutritionEditorOpen(true);
  };

  const saveNutritionDetails = async () => {
    if (!user) return;
    const details: NutritionDetails = {
      weightKg: Number(weightDraft),
      heightCm: Number(heightDraft),
      age: Number(ageDraft),
      gender: genderDraft,
      activityLevel: activityDraft,
    };
    if (
      !Number.isFinite(details.weightKg) ||
      details.weightKg < 1 ||
      details.weightKg > 500 ||
      !Number.isFinite(details.heightCm) ||
      details.heightCm < 50 ||
      details.heightCm > 300 ||
      !Number.isInteger(details.age) ||
      details.age < 1 ||
      details.age > 120
    ) {
      setNutritionError('Enter a valid weight (1–500 kg), height (50–300 cm), and age (1–120 years).');
      return;
    }

    setIsSavingNutrition(true);
    setNutritionError('');
    try {
      await saveNutritionProfile(user, details, allergiesDraft);
      setNutritionDetails(details);
      setAllergies(allergiesDraft.trim().slice(0, 500));
      setNutritionLoadError('');
      setIsNutritionEditorOpen(false);
    } catch (error) {
      console.error('[Profile] Could not save nutrition details:', error);
      setNutritionError(error instanceof Error ? error.message : 'Could not save your details. Please try again.');
    } finally {
      setIsSavingNutrition(false);
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

        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="nutrition" size={22} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition details</Text>
          </View>
          {nutritionDetails ? (
            <>
              <View style={styles.rangeRow}>
                <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Weight / height:</Text>
                <Text style={[styles.rangeValue, { color: colors.text }]}>
                  {nutritionDetails.weightKg} kg / {nutritionDetails.heightCm} cm
                </Text>
              </View>
              <View style={styles.rangeRow}>
                <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Age / gender:</Text>
                <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                  {nutritionDetails.age} yrs / {nutritionDetails.gender}
                </Text>
              </View>
              <View style={styles.rangeRow}>
                <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Activity:</Text>
                <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                  {nutritionDetails.activityLevel}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
              Add your details to calculate a personalized nutrition estimate in Diet.
            </Text>
          )}
          {!!nutritionLoadError && (
            <Text style={[styles.nameError, styles.nutritionLoadError, { color: colors.danger }]}>
              {nutritionLoadError}
            </Text>
          )}
          <Text style={[styles.allergiesLabel, { color: colors.textSecondary }]}>Previous allergies</Text>
          <Text style={[styles.allergiesValue, { color: allergies ? colors.text : colors.textSecondary }]}>
            {nutritionLoadError ? 'Unable to load saved allergies' : allergies || 'None added'}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.nutritionEditButton, { backgroundColor: colors.primary }]}
            onPress={openNutritionEditor}
            accessibilityRole="button"
            accessibilityLabel="Edit nutrition details and allergies"
          >
            <Ionicons name="create-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Edit nutrition details</Text>
          </TouchableOpacity>
        </View>

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

      <Modal
        visible={isNutritionEditorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNutritionEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.nutritionEditor, { backgroundColor: colors.backgroundElement }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.nameEditorTitle, { color: colors.text }]}>Nutrition details</Text>
              <Text style={[styles.nameEditorDescription, { color: colors.textSecondary }]}>
                Used to estimate your daily calorie needs in the Diet section.
              </Text>
              <View style={styles.nutritionInputsRow}>
                <View style={styles.nutritionInputGroup}>
                  <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Weight (kg)</Text>
                  <TextInput
                    style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={weightDraft}
                    onChangeText={setWeightDraft}
                    placeholder="e.g. 65"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Weight in kilograms"
                  />
                </View>
                <View style={styles.nutritionInputGroup}>
                  <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
                  <TextInput
                    style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={heightDraft}
                    onChangeText={setHeightDraft}
                    placeholder="e.g. 170"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Height in centimeters"
                  />
                </View>
              </View>
              <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={ageDraft}
                onChangeText={setAgeDraft}
                placeholder="Age in years"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                accessibilityLabel="Age in years"
              />
              <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Sex used by the calorie equation</Text>
              <View style={styles.choiceRow}>
                {(['male', 'female'] as Gender[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.choiceButton,
                      {
                        borderColor: genderDraft === option ? colors.primary : colors.border,
                        backgroundColor: genderDraft === option ? colors.primary + '18' : colors.background,
                      },
                    ]}
                    onPress={() => setGenderDraft(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: genderDraft === option }}
                  >
                    <Text style={[styles.choiceText, { color: genderDraft === option ? colors.primary : colors.text }]}>
                      {option === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Activity level</Text>
              <View style={styles.activityChoices}>
                {([
                  ['sedentary', 'Sedentary'],
                  ['light', 'Light'],
                  ['moderate', 'Moderate'],
                ] as const).map(([option, label]) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.activityChoice,
                      {
                        borderColor: activityDraft === option ? colors.primary : colors.border,
                        backgroundColor: activityDraft === option ? colors.primary + '18' : colors.background,
                      },
                    ]}
                    onPress={() => setActivityDraft(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activityDraft === option }}
                  >
                    <Text style={[styles.choiceText, { color: activityDraft === option ? colors.primary : colors.text }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.editorLabel, { color: colors.textSecondary }]}>Previous allergies (optional)</Text>
              <TextInput
                style={[
                  styles.nameInput,
                  styles.allergyInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                ]}
                value={allergiesDraft}
                onChangeText={setAllergiesDraft}
                placeholder="Add any allergies"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                textAlignVertical="top"
                accessibilityLabel="Previous allergies"
              />
              {!!nutritionError && <Text style={[styles.nameError, { color: colors.danger }]}>{nutritionError}</Text>}
              <View style={styles.nameEditorActions}>
                <TouchableOpacity
                  style={[styles.nameCancelButton, { borderColor: colors.border }]}
                  onPress={() => setIsNutritionEditorOpen(false)}
                  disabled={isSavingNutrition}
                  accessibilityRole="button"
                >
                  <Text style={[styles.nameCancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameSaveButton, { backgroundColor: colors.primary }]}
                  onPress={() => void saveNutritionDetails()}
                  disabled={isSavingNutrition}
                  accessibilityRole="button"
                  accessibilityLabel="Save nutrition details"
                >
                  {isSavingNutrition
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.nameSaveText}>Save details</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  allergiesLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  allergiesValue: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  nutritionLoadError: {
    marginBottom: 4,
  },
  nutritionEditButton: {
    marginTop: 2,
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
  nutritionEditor: {
    maxHeight: '90%',
    borderRadius: 22,
    padding: 20,
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
  nutritionInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  nutritionInputGroup: {
    flex: 1,
  },
  editorLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceButton: {
    minHeight: 42,
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activityChoices: {
    flexDirection: 'row',
    gap: 8,
  },
  activityChoice: {
    minHeight: 40,
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  allergyInput: {
    minHeight: 76,
    paddingTop: 12,
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
