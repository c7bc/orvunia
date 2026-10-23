const acknowledgements = [
  "sim", "ok", "okay", "certo", "claro", "entendi", "perfeito", "beleza", "ta", "ta bom", "tudo bem", "tudo certo",
  "obrigado", "obrigada", "muito obrigado", "muito obrigada", "obrigado pela explicacao", "obrigada pela explicacao",
  "obrigado pela resposta", "obrigada pela resposta", "obrigado por compartilhar", "obrigada por compartilhar",
  "valeu", "de acordo", "aham", "uhum", "yes", "yep", "yeah", "sure", "right", "got it", "understood",
  "all right", "alright", "sounds good", "thanks", "thank you", "thank you very much", "si", "vale",
  "thanks for sharing", "thanks for the explanation", "thank you for the explanation", "gracias por la explicacion",
  "de acuerdo", "entendido", "correcto", "perfecto", "gracias", "muchas gracias", "esta bien",
];
const acknowledgement = new RegExp(`^(?:(?:${acknowledgements.join("|")})(?:[\\s,;.!?]+|$))+$`);
const calibration = [
  /\b(?:isso|isto|este) e (?:so |apenas )?(?:um )?teste de (?:audio|microfone|som)\b/,
  /^(?:teste|checagem|calibracao) de (?:audio|microfone|som)(?:\s*[,.:;!]|$)/,
  /\b(?:estou|estamos|vamos) (?:so |apenas )?(?:testando|testar|calibrando|calibrar|(?:fazer|fazendo) (?:um )?teste de) (?:o |a )?(?:audio|microfone|som)\b/,
  /\b(?:this|that|it) is (?:just |only )?(?:an? )?(?:audio|microphone|mic|sound) (?:test|check|calibration)\b/,
  /^(?:audio|microphone|mic|sound) (?:test|check|calibration)(?:\s*[,.:;!]|$)/,
  /\b(?:i am|i'm|we are|we're|let's|we will) (?:just |only )?(?:testing|test|calibrating|calibrate|checking|check) (?:the )?(?:audio|microphone|mic|sound)\b/,
  /\b(?:esto|esta|este|eso) es (?:solo |solamente )?(?:una? )?(?:prueba|test) de (?:audio|microfono|sonido)\b/,
  /^(?:prueba|test) de (?:audio|microfono|sonido)(?:\s*[,.:;!]|$)/,
  /\b(?:estoy|estamos|vamos a) (?:solo |solamente )?(?:probando|probar|calibrando|calibrar|(?:hacer|haciendo) una? prueba de) (?:el )?(?:audio|microfono|sonido)\b/,
];
const rules = [
  /\b(?:vou|vamos|irei) (?:agora )?(?:explicar|apresentar|ler) (?:as )?(?:regras|instrucoes)\b/,
  /\b(?:estas|essas|as) sao as regras (?:da|desta) (?:entrevista|avaliacao)\b/,
  /\b(?:a|esta|essa) (?:entrevista|avaliacao) (?:tem|tera|sera composta|e composta)\b/,
  /\b(?:i will|i'll|we will|we'll|let me) (?:now )?(?:explain|present|outline|go over) (?:the )?(?:rules|instructions)\b/,
  /\b(?:this|the) (?:interview|assessment) (?:has|will have|consists of)\b/,
  /\b(?:voy a|vamos a) (?:ahora )?(?:explicar|presentar|leer) (?:las )?(?:reglas|instrucciones)\b/,
  /\b(?:estas|esas) son las reglas (?:de|para) (?:la |esta )?(?:entrevista|evaluacion)\b/,
  /\b(?:la|esta) (?:entrevista|evaluacion) (?:tiene|tendra|consta de)\b/,
];
const question = /[?¿]|\b(?:como|por que|qual|quais|o que|quem|quando|onde|how|why|what|which|who|when|where|cual|cuales|quien|cuando|donde)\b/;
const request = /(?:^|[.!;,:]\s*|\b(?:mas|pero|but|and|e|y)\s+)(?:(?:por favor|please|can you|could you|would you|pode|poderia|consegue|voce pode|voce poderia|puedes|podrias)\s+)?(?:me\s+)?(?:explique|explica|explicar|explain|implemente|implementa|implementar|implement|projete|design|desenhe|disene|disenar|describe|descreva|describa|compare|solve|resolva|resuelve|depure|debug|review|revise|analise|analiza|analyze|mostre|muestra|show|tell|fale|hable|walk)\b/;
const audioCheckQuestion = /\b(?:voce me (?:ouve|escuta)|esta me ouvindo|can you hear me|can everyone hear me|me escuchas|puedes oirme)\s*\?/g;
const isolatedSoundcheck = /^[¿¡]?\s*(?:(?:hi|hello|hey|oi|ola|hola)[,!:.]?\s+)?(?:voce me (?:ouve|escuta)|esta me ouvindo|can you hear me|can everyone hear me|me escuchas|puedes oirme)\s*[?!.]*$/;
export function isAutomaticSpeechActionable(text: string): boolean {
  const normalized = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  if (!normalized || isolatedSoundcheck.test(normalized) ||
    acknowledgement.test(normalized.replace(/\b(?:e|and|y)\b/g, " ").replace(/\s+/g, " ").trim())) return false;
  const audioCalibration = calibration.some(pattern => pattern.test(normalized));
  const interviewRules = rules.some(pattern => pattern.test(normalized));
  if (!audioCalibration && !interviewRules) return true;
  const content = audioCalibration ? normalized.replace(audioCheckQuestion, "") : normalized;
  return question.test(content) || request.test(content);
}
