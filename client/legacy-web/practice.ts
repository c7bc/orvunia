import type { PracticeProblem, PracticeResult } from "./workspace-types.js";
function sumPair(numbers: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (const [index, value] of numbers.entries()) {
    const previous = seen.get(target - value);
    if (previous !== undefined) return [previous, index];
    seen.set(value, index);
  }
  return [];
}
function validParentheses(value: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const character of value) {
    if ("([{".includes(character)) stack.push(character);
    else if (stack.pop() !== pairs[character]) return false;
  }
  return stack.length === 0;
}
function binarySearch(numbers: number[], target: number): number {
  let left = 0,
    right = numbers.length - 1;
  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2),
      value = numbers[middle]!;
    if (value === target) return middle;
    if (value < target) left = middle + 1;
    else right = middle - 1;
  }
  return -1;
}
export function runPracticeTests(
  problem: PracticeProblem,
  id: string,
): PracticeResult[] {
  return problem.tests.map((input) => {
    const actual =
      typeof input[0] === "string"
        ? validParentheses(input[0])
        : id === "two-sum"
          ? sumPair(input[0], input[1] as number)
          : binarySearch(input[0], input[1] as number);
    const expected = input.at(-1);
    return {
      actual,
      expected,
      passed: JSON.stringify(actual) === JSON.stringify(expected),
      input: JSON.stringify(input.slice(0, -1)),
    };
  });
}
