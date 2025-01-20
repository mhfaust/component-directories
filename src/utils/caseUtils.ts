export type CaseType = 'pascal' | 'kebab' | 'camel' | 'snake';

export interface WordTokens {
  words: string[];
}

// Case detection patterns
const casePatterns: Record<CaseType, RegExp> = {
  pascal: /^[A-Z][a-zA-Z0-9]*$/,
  kebab: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  camel: /^[a-z][a-zA-Z0-9]*$/,
  snake: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
};

// Detect which case type a string is in
export function detectCase(input: string): CaseType | null {
  for (const [caseType, pattern] of Object.entries(casePatterns)) {
    if (pattern.test(input)) {
      return caseType as CaseType;
    }
  }
  return null;
}

// Split strings into word tokens based on case type
function tokenize(input: string, caseType: CaseType): WordTokens {
  switch (caseType) {
    case 'pascal':
    case 'camel':
      // Split on capital letters, preserve acronyms
      return {
        words: input
          .split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)
          .map((word) => word.toLowerCase()),
      };

    case 'kebab':
      return {
        words: input.split('-').map((word) => word.toLowerCase()),
      };

    case 'snake':
      return {
        words: input.split('_').map((word) => word.toLowerCase()),
      };
  }
}

// Transform tokens into a specific case
function transformTokens(tokens: WordTokens, targetCase: CaseType): string {
  const { words } = tokens;

  switch (targetCase) {
    case 'pascal':
      return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');

    case 'camel':
      return (
        words[0] +
        words
          .slice(1)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join('')
      );

    case 'kebab':
      return words.join('-');

    case 'snake':
      return words.join('_');
  }
}

// Transform a string from any supported case to a target case
export function transform(input: string, targetCase: CaseType): string | null {
  const sourceCase = detectCase(input);
  if (!sourceCase) {
    return null; // Input format not recognized
  }

  const tokens = tokenize(input, sourceCase);
  return transformTokens(tokens, targetCase);
}

// Check if a string is in any valid case format
export function isValidCase(input: string): boolean {
  return detectCase(input) !== null;
}

// Get all valid transformations of a string
export function getAllCaseVariants(input: string): Record<CaseType, string | null> {
  const sourceCase = detectCase(input);
  if (!sourceCase) {
    return {
      pascal: null,
      camel: null,
      kebab: null,
      snake: null,
    };
  }

  const tokens = tokenize(input, sourceCase);
  return {
    pascal: transformTokens(tokens, 'pascal'),
    camel: transformTokens(tokens, 'camel'),
    kebab: transformTokens(tokens, 'kebab'),
    snake: transformTokens(tokens, 'snake'),
  };
}
