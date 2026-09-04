import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { AIService, DisabilityCategory, DisabilityCategories } from '@/services/aiService';
import { VitalsService } from '@/services/vitalsService';
import { useAuth } from '@/store/AuthContext';

export default function ReportUploadScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<DisabilityCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DisabilityCategory | null>(null);
  const [showManualSelection, setShowManualSelection] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };

      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission required', 'Camera access is required to capture report photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission required', 'Gallery access is required to select report photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        // Detect mime type from the URI
        const mimeType = asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        if (asset.base64) {
          analyzeImage(asset.base64, mimeType);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const analyzeImage = async (base64: string, mimeType: string = 'image/jpeg') => {
    setIsAnalyzing(true);
    setAiResult(null);
    setShowManualSelection(false);

    try {
      const result = await AIService.classifyReport(base64, mimeType);
      setIsAnalyzing(false);

      if (result === 'unclear') {
        Alert.alert(
          'Unclear Classification',
          'The AI could not confidently detect your disability category from the image. Please choose your category manually below.',
          [{ text: 'OK', onPress: () => setShowManualSelection(true) }]
        );
      } else {
        setAiResult(result);
        setSelectedCategory(result);
      }
    } catch (error: any) {
      setIsAnalyzing(false);
      console.error('Analysis failed:', error);
      Alert.alert(
        'AI Analysis Failed',
        `Error: ${error?.message || 'Unknown error'}. Please select your category manually.`,
        [{ text: 'OK', onPress: () => setShowManualSelection(true) }]
      );
    }
  };

  const handleSave = async () => {
    if (!user || !selectedCategory || selectedCategory === 'unclear') return;

    await VitalsService.updateUserProfile(user, { disabilityCategory: selectedCategory });
    
    Alert.alert('Profile Saved', `Your category has been updated to ${selectedCategory}.`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  // Determine current step index
  let currentStep = 1;
  if (imageUri && isAnalyzing) currentStep = 2;
  if (imageUri && !isAnalyzing && (aiResult || showManualSelection)) currentStep = 3;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Navigation Bar */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Medical Report AI</Text>
        <TouchableOpacity style={[styles.closeCircle, { backgroundColor: colors.backgroundElement }]} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 3 Step Indicator */}
      <View style={styles.stepContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepDot, currentStep >= 1 ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]}>
            <Text style={styles.stepDotText}>1</Text>
          </View>
          <Text style={[styles.stepLabel, { color: currentStep >= 1 ? colors.text : colors.textSecondary }]}>Upload</Text>
        </View>

        <View style={[styles.stepLine, { backgroundColor: currentStep >= 2 ? colors.primary : colors.border }]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, currentStep >= 2 ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]}>
            <Text style={styles.stepDotText}>2</Text>
          </View>
          <Text style={[styles.stepLabel, { color: currentStep >= 2 ? colors.text : colors.textSecondary }]}>AI Scan</Text>
        </View>

        <View style={[styles.stepLine, { backgroundColor: currentStep >= 3 ? colors.primary : colors.border }]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, currentStep >= 3 ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]}>
            <Text style={styles.stepDotText}>3</Text>
          </View>
          <Text style={[styles.stepLabel, { color: currentStep >= 3 ? colors.text : colors.textSecondary }]}>Confirm</Text>
        </View>
      </View>

      {!imageUri ? (
        <View style={styles.uploadSection}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Upload your medical or disability report. AI vision will scan the document and suggest your mobility category to personalize your plans.
          </Text>

          <TouchableOpacity 
            style={[styles.pickerCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]} 
            onPress={() => pickImage(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.pickerIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="camera" size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Take Photo with Camera</Text>
              <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>Snap a clear picture of your report</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.pickerCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]} 
            onPress={() => pickImage(false)}
            activeOpacity={0.8}
          >
            <View style={[styles.pickerIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="images" size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose from Photo Gallery</Text>
              <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>Select an existing image or document</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.manualLink} 
            onPress={() => setShowManualSelection(true)}
          >
            <Text style={[styles.manualLinkText, { color: colors.primary }]}>
              Or skip upload & select category manually →
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultSection}>
          <View style={[styles.imageFrame, { borderColor: colors.border }]}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          </View>

          {isAnalyzing && (
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingTitle, { color: colors.text }]}>AI Scanning Report...</Text>
              <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>Analyzing medical text with Gemini Vision AI</Text>
            </View>
          )}

          {!isAnalyzing && aiResult && aiResult !== 'unclear' && !showManualSelection && (
            <View style={[styles.aiResultCard, { backgroundColor: colors.backgroundElement, borderColor: colors.primary }]}>
              <View style={styles.aiBadgeRow}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.aiResultHeader, { color: colors.primary }]}>AI Classification Suggestion</Text>
              </View>

              <Text style={[styles.aiCategoryTitle, { color: colors.text }]}>{aiResult}</Text>
              <Text style={[styles.aiConfirmQuestion, { color: colors.textSecondary }]}>
                Does this category match your medical report diagnosis?
              </Text>

              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.success }]} 
                onPress={handleSave}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.buttonText}>Confirm & Save Category</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.secondaryButton, { borderColor: colors.border, marginTop: 12 }]} 
                onPress={() => setShowManualSelection(true)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Incorrect? Choose Manually</Text>
              </TouchableOpacity>
            </View>
          )}

          {(!isAnalyzing && (showManualSelection || aiResult === 'unclear')) && (
            <View style={styles.manualSelectionContainer}>
              <Text style={[styles.manualTitle, { color: colors.text }]}>Select Your Disability Category:</Text>
              <Text style={[styles.manualSubtitle, { color: colors.textSecondary }]}>Choose the option that matches your diagnosis</Text>

              {DisabilityCategories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryCard,
                      { backgroundColor: colors.backgroundElement, borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { borderWidth: 2, backgroundColor: colors.primary + '12' }
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Ionicons 
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={isSelected ? colors.primary : colors.textSecondary} 
                      style={{ marginRight: 12 }}
                    />
                    <Text style={[styles.categoryCardText, { color: isSelected ? colors.primary : colors.text }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity 
                style={[
                  styles.button, 
                  { backgroundColor: selectedCategory && selectedCategory !== 'unclear' ? colors.primary : colors.border },
                  { marginTop: 24 }
                ]} 
                onPress={handleSave}
                disabled={!selectedCategory || selectedCategory === 'unclear'}
              >
                <Text style={styles.buttonText}>Save Profile Category</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={styles.reuploadButton} 
            onPress={() => {
              setImageUri(null);
              setAiResult(null);
              setShowManualSelection(false);
            }}
          >
            <Text style={[styles.reuploadText, { color: colors.textSecondary }]}>← Upload a different report image</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  uploadSection: {
    marginTop: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  pickerSubtitle: {
    fontSize: 13,
  },
  manualLink: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  manualLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultSection: {
    alignItems: 'stretch',
  },
  imageFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  card: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 13,
  },
  aiResultCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiResultHeader: {
    fontSize: 14,
    fontWeight: '700',
  },
  aiCategoryTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  aiConfirmQuestion: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  manualSelectionContainer: {
    marginTop: 8,
  },
  manualTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  manualSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  categoryCardText: {
    fontSize: 17,
    fontWeight: '700',
  },
  reuploadButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  reuploadText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
