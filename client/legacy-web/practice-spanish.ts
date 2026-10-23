import type { PracticeProblem } from "./workspace-types.js";
type PracticeText = Pick<
  PracticeProblem,
  "title" | "desc" | "constraints" | "approach" | "steps" | "tradeoff"
>;
const problems: Record<string, PracticeText> = {
  "two-sum": {
    title: "Two Sum",
    desc: "Dado un array de enteros nums y un entero target, devuelve los índices de los dos números cuya suma es target. Existe exactamente una solución. No se puede usar el mismo elemento dos veces.",
    constraints: "2 ≤ nums.length ≤ 10⁴ · valores enteros · una solución",
    approach:
      "Recorre el array una vez. Antes de añadir el número actual al mapa, busca el complemento target − número. Si ya existe, encontraste los dos índices.",
    steps: [
      "Calcula el complemento del número actual.",
      "Busca el complemento en el mapa de valores ya vistos.",
      "Si existe, devuelve los dos índices; si no, guarda el número actual.",
    ],
    tradeoff:
      "Buscar todos los pares cuesta O(n²) y usa O(1) de espacio adicional. Un mapa intercambia memoria por una sola pasada por el array.",
  },
  parentheses: {
    title: "Paréntesis válidos",
    desc: "Dada una cadena que solo contiene (), [] y {}, determina si los delimitadores están correctamente cerrados y anidados.",
    constraints: "0 ≤ s.length ≤ 10⁴ · solo seis caracteres permitidos",
    approach:
      "Usa una pila para guardar los delimitadores de apertura. Cada cierre debe corresponder al último elemento de la pila. Al terminar, la pila debe estar vacía.",
    steps: [
      "Apila los delimitadores de apertura.",
      "Compara cada cierre con la parte superior de la pila.",
      "Devuelve verdadero solo si no quedan aperturas.",
    ],
    tradeoff:
      "La pila representa el anidamiento en una pasada. Se rechazan inmediatamente los cierres fuera de orden o sin apertura correspondiente.",
  },
  "binary-search": {
    title: "Búsqueda binaria",
    desc: "Dado un array ordenado de forma ascendente y un objetivo, devuelve su índice. Si no existe, devuelve −1. Resuelve en tiempo logarítmico.",
    constraints: "Array ordenado · valores únicos · puede estar vacío",
    approach:
      "Mantén dos límites del intervalo. Compara el objetivo con el elemento central y descarta la mitad que no puede contenerlo. Continúa mientras el intervalo sea válido.",
    steps: [
      "Inicializa left = 0 y right = longitud − 1.",
      "Calcula el centro y compáralo con el objetivo.",
      "Ajusta los límites o devuelve el índice encontrado.",
    ],
    tradeoff:
      "La solución usa el orden para reducir el intervalo a la mitad en cada paso. No se aplica directamente a un array desordenado.",
  },
};
export function localizePractice(
  problem: PracticeProblem,
  id: string,
  locale: string,
) {
  return locale.startsWith("es") && problems[id]
    ? { ...problem, ...problems[id] }
    : problem;
}
