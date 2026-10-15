export interface SpeechInput {
  readonly supported: boolean;
  /** Starts dictation. `onTranscript` receives the full transcript of the current session on every update. */
  start(onTranscript: (text: string) => void, onError: (message: string) => void, onEnd: () => void): void;
  stop(): void;
}

// Minimal typing for the Web Speech API, which is not in the TypeScript DOM lib.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada.',
  'audio-capture': 'Nenhum microfone disponível.',
  network: 'Erro de rede no reconhecimento de voz.',
};

/** Chrome's Web Speech API. Audio is processed by Google's speech service. */
export class WebSpeechInput implements SpeechInput {
  private readonly Ctor: RecognitionConstructor | undefined;
  private recognition: Recognition | null = null;

  constructor(private readonly lang = 'pt-PT') {
    const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    this.Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  }

  get supported(): boolean {
    return this.Ctor !== undefined;
  }

  start(onTranscript: (text: string) => void, onError: (message: string) => void, onEnd: () => void): void {
    if (!this.Ctor || this.recognition) return;
    const recognition = new this.Ctor();
    recognition.lang = this.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0].transcript).join('');
      onTranscript(text);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError(ERROR_MESSAGES[event.error] ?? `Erro no reconhecimento de voz: ${event.error}`);
      }
    };
    recognition.onend = () => {
      this.recognition = null;
      onEnd();
    };
    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }
}
