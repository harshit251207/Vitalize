import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SMS from 'expo-sms';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { loadEmergencyConfig } from '@/lib/emergencyStorage';
import { useAuth } from '@/store/AuthContext';
import { EmergencyConfig, FamilyContact } from '@/types/contacts';

interface SOSSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SOSSheet({ visible, onClose }: SOSSheetProps) {
  const { user } = useAuth();
  const colors = useTheme();
  const router = useRouter();
  const [config, setConfig] = useState<EmergencyConfig>({
    family: [],
    ambulance: '108',
  });

  useEffect(() => {
    let isActive = true;
    if (visible && user) {
      void loadEmergencyConfig(user).then((loadedConfig) => {
        if (isActive) setConfig(loadedConfig);
      });
    }
    return () => {
      isActive = false;
    };
  }, [user, visible]);

  const placeCall = async (phone: string) => {
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      console.error('Unable to open phone dialer:', error);
      Alert.alert('Unable to call', 'Your device could not open the phone dialer.');
    }
  };

  const sendMessage = async () => {
    const numbers = config.family.map((contact) => contact.phone);
    if (numbers.length === 0) {
      Alert.alert('No family contacts', 'Add a family contact before sending an SOS message.');
      return;
    }

    try {
      const available = await SMS.isAvailableAsync();
      if (!available) {
        Alert.alert('Messaging unavailable', 'SMS is not available on this device.');
        return;
      }
      await SMS.sendSMSAsync(numbers, 'I need help. Please contact me as soon as possible.');
    } catch (error) {
      console.error('Unable to open SMS composer:', error);
      Alert.alert('Unable to send message', 'Your device could not open the SMS composer.');
    }
  };

  const primaryContact: FamilyContact | undefined =
    config.family.find((contact) => contact.isPrimary) ?? config.family[0];
  const otherContacts = config.family.filter((contact) => contact.id !== primaryContact?.id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close SOS options" />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.danger + '1A' }]}>
              <Ionicons name="alert" size={24} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Emergency help</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Choose who you need to contact.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close-circle-outline" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.danger }]}
              onPress={() => void placeCall(config.ambulance)}
              accessibilityRole="button"
              accessibilityLabel={`Call ambulance at ${config.ambulance}`}
            >
              <Ionicons name="call" size={21} color="#FFFFFF" />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Call Ambulance</Text>
                <Text style={styles.actionSubtitle}>{config.ambulance}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {primaryContact ? (
              <TouchableOpacity
                style={[styles.familyButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                onPress={() => void placeCall(primaryContact.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Call primary family contact ${primaryContact.name}`}
              >
                <Ionicons name="person" size={20} color={colors.primary} />
                <View style={styles.actionText}>
                  <Text style={[styles.familyTitle, { color: colors.text }]}>
                    Call Family · {primaryContact.name}
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    {primaryContact.relation} · {primaryContact.phone}
                  </Text>
                </View>
                <Ionicons name="call-outline" size={19} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.emptyFamily, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No family contacts yet. You can still call the ambulance above.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    router.push('/emergency-contacts');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.manageLink, { color: colors.primary }]}>Add emergency contacts</Text>
                </TouchableOpacity>
              </View>
            )}

            {otherContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[styles.familyButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                onPress={() => void placeCall(contact.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${contact.name}`}
              >
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <View style={styles.actionText}>
                  <Text style={[styles.familyTitle, { color: colors.text }]}>{contact.name}</Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    {contact.relation} · {contact.phone}
                  </Text>
                </View>
                <Ionicons name="call-outline" size={19} color={colors.primary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.messageButton, { borderColor: colors.primary }]}
              onPress={() => void sendMessage()}
              accessibilityRole="button"
              accessibilityLabel="Send SOS message to family"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.primary} />
              <Text style={[styles.messageText, { color: colors.primary }]}>Send SOS message</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#A0A0A0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  actionSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  familyButton: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  familyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyFamily: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  manageLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  messageButton: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 4,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
