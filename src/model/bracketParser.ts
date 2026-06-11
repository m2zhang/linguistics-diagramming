import { makeNode, TreeNode } from './types';

export interface ParseError {
  message: string;
  position: number;
}

export interface ParseResult {
  tree: TreeNode | null;
  errors: ParseError[];
}

type Token =
  | { kind: 'open'; pos: number }
  | { kind: 'close'; pos: number }
  | { kind: 'word'; value: string; pos: number };

/**
 * Tokenize bracket notation into open/close brackets and whitespace-delimited
 * words. Supports `\[` / `\]` escapes so a literal bracket can appear in a label.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '[') {
      tokens.push({ kind: 'open', pos: i });
      i += 1;
    } else if (ch === ']') {
      tokens.push({ kind: 'close', pos: i });
      i += 1;
    } else if (/\s/.test(ch)) {
      i += 1;
    } else {
      // Read a word up to the next bracket or whitespace, honouring escapes.
      const start = i;
      let value = '';
      while (i < input.length && !/\s/.test(input[i])) {
        const c = input[i];
        if (c === '\\' && (input[i + 1] === '[' || input[i + 1] === ']')) {
          value += input[i + 1];
          i += 2;
          continue;
        }
        if (c === '[' || c === ']') break;
        value += c;
        i += 1;
      }
      if (value.length > 0) tokens.push({ kind: 'word', value, pos: start });
    }
  }
  return tokens;
}

/**
 * Parse bracket notation, e.g. `[S [NP [D the] [N cat]] [VP [V sat]]]`, into a
 * TreeNode. Grammar inside a bracket: the first word is the node label; the
 * remaining items (nested brackets or bare words) are its children. A bare word
 * becomes a leaf/terminal node.
 *
 * Never throws — structural problems are returned as `errors` and a best-effort
 * partial tree is still produced where possible.
 */
export function parseBracket(input: string): ParseResult {
  const tokens = tokenize(input);
  const errors: ParseError[] = [];
  let idx = 0;

  function parseBracketed(): TreeNode | null {
    // Consumes a `[ ... ]` group; assumes tokens[idx] is 'open'.
    const open = tokens[idx];
    idx += 1; // consume '['

    if (idx >= tokens.length || tokens[idx].kind !== 'word') {
      errors.push({ message: 'Bracket has no label', position: open.pos });
      // Skip to matching close to recover.
      skipToClose();
      return makeNode('?');
    }

    const labelTok = tokens[idx] as Extract<Token, { kind: 'word' }>;
    idx += 1;
    const node = makeNode(labelTok.value);

    while (idx < tokens.length && tokens[idx].kind !== 'close') {
      const tok = tokens[idx];
      if (tok.kind === 'open') {
        const child = parseBracketed();
        if (child) node.children.push(child);
      } else if (tok.kind === 'word') {
        node.children.push(makeNode(tok.value));
        idx += 1;
      } else {
        idx += 1;
      }
    }

    if (idx < tokens.length && tokens[idx].kind === 'close') {
      idx += 1; // consume ']'
    } else {
      errors.push({ message: 'Unclosed bracket', position: open.pos });
    }
    return node;
  }

  function skipToClose() {
    let depth = 1;
    while (idx < tokens.length && depth > 0) {
      if (tokens[idx].kind === 'open') depth += 1;
      else if (tokens[idx].kind === 'close') depth -= 1;
      idx += 1;
    }
  }

  // Skip leading content until first open bracket.
  while (idx < tokens.length && tokens[idx].kind !== 'open') {
    const tok = tokens[idx];
    if (tok.kind === 'close') {
      errors.push({ message: 'Unexpected closing bracket', position: tok.pos });
    }
    idx += 1;
  }

  if (idx >= tokens.length) {
    if (tokens.length === 0) {
      return { tree: null, errors };
    }
    errors.push({ message: 'No tree found', position: 0 });
    return { tree: null, errors };
  }

  const tree = parseBracketed();

  // Warn about trailing stray tokens.
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.kind === 'open') {
      errors.push({ message: 'Multiple top-level trees; only the first is used', position: tok.pos });
      break;
    }
    if (tok.kind === 'close') {
      errors.push({ message: 'Unexpected closing bracket', position: tok.pos });
    }
    idx += 1;
  }

  return { tree, errors };
}
