type PlatformMessages = Readonly<{ manage: string; updates: string; startup: string; unavailable: string }>;
const english: PlatformMessages = Object.freeze({
  manage: "Manage in Windows", updates: "Open Microsoft Store",
  startup: "Windows manages startup for this package. Enable it in Startup apps after opening the app. Windows or your administrator may restrict this setting.",
  unavailable: "Windows settings could not be opened. Open Startup apps or Microsoft Store directly in Windows."
});
const portuguese: PlatformMessages = Object.freeze({
  manage: "Gerenciar no Windows", updates: "Abrir Microsoft Store",
  startup: "O Windows gerencia a inicialização deste pacote. Ative em Aplicativos de inicialização após abrir o app. O Windows ou seu administrador podem restringir essa opção.",
  unavailable: "Não foi possível abrir o gerenciamento do Windows. Abra Aplicativos de inicialização ou a Microsoft Store diretamente no Windows."
});
const spanish: PlatformMessages = Object.freeze({
  manage: "Administrar en Windows", updates: "Abrir Microsoft Store",
  startup: "Windows administra el inicio de este paquete. Actívalo en Aplicaciones de inicio después de abrir la app. Windows o tu administrador pueden restringir esta opción.",
  unavailable: "No se pudo abrir la administración de Windows. Abre Aplicaciones de inicio o Microsoft Store directamente en Windows."
});
export function platformMessages(locale = "pt-BR") {
  return locale.startsWith("en") ? english : locale.startsWith("es") ? spanish : portuguese;
}
