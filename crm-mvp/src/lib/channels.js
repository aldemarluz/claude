/**
 * Single source of truth for channel metadata across the inbox.
 *
 * Adding a new channel = add an entry here + implement the provider
 * adapter on the backend (sendChannelMessage dispatcher) + the inbound
 * webhook for that provider. The inbox UI reads everything from this
 * file and stays channel-agnostic.
 */

export const CHANNELS = {
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    accent: '#25d366',
    enabled: true,
  },
  email: {
    key: 'email',
    label: 'Email',
    icon: '📧',
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
    accent: '#3b82f6',
    enabled: true,
  },
  sms: {
    key: 'sms',
    label: 'SMS',
    icon: '📱',
    color: 'text-violet-600',
    bg: 'bg-violet-500/10',
    accent: '#8b5cf6',
    enabled: false,
  },
  instagram: {
    key: 'instagram',
    label: 'Instagram',
    icon: '📷',
    color: 'text-pink-600',
    bg: 'bg-pink-500/10',
    accent: '#e1306c',
    enabled: false,
  },
  messenger: {
    key: 'messenger',
    label: 'Messenger',
    icon: '💬',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    accent: '#0084ff',
    enabled: false,
  },
  tiktok: {
    key: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: 'text-black',
    bg: 'bg-slate-500/10',
    accent: '#000000',
    enabled: false,
  },
  webchat: {
    key: 'webchat',
    label: 'Webchat',
    icon: '🌐',
    color: 'text-teal-600',
    bg: 'bg-teal-500/10',
    accent: '#14b8a6',
    enabled: false,
  },
};

export const CHANNEL_LIST = Object.values(CHANNELS);
export const ENABLED_CHANNELS = CHANNEL_LIST.filter((c) => c.enabled);

export function getChannel(type) {
  return CHANNELS[type] || CHANNELS.whatsapp;
}

// Status (last_status / message.status) — same for all channels.
export const STATUS_LABELS = {
  pending:   { label: 'Enviando…',   color: 'text-slate-400' },
  sent:      { label: 'Enviado',     color: 'text-slate-400' },
  enviado:   { label: 'Enviado',     color: 'text-slate-400' },
  delivered: { label: 'Entregue',    color: 'text-slate-500' },
  entregue:  { label: 'Entregue',    color: 'text-slate-500' },
  read:      { label: 'Lido',        color: 'text-blue-500' },
  lido:      { label: 'Lido',        color: 'text-blue-500' },
  failed:    { label: 'Falha',       color: 'text-red-500' },
  falhou:    { label: 'Falha',       color: 'text-red-500' },
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || { label: status || '—', color: 'text-slate-400' };
}
