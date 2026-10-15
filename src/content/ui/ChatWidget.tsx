import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendToBackground, type BackgroundEvent } from '../../shared/messages';
import type { Attachment, ChatMessage, FillAction } from '../../shared/types';
import type { AttachmentReader } from '../attachments/AttachmentReader';
import type { FormFiller } from '../page/FormFiller';
import type { FormScanner } from '../page/FormScanner';
import type { PageContextReader } from '../page/PageContextReader';
import type { Screenshotter } from '../page/Screenshotter';
import type { SpeechInput } from '../speech/SpeechInput';
import type { SpeechOutput } from '../speech/SpeechOutput';
import {
  CameraIcon,
  ChatIcon,
  ClipIcon,
  CloseIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  MinimizeIcon,
  SendIcon,
  SpeakerIcon,
  StopIcon,
} from './icons';
import { useResizable } from './useResizable';

const ASSISTANT_NAME = 'Toninho';

interface Props {
  scanner: FormScanner;
  filler: FormFiller;
  contextReader: PageContextReader;
  attachmentReader: AttachmentReader;
  screenshotter: Screenshotter;
  speechInput: SpeechInput;
  speechOutput: SpeechOutput;
}

type ActionStatus = 'applied' | { error: string };

const remarkPlugins = [remarkGfm];
// Links open in a new tab so the user does not leave the form page.
const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  return (
    <>
      {attachment.kind === 'image' ? <ImageIcon /> : <FileIcon />}
      <span>{attachment.name}</span>
    </>
  );
}

