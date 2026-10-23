import type { WorkspaceState } from "./workspace-types.js";
export function spanishRecruiter(state: WorkspaceState, related: boolean) {
  return {
    assist: {
      title: related
        ? "Explica cómo tomaste la decisión."
        : "Conecta tu decisión con su impacto.",
      summary:
        "Usa un proyecto real y explica qué decidiste, por qué y qué ocurrió.",
      body: "«En un proyecto relevante para este puesto, empecé por entender el problema y sus restricciones. Comparé las alternativas con el equipo y elegí una solución que equilibraba el plazo y el mantenimiento. Explicaría mi contribución a la decisión y terminaría con el resultado que realmente obtuvimos».",
      notes: [
        "Sustituye el ejemplo por un proyecto de tu experiencia.",
        "Incluye un resultado que puedas demostrar.",
      ],
    },
    followup: {
      title: "Haz avanzar la conversación.",
      summary: "Dos preguntas para entender mejor la oportunidad.",
      body: "1. ¿Cuáles son los principales retos técnicos de este equipo durante los próximos seis meses?\n\n2. ¿Cómo definen el éxito para alguien en este puesto durante los primeros tres meses?",
      notes: [
        "Elige la pregunta que encaje con el momento de la conversación.",
      ],
    },
    star: {
      title: "Estructura tu historia con STAR.",
      summary: "Una guía para convertir tu experiencia en una respuesta clara.",
      body: "Situación — ¿Qué problema debía resolver el proyecto?\n\nTarea — ¿Cuál era tu responsabilidad?\n\nAcción — ¿Qué hiciste y por qué elegiste ese enfoque?\n\nResultado — ¿Qué cambió y cómo mediste el impacto?",
      notes: [
        "Usa tu contexto como referencia; esta demostración no interpreta documentos.",
        state.profile.experience.slice(0, 180) +
          (state.profile.experience.length > 180 ? "…" : ""),
      ],
    },
    recap: {
      title: "Dónde está la conversación.",
      summary: "Resumen de la transcripción de ejemplo visible.",
      body: state.transcripts.recruiter
        .slice(-3)
        .map((item) => `${item.who}: ${item.text}`)
        .join("\n\n"),
      notes: ["Próximo paso: preparar un ejemplo concreto de proyecto."],
    },
    custom: {
      title: "Tu pregunta, con contexto.",
      summary: state.customQuestion,
      body: "Esta demostración local no genera respuestas con IA. Para esta pregunta, organiza una experiencia real, relaciónala con el puesto, explica tu decisión y termina con el impacto.",
      notes: [`Perfil: ${state.profile.role}`, `Puesto: ${state.profile.job}`],
    },
  };
}
