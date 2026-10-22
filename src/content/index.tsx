import { createRoot } from 'react-dom/client';
import { FileAttachmentReader } from './attachments/AttachmentReader';
import { DomFormFiller } from './page/FormFiller';
import { DomFormScanner } from './page/FormScanner';
import { DomPageContextReader } from './page/PageContextReader';
import { TabScreenshotter } from './page/Screenshotter';
import { WebSpeechInput } from './speech/SpeechInput';
import { BrowserSpeechOutput } from './speech/SpeechOutput';
import { ChatWidget } from './ui/ChatWidget';
import { isolateEvents } from './ui/isolateEvents';
import styles from './ui/styles.css?inline';

// Closed shadow root isolates the widget from page CSS and scripts.
const host = document.createElement('lfa-assistant');
const shadow = host.attachShadow({ mode: 'closed' });
isolateEvents(host);
const style = document.createElement('style');
style.textContent = styles;
const container = document.createElement('div');
shadow.append(style, container);
document.documentElement.append(host);

createRoot(container).render(
  <ChatWidget
    scanner={new DomFormScanner()}
    filler={new DomFormFiller()}
    contextReader={new DomPageContextReader()}
    attachmentReader={new FileAttachmentReader()}
    screenshotter={new TabScreenshotter(host)}
    speechInput={new WebSpeechInput()}
    speechOutput={new BrowserSpeechOutput()}
  />,
);
