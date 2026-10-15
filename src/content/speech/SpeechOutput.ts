export interface SpeechOutput {
  readonly supported: boolean;
  speak(text: string, onEnd: () => void): void;
  stop(): void;
}

/** Local text-to-speech via speechSynthesis. */
export class BrowserSpeechOutput implements SpeechOutput {
  constructor(private readonly lang = 'pt-PT') {}

  get supported(): boolean {
    return 'speechSynthesis' in window;
  }

  speak(text: string, onEnd: () => void): void {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.lang;
    const voices = speechSynthesis.getVoices();
    const prefix = this.lang.split('-')[0];
    utterance.voice =
      voices.find((v) => v.lang === this.lang) ?? voices.find((v) => v.lang.startsWith(prefix)) ?? null;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    speechSynthesis.speak(utterance);
  }

  stop(): void {
    speechSynthesis.cancel();
  }
}
