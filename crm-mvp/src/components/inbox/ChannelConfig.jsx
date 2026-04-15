export const CHANNELS = {
  whatsapp: {
    name: "WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    primary: "#25D366",
    primaryDark: "#128C7E",
    bg: "#ECE5DD",
    chatBg: "#E4DDD6",
    headerBg: "#075E54",
    headerText: "#ffffff",
    sentBubble: "#DCF8C6",
    sentText: "#303030",
    receivedBubble: "#ffffff",
    receivedText: "#303030",
    inputBg: "#ffffff",
    listBg: "#ffffff",
    listHover: "#f0f2f5",
    searchBg: "#f0f2f5",
    timeColor: "#667781",
    pattern: "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 2c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zm-8 8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm16 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zM8 20c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zm24 0c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zm-12 8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z' fill='%23d4cfc6' fill-opacity='.15'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23p)' width='200' height='200'/%3E%3C/svg%3E\")",
  },
  email: {
    name: "Email",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
      </svg>
    ),
    primary: "#4A5568",
    primaryDark: "#2D3748",
    bg: "#f7f8fa",
    chatBg: "#ffffff",
    headerBg: "#1a202c",
    headerText: "#ffffff",
    sentBubble: "#EDF2F7",
    sentText: "#1a202c",
    receivedBubble: "#ffffff",
    receivedText: "#1a202c",
    inputBg: "#ffffff",
    listBg: "#ffffff",
    listHover: "#f7f8fa",
    searchBg: "#edf2f7",
    timeColor: "#a0aec0",
    pattern: "none",
    isEmail: true,
  },
};