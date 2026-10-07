import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import {
  speechToTextService,
  VoiceState,
  VoiceRecognitionError,
} from '@/services/voice/speechToTextService';

interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void;
  onError: (errorMessage: string) => void;
  onStateChange?: (state: VoiceState) => void;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  onError,
  onStateChange,
  disabled = false,
}) => {
  const colors = useTheme();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');

  const updateState = (state: VoiceState) => {
    setVoiceState(state);
    onStateChange?.(state);
  };

  const handlePress = async () => {
    if (disabled) return;

    // If currently listening, tapping stops and transcribes
    if (voiceState === 'listening') {
      updateState('processing');
      try {
        const text = await speechToTextService.stopListening();
        updateState('idle');
        if (text && text.trim()) {
          onTranscript(text.trim());
        }
      } catch (err: any) {
        updateState('error');
        const msg =
          err instanceof VoiceRecognitionError
            ? err.message
            : 'Transcription failed. Please try again.';
        onError(msg);
        setTimeout(() => updateState('idle'), 2500);
      }
      return;
    }

    // If idle or error, tap starts listening
    if (voiceState === 'idle' || voiceState === 'error') {
      updateState('requesting_permission');
      try {
        await speechToTextService.startListening();
        updateState('listening');
      } catch (err: any) {
        updateState('error');
        const msg =
          err instanceof VoiceRecognitionError
            ? err.message
            : 'Could not access microphone. Please check permissions.';
        onError(msg);
        setTimeout(() => updateState('idle'), 3000);
      }
    }
  };

  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing' || voiceState === 'requesting_permission';

  const accessibilityLabel = isListening
    ? 'Listening. Tap to stop recording voice message'
    : isProcessing
    ? 'Processing audio'
    : 'Tap to speak voice message';

  const accessibilityHint = isListening
    ? 'Stops recording and transcribes your speech into text'
    : 'Starts microphone to speak your question to Vitalize AI';

  return (
    <TouchableOpacity
      style={[
        styles.micButton,
        {
          backgroundColor: isListening
            ? colors.danger
            : isProcessing
            ? colors.warning
            : colors.primary + '18',
        },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled || isProcessing}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        busy: isProcessing || isListening,
        disabled,
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {isProcessing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : isListening ? (
        <View style={styles.listeningContainer}>
          <Ionicons name="stop" size={20} color="#FFFFFF" />
        </View>
      ) : (
        <Ionicons
          name="mic"
          size={22}
          color={voiceState === 'error' ? colors.danger : colors.primary}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  listeningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
