import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import {
  isValidEmergencyNumber,
  isValidMobilePhone,
  loadEmergencyConfig,
  normalizePhone,
  saveEmergencyConfig,
} from '@/lib/emergencyStorage';
import { useAuth } from '@/store/AuthContext';
import { EmergencyConfig, FamilyContact } from '@/types/contacts';

export default function EmergencyContactsScreen() {
  const { user } = useAuth();
  const colors = useTheme();
  const router = useRouter();
  const [config, setConfig] = useState<EmergencyConfig>({ family: [], ambulance: '108' });
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [ambulance, setAmbulance] = useState('108');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;
    if (!user) {
      return () => {
        isActive = false;
      };
    }

    void loadEmergencyConfig(user).then((loadedConfig) => {
      if (!isActive) return;
      setConfig(loadedConfig);
      setAmbulance(loadedConfig.ambulance);
      setIsLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, [user]);

  const addContact = () => {
    const normalizedPhone = normalizePhone(phone);
    if (!name.trim() || !relation.trim()) {
      Alert.alert('Contact details needed', 'Enter a name and relationship for this contact.');
      return;
    }
    if (!isValidMobilePhone(normalizedPhone)) {
      Alert.alert('Invalid phone number', 'Enter a valid Indian mobile number, with or without +91.');
      return;
    }

    const contact: FamilyContact = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      relation: relation.trim(),
      phone: normalizedPhone,
      isPrimary: config.family.length === 0,
    };
    setConfig((current) => ({ ...current, family: [...current.family, contact] }));
    setName('');
    setRelation('');
    setPhone('');
  };

  const makePrimary = (id: string) => {
    setConfig((current) => ({
      ...current,
      family: current.family.map((contact) => ({ ...contact, isPrimary: contact.id === id })),
    }));
  };

  const removeContact = (id: string) => {
    setConfig((current) => {
      const remaining = current.family.filter((contact) => contact.id !== id);
      if (remaining.length > 0 && !remaining.some((contact) => contact.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return { ...current, family: remaining };
    });
  };

  const save = async () => {
    if (!user) return;
    if (!isValidEmergencyNumber(ambulance)) {
      Alert.alert('Invalid ambulance number', 'Use 108, 112, 100, or a valid Indian mobile number.');
      return;
    }
    if (config.family.length > 0 && config.family.filter((contact) => contact.isPrimary).length !== 1) {
      Alert.alert('Choose one primary contact', 'Exactly one family contact must be marked primary.');
      return;
    }

    setIsSaving(true);
    try {
      const synced = await saveEmergencyConfig(user, {
        ...config,
        ambulance: normalizePhone(ambulance),
      });
      Alert.alert(
        synced ? 'Contacts saved' : 'Saved on this device',
        synced
          ? 'Your emergency contacts are saved and synced.'
          : 'Your emergency contacts are available on this device. Cloud sync could not complete.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error) {
      console.error('Unable to save emergency contacts locally:', error);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundElement },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={23} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Emergency Contacts</Text>
          </View>

          {isLoading ? (
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Loading contacts…</Text>
          ) : (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                These numbers stay private to your account and are available offline on this device.
              </Text>

              <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ambulance number</Text>
                <TextInput
                  value={ambulance}
                  onChangeText={setAmbulance}
                  keyboardType="phone-pad"
                  placeholder="108"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle}
                  accessibilityLabel="Ambulance phone number"
                />
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  Emergency short codes 108, 112, and 100 are accepted.
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Family contacts</Text>
                {config.family.map((contact) => (
                  <View key={contact.id} style={[styles.contactRow, { borderColor: colors.border }]}>
                    <View style={styles.contactDetails}>
                      <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                      <Text style={[styles.helper, { color: colors.textSecondary }]}>
                        {contact.relation} · {contact.phone}
                      </Text>
                      {contact.isPrimary && (
                        <Text style={[styles.primaryBadge, { color: colors.primary }]}>PRIMARY</Text>
                      )}
                    </View>
                    <View style={styles.contactActions}>
                      {!contact.isPrimary && (
                        <TouchableOpacity
                          onPress={() => makePrimary(contact.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Set ${contact.name} as primary`}
                          style={styles.smallAction}
                        >
                          <Ionicons name="star-outline" size={19} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => removeContact(contact.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${contact.name}`}
                        style={styles.smallAction}
                      >
                        <Ionicons name="trash-outline" size={19} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {config.family.length === 0 && (
                  <Text style={[styles.helper, { color: colors.textSecondary }]}>
                    Add someone you trust to contact in an emergency.
                  </Text>
                )}

                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle}
                  accessibilityLabel="Contact name"
                />
                <TextInput
                  value={relation}
                  onChangeText={setRelation}
                  placeholder="Relationship (for example, sibling)"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle}
                  accessibilityLabel="Relationship to contact"
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Mobile number"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle}
                  accessibilityLabel="Family contact mobile number"
                />
                <TouchableOpacity
                  style={[styles.addButton, { borderColor: colors.primary }]}
                  onPress={addContact}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={[styles.addButtonText, { color: colors.primary }]}>Add contact</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={() => void save()}
                disabled={isSaving}
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving…' : 'Save emergency contacts'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 5,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  statusText: {
    textAlign: 'center',
    marginTop: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
    marginTop: 10,
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBadge: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  contactActions: {
    flexDirection: 'row',
  },
  smallAction: {
    padding: 8,
  },
  addButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 5,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
