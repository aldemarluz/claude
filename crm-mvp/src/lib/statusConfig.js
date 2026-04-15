export const STATUS_CONFIG = {
  novo: { label: "Novo Lead", color: "blue", order: 0 },
  contato_iniciado: { label: "Contato Iniciado", color: "amber", order: 1 },
  qualificado: { label: "Qualificado", color: "violet", order: 2 },
  proposta_enviada: { label: "Proposta Enviada", color: "cyan", order: 3 },
  fechado: { label: "Fechado", color: "emerald", order: 4 },
};

export const STATUS_LIST = Object.entries(STATUS_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key, val]) => ({ key, ...val }));

export function getStatusBadgeClasses(status) {
  const config = STATUS_CONFIG[status];
  if (!config) return "bg-muted text-muted-foreground";
  const c = config.color;
  return `bg-${c}-500/10 text-${c}-600 border-${c}-500/20`;
}