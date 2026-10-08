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
  AI_REQUEST_TIMEOUT_MS,
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
      if (typeof recorder.stopAndUnloadAsync !== 'function') {
        recorder.stopAndUnloadAsync = async () => recorder.stop();
      }
      if (typeof recorder.getURI !== 'function') {
        recorder.getURI = () => recorder.uri;
      }
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
      const recording = this.activeRecorder;
      this.activeRecorder = null;

      try {
        // Ensure recording is fully stopped and unloaded before reading getURI()
        if (typeof recording.stopAndUnloadAsync === 'function') {
          await recording.stopAndUnloadAsync();
        } else if (typeof recording.stop === 'function') {
          await recording.stop();
        }

        const recordingUri =
          (typeof recording.getURI === 'function' ? recording.getURI() : null) || recording.uri;

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
        if (typeof this.activeRecorder.stopAndUnloadAsync === 'function') {
          await this.activeRecorder.stopAndUnloadAsync();
        } else if (typeof this.activeRecorder.stop === 'function') {
          await this.activeRecorder.stop();
        }
      } catch {}
      this.activeRecorder = null;
    }

    this.webTranscript = '';
  }

  /**
   * Performs multipart upload to Groq Whisper.
   * Does NOT manually set Content-Type header to allow multipart boundary auto-generation.
   * If Expo Winter Fetch fails with "Unsupported FormDataPart implementation",
   * falls back directly to React Native native XMLHttpRequest.
   */
  private async uploadToGroq(
    apiKey: string,
    formData: FormData
  ): Promise<{ status: number; text: string }> {
    try {
      // Do NOT set Content-Type header manually; let RN set the multipart boundary
      const response = await fetch(AI_ENDPOINTS.groqWhisper, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      return { status: response.status, text: responseText };
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      // When Expo Winter Fetch rejects RN FormData { uri, name, type }, fallback to RN XMLHttpRequest
      if (
        (errMsg.includes('FormDataPart') || errMsg.includes('Unsupported')) &&
        typeof XMLHttpRequest !== 'undefined'
      ) {
        console.log('[SpeechToTextService] Expo fetch FormDataPart error detected. Falling back to XMLHttpRequest.');
        return await new Promise<{ status: number; text: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', AI_ENDPOINTS.groqWhisper);
          xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
          // Do NOT set Content-Type; let RN set multipart boundary
          xhr.onload = () => {
            resolve({ status: xhr.status, text: xhr.responseText });
          };
          xhr.onerror = () => {
            reject(new Error(`Network request failed with status ${xhr.status}`));
          };
          xhr.ontimeout = () => {
            reject(new Error('Transcription request timed out'));
          };
          xhr.timeout = AI_REQUEST_TIMEOUT_MS;
          xhr.send(formData);
        });
      }
      throw err;
    }
  }

  /**
   * Sends audio to Groq Whisper API for high-accuracy multilingual transcription.
   * Fields: model "whisper-large-v3-turbo", language "hi".
   */
  private async transcribeAudioWithGroq(recordingUri: string): Promise<string> {
    const apiKey = getGroqApiKey();
    if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
      throw new VoiceRecognitionError(
        'Voice service is temporarily unconfigured. Please type your message.',
        'TRANSCRIPTION_FAILED'
      );
    }

    const formData = new FormData();

    // In React Native, local file URIs are sent via { uri, name, type }
    formData.append('file', {
      uri: recordingUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as any);

    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'hi');

    try {
      const { status, text: responseText } = await this.uploadToGroq(apiKey, formData);

      console.log(`[SpeechToTextService] Groq Whisper response status: ${status}`);
      console.log(`[SpeechToTextService] Groq Whisper response body:`, responseText);

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      if (status < 200 || status >= 300) {
        const errMsg = data?.error?.message || `Groq Whisper failed with HTTP ${status}`;
        throw new VoiceRecognitionError(errMsg, 'TRANSCRIPTION_FAILED');
      }

      return data?.text || '';
    } catch (error: any) {
      console.log('[SpeechToTextService] Transcription request failed:', error?.message || error);
      if (error instanceof VoiceRecognitionError) throw error;
      throw new VoiceRecognitionError(
        error?.message || 'Transcription failed. Please try again.',
        'TRANSCRIPTION_FAILED'
      );
    }
  }
}

export const speechToTextService = new SpeechToTextService();
