import { parseBracket } from './bracketParser';
import { TreeNode } from './types';

export interface Template {
  id: string;
  name: string;
  description: string;
  bracket: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'simple-sentence',
    name: 'Simple Sentence (S)',
    description: 'The classic [S [NP] [VP]] starter.',
    bracket: '[S [NP [D the] [N cat]] [VP [V sat]]]',
  },
  {
    id: 'np',
    name: 'Noun Phrase (NP)',
    description: 'Determiner + Noun.',
    bracket: '[NP [D the] [N student]]',
  },
  {
    id: 'np-adj',
    name: 'NP with Adjective',
    description: 'Determiner + AdjP + Noun.',
    bracket: '[NP [D the] [AdjP [Adj clever]] [N student]]',
  },
  {
    id: 'vp-transitive',
    name: 'Transitive VP',
    description: 'Verb + Object NP.',
    bracket: '[VP [V read] [NP [D the] [N book]]]',
  },
  {
    id: 'pp',
    name: 'Prepositional Phrase (PP)',
    description: 'Preposition + NP complement.',
    bracket: '[PP [P on] [NP [D the] [N table]]]',
  },
  {
    id: 'cp',
    name: 'Embedded Clause (CP)',
    description: 'Complementizer + embedded TP.',
    bracket: '[CP [C that] [TP [NP [N Sophie]] [VP [V left]]]]',
  },
];

/** Parse a template into a fresh tree (with new ids via the parser). */
export function templateToTree(template: Template): TreeNode {
  const { tree } = parseBracket(template.bracket);
  // Templates are authored valid, so tree is always present.
  return tree!;
}

export const DEFAULT_TREE_BRACKET = TEMPLATES[0].bracket;
