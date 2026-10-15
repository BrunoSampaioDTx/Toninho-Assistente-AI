import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_SETTINGS, type ApiFormat, type Settings, type SettingsStore } from '../shared/settings';

export function Options({ store }: { store: SettingsStore }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');

  useEffect(() => {
    store.get().then(setSettings);
  }, [store]);

  async function save(e: FormEvent) {
    e.preventDefault();
    let origin: string;
    try {
      origin = new URL(settings.backendUrl).origin;
    } catch {
      setStatus('Invalid URL.');
      return;
    }

    // Must run first, inside the user gesture. The worker needs host access to call the backend.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      setStatus(`Permission to access ${origin} was denied.`);
      return;
    }
    await store.save(settings);
    setStatus('Saved.');
  }

  return (
    <form onSubmit={save} style={{ maxWidth: 480, margin: 24, display: 'grid', gap: 12, fontFamily: 'system-ui' }}>
      <h2>LLM Form Assistant</h2>
      <label>
        API format
        <select
          style={{ width: '100%' }}
          value={settings.apiFormat}
          onChange={(e) => setSettings({ ...settings, apiFormat: e.target.value as ApiFormat })}
        >
          <option value="openai">OpenAI-compatible (/v1/chat/completions)</option>
          <option value="custom">Custom backend contract</option>
        </select>
      </label>
      <label>
        Endpoint URL
        <input
          type="url"
          required
          style={{ width: '100%' }}
          placeholder="https://llm.example.com/v1/chat/completions"
          value={settings.backendUrl}
          onChange={(e) => setSettings({ ...settings, backendUrl: e.target.value })}
        />
      </label>
      <label>
        API token (optional, sent as Bearer)
        <input
          type="password"
          style={{ width: '100%' }}
          value={settings.apiToken}
          onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
        />
      </label>
      {settings.apiFormat === 'openai' && (
        <label>
          Model (optional)
          <input
            style={{ width: '100%' }}
            placeholder="Qwen/Qwen3.8-27B"
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          />
        </label>
      )}
      <button type="submit">Save</button>
      {status && <p>{status}</p>}
    </form>
  );
}
