import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { processAgentMessage } from '@/services/ai/vitalizeAgent';
import { VoiceInputButton } from '@/components/chat/VoiceInputButton';
import {
  speechToTextService,
  VoiceState,
} from '@/services/voice/speechToTextService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isVoice?: boolean;
}

const QUICK_SUGGESTIONS = [
  { label: '📊 Check my BP', prompt: 'Mera BP check karo' },
  { label: '📈 7-day BP trend', prompt: 'Mera 7 din ka BP trend batao' },
  { label: '🏋️ Today\'s workout', prompt: 'Aaj ka workout kya hai?' },
  { label: '💪 Yesterday\'s progress', prompt: 'Maine kal kitni exercises complete ki?' },
  { label: '❤️ Latest vitals', prompt: 'Meri latest BP reading batao' },
];

export default function ChatScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Pulsing animation for listening state
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (voiceState === 'listening') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [voiceState, pulseAnim]);

  // Clean error message banner after a few seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const msgIdCounter = useRef(0);

  const getNextId = (prefix: string) => {
    msgIdCounter.current += 1;
    return `${prefix}-${msgIdCounter.current}`;
  };

  const handleSendMessage = async (textToSend?: string, wasSpoken: boolean = false) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isProcessingAI) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: getNextId('user'),
      sender: 'user',
      text,
      timestamp: timeStr,
      isVoice: wasSpoken,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setErrorMessage(null);
    setIsProcessingAI(true);

    try {
      // UNIFIED PIPELINE: Both voice transcripts and typed text pass into the same agent
      const agentResult = await processAgentMessage(text, user);

      const aiMsg: ChatMessage = {
        id: getNextId('ai'),
        sender: 'assistant',
        text: agentResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[ChatScreen] AI message failed:', err);
      const fallbackMsg: ChatMessage = {
        id: getNextId('ai-err'),
        sender: 'assistant',
        text: "I'm having trouble connecting right now. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsProcessingAI(false);
    }
  };

  /**
   * Option A Transcript UX:
   * Places transcript into text input and allows user to review/edit,
   * with automatic focus so they can send or adjust health terms immediately.
   */
  const handleVoiceTranscript = (transcript: string) => {
    setInputText(transcript);
    setErrorMessage(null);
  };

  const handleVoiceError = (errorMsg: string) => {
    setErrorMessage(errorMsg);
  };

  const handleCancelListening = async () => {
    await speechToTextService.cancelListening();
    setVoiceState('idle');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.backgroundElement,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Vitalize AI</Text>
              <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Your health companion
            </Text>
          </View>

          <View style={[styles.sparkleBadge, { backgroundColor: colors.primary + '16' }]}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
        </View>

        {/* Error Notification Banner */}
        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: colors.danger + '18', borderColor: colors.danger }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
          </View>
        )}

        {/* Messages List / Empty State */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.heroIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="sparkles" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Vitalize AI Assistant</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Ask me about your blood pressure trends, {"today's"} workout, completed exercises, or general wellness.
            </Text>

            <View style={styles.suggestionsContainer}>
              <Text style={[styles.suggestionsLabel, { color: colors.textSecondary }]}>
                Try asking:
              </Text>
              <View style={styles.suggestionsGrid}>
                {QUICK_SUGGESTIONS.map((s, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSendMessage(s.prompt, false)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                  >
                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.assistantRow,
                  ]}
                >
                  {!isUser && (
                    <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="sparkles" size={14} color={colors.primary} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [
                            styles.assistantBubble,
                            {
                              backgroundColor: colors.backgroundElement,
                              borderColor: colors.border,
                            },
                          ],
                    ]}
                  >
                    {item.isVoice && isUser && (
                      <View style={styles.voiceIndicatorRow}>
                        <Ionicons name="mic" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.voiceIndicatorText}>Spoken</Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isUser ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.timestampText,
                        {
                          color: isUser ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
                        },
                      ]}
                    >
                      {item.timestamp}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* AI Thinking Indicator */}
        {isProcessingAI && (
          <View style={styles.thinkingContainer}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
            </View>
            <View
              style={[
                styles.thinkingBubble,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
                Vitalize AI is thinking...
              </Text>
            </View>
          </View>
        )}

        {/* Listening Active Bar */}
        {voiceState === 'listening' && (
          <View
            style={[
              styles.listeningBanner,
              {
                backgroundColor: colors.backgroundElement,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.recordingPulseDot,
                {
                  backgroundColor: colors.danger,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.listeningTitle, { color: colors.text }]}>
                Listening to your voice...
              </Text>
              <Text style={[styles.listeningSubtitle, { color: colors.textSecondary }]}>
                Tap stop when finished speaking
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.cancelListeningBtn, { borderColor: colors.border }]}
              onPress={handleCancelListening}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Composer Bar */}
        <View
          style={[
            styles.composerContainer,
            {
              backgroundColor: colors.backgroundElement,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Type a message or tap 🎤..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={600}
            editable={!isProcessingAI}
          />

          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            onError={handleVoiceError}
            onStateChange={setVoiceState}
            disabled={isProcessingAI}
          />

          {inputText.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => handleSendMessage()}
              disabled={isProcessingAI}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  sparkleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  suggestionsContainer: {
    width: '100%',
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  voiceIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voiceIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  thinkingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  recordingPulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  listeningTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  listeningSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  cancelListeningBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
