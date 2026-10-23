import { googleMark } from "@cadence/icons";
// This release keeps Google integrations visible until external setup is qualified.
export const googleIntegrationAvailable: boolean = false;

export function googleComingSoonButton(className = "welcome-google", label = "Continuar com Google") {
  return `<button class="${className}" type="button" disabled aria-disabled="true" data-google-coming-soon>${googleMark()}<span>${label}</span><span>Em breve</span></button>`;
}

export function googleCalendarComingSoon() {
  return `<div class="calendar-provider"><div class="calendar-google" aria-hidden="true">${googleMark(24)}</div><div><h3>Google Calendar</h3><p>A conexão com Google Calendar estará disponível em breve.</p></div>${googleComingSoonButton("btn", "Conectar")}</div>`;
}
