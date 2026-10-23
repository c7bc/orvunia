import type { PracticeProblem } from "./workspace-types.js";

export const problems: Record<string, PracticeProblem> = {
  "two-sum": {
    title: "Two Sum",
    desc: "Dado um array de inteiros nums e um inteiro target, retorne os índices dos dois números cuja soma é target. Existe exatamente uma solução. O mesmo elemento não pode ser usado duas vezes.",
    input: "nums = [2, 7, 11, 15], target = 9",
    output: "[0, 1]",
    constraints: "2 ≤ nums.length ≤ 10⁴ · valores inteiros · uma solução",
    approach:
      "Percorra o array uma vez. Antes de inserir o número atual no mapa, procure o complemento target − número. Se ele já existe, você encontrou os dois índices.",
    steps: [
      "Calcule o complemento do número atual.",
      "Busque o complemento no mapa de valores já vistos.",
      "Se existir, retorne os dois índices; caso contrário, armazene o número atual.",
    ],
    time: "O(n)",
    space: "O(n)",
    tradeoff:
      "A busca por todos os pares custa O(n²) e usa O(1) de espaço extra. Um mapa troca memória por uma única passagem pelo array.",
    codes: {
      TypeScript:
        "function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) {\n      return [seen.get(complement)!, i];\n    }\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
      JavaScript:
        "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) {\n      return [seen.get(complement), i];\n    }\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
      Python:
        "def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        complement = target - value\n        if complement in seen:\n            return [seen[complement], i]\n        seen[value] = i\n    return []",
    },
    tests: [
      [[2, 7, 11, 15], 9, [0, 1]],
      [[3, 3], 6, [0, 1]],
      [[-3, 4, 3, 90], 0, [0, 2]],
    ],
  },
  parentheses: {
    title: "Parênteses válidos",
    desc: "Dada uma string contendo apenas os caracteres (), [] e {}, determine se os delimitadores estão corretamente fechados e aninhados.",
    input: 's = "([]){}"',
    output: "true",
    constraints: "0 ≤ s.length ≤ 10⁴ · apenas seis caracteres permitidos",
    approach:
      "Use uma pilha para guardar os delimitadores de abertura. Cada fechamento precisa corresponder ao último elemento da pilha. Ao final, a pilha deve estar vazia.",
    steps: [
      "Empilhe os delimitadores de abertura.",
      "Para cada fechamento, compare com o topo da pilha.",
      "Retorne verdadeiro somente se não restarem aberturas.",
    ],
    time: "O(n)",
    space: "O(n)",
    tradeoff:
      "A pilha representa o aninhamento em uma única passagem. Fechamentos fora de ordem ou sem abertura correspondente são rejeitados imediatamente.",
    codes: {
      TypeScript:
        'function isValid(s: string): boolean {\n  const pairs: Record<string, string> = {\n    ")": "(", "]": "[", "}": "{"\n  };\n  const stack: string[] = [];\n  for (const char of s) {\n    if ("([{".includes(char)) stack.push(char);\n    else if (stack.pop() !== pairs[char]) return false;\n  }\n  return stack.length === 0;\n}',
      JavaScript:
        'function isValid(s) {\n  const pairs = { ")": "(", "]": "[", "}": "{" };\n  const stack = [];\n  for (const char of s) {\n    if ("([{".includes(char)) stack.push(char);\n    else if (stack.pop() !== pairs[char]) return false;\n  }\n  return stack.length === 0;\n}',
      Python:
        'def is_valid(s):\n    pairs = { ")": "(", "]": "[", "}": "{" }\n    stack = []\n    for char in s:\n        if char in "([{":\n            stack.append(char)\n        elif not stack or stack.pop() != pairs[char]:\n            return False\n    return not stack',
    },
    tests: [
      ["([]){}", true],
      ["([)]", false],
      ["", true],
    ],
  },
  "binary-search": {
    title: "Busca binária",
    desc: "Dado um array ordenado em ordem crescente e um alvo, retorne seu índice. Se o alvo não existir, retorne −1. Resolva em tempo logarítmico.",
    input: "nums = [-1, 0, 3, 5, 9, 12], target = 9",
    output: "4",
    constraints: "Array ordenado · valores únicos · pode estar vazio",
    approach:
      "Mantenha dois limites do intervalo. Compare o alvo com o elemento central e descarte a metade que não pode conter o alvo. Continue enquanto o intervalo for válido.",
    steps: [
      "Inicialize left = 0 e right = tamanho − 1.",
      "Calcule o meio e compare com o alvo.",
      "Ajuste os limites ou retorne o índice encontrado.",
    ],
    time: "O(log n)",
    space: "O(1)",
    tradeoff:
      "A solução usa a ordenação para reduzir o intervalo pela metade em cada passo. Não se aplica diretamente a um array sem ordenação.",
    codes: {
      TypeScript:
        "function search(nums: number[], target: number): number {\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      JavaScript:
        "function search(nums, target) {\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
      Python:
        "def search(nums, target):\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = left + (right - left) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
    },
    tests: [
      [[-1, 0, 3, 5, 9, 12], 9, 4],
      [[1, 3], 2, -1],
      [[], 0, -1],
    ],
  },
};