export function ChatWidget({
  scanner,
  filler,
  contextReader,
  attachmentReader,
  screenshotter,
  speechInput,
  speechOutput,
}: Props) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Field ids are only valid for the current page load, so restored messages are read-only.
  const [liveFrom, setLiveFrom] = useState(0);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fieldLabels = useRef(new Map<string, string>());
  const listRef = useRef<HTMLDivElement>(null);
  const dictationPrefix = useRef('');
  const { size, startResize, reset: resetSize } = useResizable();

  useEffect(() => {
    sendToBackground({ type: 'CHAT_GET_STATE' })
      .then((state) => {
        setOpen(state.open);
        setMinimized(state.minimized ?? false);
        setMessages(state.messages);
        setLiveFrom(state.messages.length);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const onMessage = (event: BackgroundEvent) => {
      if (event.type === 'WIDGET_SET_VISIBLE') {
        setOpen(event.open);
        setMinimized(false);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, minimized]);

  async function send() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy || readingFiles) return;

    const fields = scanner.scan();
    fieldLabels.current = new Map(fields.map((f) => [f.id, f.label || f.name || f.placeholder || f.id]));
    const sent = attachments;

    setError(null);
    setBusy(true);
    try {
      const screenshot = includeScreenshot ? await screenshotter.capture() : undefined;
      setInput('');
      setAttachments([]);
      setMessages((m) => [...m, { role: 'user', content: text, attachments: sent }]);
      const reply = await sendToBackground({
        type: 'CHAT_SEND',
        text,
        attachments: sent,
        page: contextReader.read(),
        fields,
        screenshot,
      });
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setReadingFiles(true);
    const results = await Promise.allSettled(files.map((f) => attachmentReader.read(f)));
    setReadingFiles(false);

    const read = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason?.message ?? r.reason)] : []));
    setAttachments((a) => [...a, ...read]);
    setError(failures.length > 0 ? failures.join('\n') : null);
  }

  async function clear() {
    speechOutput.stop();
    setSpeakingIndex(null);
    await sendToBackground({ type: 'CHAT_CLEAR' });
    setMessages([]);
    setLiveFrom(0);
    setStatuses({});
    setError(null);
  }

  function apply(key: string, action: FillAction) {
    try {
      filler.apply(action);
      setStatuses((s) => ({ ...s, [key]: 'applied' }));
    } catch (e) {
      setStatuses((s) => ({ ...s, [key]: { error: e instanceof Error ? e.message : String(e) } }));
    }
  }

  function close() {
    speechOutput.stop();
    setSpeakingIndex(null);
    setOpen(false);
    sendToBackground({ type: 'WIDGET_SET_OPEN', open: false }).catch(() => undefined);
  }

  function changeMinimized(value: boolean) {
    setMinimized(value);
    sendToBackground({ type: 'WIDGET_SET_MINIMIZED', minimized: value }).catch(() => undefined);
  }

  function startDictation(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dictationPrefix.current = input.trim() ? `${input.trimEnd()} ` : '';
    setError(null);
    setListening(true);
    speechInput.start(
      (transcript) => setInput(dictationPrefix.current + transcript),
      (message) => setError(message),
      () => setListening(false),
    );
  }

  function toggleSpeak(index: number, text: string) {
    if (speakingIndex === index) {
      speechOutput.stop();
      setSpeakingIndex(null);
      return;
    }
    setSpeakingIndex(index);
    speechOutput.speak(text, () => setSpeakingIndex((current) => (current === index ? null : current)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) return null;

  if (minimized) {
    return (
      <button className="bubble" onClick={() => changeMinimized(false)} aria-label={`Abrir ${ASSISTANT_NAME}`}>
        <ChatIcon size={24} />
        {busy && <span className="bubble-busy" />}
      </button>
    );
  }

  const canSend = !busy && !readingFiles && (input.trim() !== '' || attachments.length > 0);

  return (
    <div
      className="panel"
      role="dialog"
      aria-label={ASSISTANT_NAME}
      style={{ width: size.width, height: size.height }}
    >
      <div
        className="resize-handle top"
        onPointerDown={(e) => startResize(e, { horizontal: false, vertical: true })}
      />
      <div
        className="resize-handle left"
        onPointerDown={(e) => startResize(e, { horizontal: true, vertical: false })}
      />
      <div
        className="resize-handle corner"
        title="Arrastar para redimensionar (duplo clique repõe)"
        onPointerDown={(e) => startResize(e, { horizontal: true, vertical: true })}
        onDoubleClick={resetSize}
      />
      <header>
        <div className="brand">
          <span className={busy ? 'status busy' : 'status'} />
          <div>
            <div className="title">{ASSISTANT_NAME}</div>
            <div className="subtitle">{busy ? 'A pensar…' : 'Assistente IA'}</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="text-button" onClick={() => void clear()} title="Limpar conversa">
            Limpar
          </button>
          <button className="icon-button" onClick={() => changeMinimized(true)} title="Minimizar" aria-label="Minimizar">
            <MinimizeIcon />
          </button>
          <button className="icon-button" onClick={close} title="Fechar" aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="hint">Peça ajuda para preencher este formulário ou para decidir entre opções.</p>
        )}
        {messages.map((message, i) => {
          const live = i >= liveFrom;
          const pending = (message.actions ?? []).map((a, j) => ({ a, key: `${i}:${j}` }));
          return (
            <div key={i} className={`message ${message.role}`}>
              <div className="author">{message.role === 'user' ? 'Você' : ASSISTANT_NAME}</div>
              <div className="bubble-content">
                {message.content &&
                  (message.role === 'assistant' ? (
                    <div className="content markdown">
                      <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
                        {message.content}
                      </Markdown>
                    </div>
                  ) : (
                    <div className="content">{message.content}</div>
                  ))}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="chips">
                    {message.attachments.map((a, j) => (
                      <span key={j} className="chip">
                        <AttachmentChip attachment={a} />
                      </span>
                    ))}
                  </div>
                )}
                {pending.length > 0 && (
                  <ul className="actions">
                    {pending.map(({ a, key }) => {
                      const status = statuses[key];
                      return (
                        <li key={key}>
                          <div>
                            <div className="field-name">{fieldLabels.current.get(a.fieldId) ?? a.fieldId}</div>
                            <div className="field-value">{a.value}</div>
                            {a.reason && <div className="reason">{a.reason}</div>}
                            {typeof status === 'object' && <div className="error">{status.error}</div>}
                          </div>
                          {live && (
                            <button
                              className="text-button accent"
                              disabled={status === 'applied'}
                              onClick={() => apply(key, a)}
                            >
                              {status === 'applied' ? 'Aplicado' : 'Aplicar'}
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {live && pending.length > 1 && (
                      <li>
                        <button
                          className="text-button accent"
                          onClick={() =>
                            pending.filter((p) => statuses[p.key] !== 'applied').forEach((p) => apply(p.key, p.a))
                          }
                        >
                          Aplicar tudo
                        </button>
                      </li>
                    )}
                  </ul>
                )}
                {message.role === 'assistant' && message.content && speechOutput.supported && (
                  <button
                    className="listen"
                    onClick={(e) => {
                      // Speak the rendered text so markdown symbols are not read aloud.
                      const rendered = e.currentTarget.parentElement?.querySelector('.content')?.textContent;
                      toggleSpeak(i, rendered || message.content);
                    }}
                  >
                    {speakingIndex === i ? <StopIcon size={12} /> : <SpeakerIcon size={12} />}
                    {speakingIndex === i ? 'Parar' : 'Ouvir'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="message assistant">
            <div className="author">{ASSISTANT_NAME}</div>
            <div className="bubble-content typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {error && <div className="error banner">{error}</div>}

      <footer>
        {(attachments.length > 0 || readingFiles) && (
          <div className="chips">
            {attachments.map((a, i) => (
              <span key={i} className="chip">
                <AttachmentChip attachment={a} />
                <button
                  className="chip-remove"
                  aria-label={`Remover ${a.name}`}
                  onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            ))}
            {readingFiles && <span className="chip">A ler…</span>}
          </div>
        )}
        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={listening ? 'A ouvir…' : 'Escreva uma mensagem (Enter para enviar)'}
            rows={2}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={attachmentReader.accept}
            onChange={(e) => void onFilesSelected(e)}
          />
          <div className="toolbar">
            <div className="tools">
              <button
                className="icon-button"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar ficheiros"
                aria-label="Anexar ficheiros"
              >
                <ClipIcon />
              </button>
              <button
                className={includeScreenshot ? 'icon-button toggle on' : 'icon-button toggle'}
                onClick={() => setIncludeScreenshot((v) => !v)}
                title={includeScreenshot ? 'Print enviado com cada mensagem' : 'Print desligado'}
                aria-label="Enviar print da página"
                aria-pressed={includeScreenshot}
              >
                <CameraIcon />
              </button>
              {speechInput.supported && (
                <button
                  className={listening ? 'icon-button mic listening' : 'icon-button mic'}
                  onPointerDown={startDictation}
                  onPointerUp={() => speechInput.stop()}
                  onPointerCancel={() => speechInput.stop()}
                  title="Manter premido para falar"
                  aria-label="Manter premido para falar"
                  aria-pressed={listening}
                >
                  <MicIcon />
                </button>
              )}
            </div>
            <button className="send" onClick={() => void send()} disabled={!canSend} aria-label="Enviar">
              <SendIcon />
              Enviar
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
