import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import {
  AI_ENDPOINTS,
  GROQ_WHISPER_MODEL,
  VOICE_LANGUAGE,
  getGroqApiKey,
} from '@/config/ai';

export type VoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'error';

export class VoiceRecognitionError extends Error {
  code: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'NO_SPEECH' | 'TRANSCRIPTION_FAILED';

  constructor(
    message: string,
    code: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'NO_SPEECH' | 'TRANSCRIPTION_FAILED'
  ) {
    super(message);
    this.name = 'VoiceRecognitionError';
    this.code = code;
  }
}

class SpeechToTextService {
  private activeRecorder: any = null;
  private webRecognition: any = null;
  private isListening = false;
  private webTranscript = '';

  /**
   * Checks if voice input is supported on the current device/browser.
   */
  public isSupported(): boolean {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const hasWebSpeech =
          'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
        const hasMediaDevices =
          !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
        return hasWebSpeech || hasMediaDevices;
      }
      return false;
    }
    // Native mobile (iOS & Android) supported via expo-audio + Groq Whisper
    return true;
  }

  /**
   * Requests microphone permission.
   */
  public async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release media tracks after check
            stream.getTracks().forEach((track) => track.stop());
            return true;
          } catch {
            return false;
          }
        }
        return true;
      }

      const current = await getRecordingPermissionsAsync();
      if (current.granted) return true;

      const requested = await requestRecordingPermissionsAsync();
      return requested.granted;
    } catch (e) {
      console.warn('[SpeechToTextService] Permission request failed:', e);
      return false;
    }
  }

  /**
   * Starts recording/listening.
   * On Web with WebSpeech API, sets up live recognition.
   * On Mobile or fallback, sets up expo-audio high quality recording.
   */
  public async startListening(
    onPartialTranscript?: (transcript: string) => void
  ): Promise<void> {
    if (this.isListening) {
      console.warn('[SpeechToTextService] Already listening. Ignoring duplicate start.');
      return;
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new VoiceRecognitionError(
        'Microphone permission is required for voice input.',
        'PERMISSION_DENIED'
      );
    }

    this.isListening = true;
    this.webTranscript = '';

    // Strategy 1: Browser Web Speech API if on web and supported
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    ) {
      try {
        const SpeechRec =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRec();

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = VOICE_LANGUAGE; // 'en-IN' supports Indian English & Hindi

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          this.webTranscript = current;
          onPartialTranscript?.(current);
        };

        recognition.onerror = (err: any) => {
          console.warn('[SpeechToTextService] Web Speech error:', err);
        };

        recognition.start();
        this.webRecognition = recognition;
        return;
      } catch (webErr) {
        console.warn('[SpeechToTextService] Web speech init failed, falling back to audio recording:', webErr);
      }
    }

    // Strategy 2: Native Audio Recording via expo-audio
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const AudioRecorderConstructor = (AudioModule as any)?.AudioRecorder;
      if (!AudioRecorderConstructor) {
        throw new Error('Audio recording is not supported on this platform.');
      }
      const recorder = new AudioRecorderConstructor(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
      this.activeRecorder = recorder;
    } catch (err: any) {
      this.isListening = false;
      this.activeRecorder = null;
      throw new VoiceRecognitionError(
        err?.message || 'Voice input is unavailable on this device. You can type your message instead.',
        'UNAVAILABLE'
      );
    }
  }

  /**
   * Stops recording and returns the final transcribed text.
   */
  public async stopListening(): Promise<string> {
    if (!this.isListening) {
      return '';
    }

    this.isListening = false;

    // Finish Web Speech if active
    if (this.webRecognition) {
      const rec = this.webRecognition;
      this.webRecognition = null;
      try {
        rec.stop();
      } catch {}

      const result = this.webTranscript.trim();
      if (!result) {
        throw new VoiceRecognitionError(
          'No speech detected. Please tap and speak clearly.',
          'NO_SPEECH'
        );
      }
      return result;
    }

    // Finish Native Recorder if active
    if (this.activeRecorder) {
      const recorder = this.activeRecorder;
      this.activeRecorder = null;

      try {
        await recorder.stop();
        const recordingUri = recorder.uri;

        if (!recordingUri) {
          throw new VoiceRecognitionError(
            'No audio was captured. Please try speaking again.',
            'NO_SPEECH'
          );
        }

        // Transcribe via Groq Whisper API
        const transcript = await this.transcribeAudioWithGroq(recordingUri);

        if (!transcript.trim()) {
          throw new VoiceRecognitionError(
            'No speech detected. Please speak clearly and try again.',
            'NO_SPEECH'
          );
        }

        return transcript.trim();
      } catch (e: any) {
        if (e instanceof VoiceRecognitionError) throw e;
        throw new VoiceRecognitionError(
          e?.message || 'Speech recognition encountered an error. Please try again.',
          'TRANSCRIPTION_FAILED'
        );
      }
    }

    return '';
  }

  /**
   * Cancels current recording without transcribing.
   */
  public async cancelListening(): Promise<void> {
    this.isListening = false;

    if (this.webRecognition) {
      try {
        this.webRecognition.abort();
      } catch {}
      this.webRecognition = null;
    }

    if (this.activeRecorder) {
      try {
        await this.activeRecorder.stop();
      } catch {}
      this.activeRecorder = null;
    }

    this.webTranscript = '';
  }

  /**
   * Sends audio to Groq Whisper API for high-accuracy multilingual transcription.
   * Reliably handles Hindi, English, and Hinglish.
   */
  private async transcribeAudioWithGroq(audioUri: string): Promise<string> {
    const apiKey = getGroqApiKey();
    if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
      throw new VoiceRecognitionError(
        'Voice service is temporarily unconfigured. Please type your message.',
        'TRANSCRIPTION_FAILED'
      );
    }

    const formData = new FormData();

    // In React Native, local file URIs are sent via { uri, name, type }
    const filePayload = {
      uri: audioUri,
      name: 'voice_input.m4a',
      type: 'audio/m4a',
    };

    formData.append('file', filePayload as any);
    formData.append('model', GROQ_WHISPER_MODEL);
    formData.append('response_format', 'json');
    formData.append('temperature', '0');
    // Prompt hints help Whisper accurately parse Hindi/Hinglish healthcare queries
    formData.append(
      'prompt',
      'Hindi, Hinglish, and English healthcare transcription: Mera BP check karo, 7 din ka trend, aaj ka workout, exercises, vitals'
    );

    const response = await fetch(AI_ENDPOINTS.groqWhisper, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message;
      throw new VoiceRecognitionError(
        err || `Groq Whisper failed with HTTP ${response.status}`,
        'TRANSCRIPTION_FAILED'
      );
    }

    return (data as { text?: string })?.text || '';
  }
}

export const speechToTextService = new SpeechToTextService();
