import { describe, expect, it } from 'vitest';
import { buildExportSvg } from './prepareSvg';
import { makeNode } from '../model/types';

/** An exported tree must carry the tag colours, not the old muted grey —
 *  a PNG/PDF handed to a class is the artefact the colour coding is for. */
describe('exported feature tags', () => {
  it('writes each tag its defined colour', () => {
    const child = makeNode('N');
    child.features = ['+CASE', '+past', '+wh'];
    const tree = makeNode('NP', [child]);

    const { svg } = buildExportSvg(tree);
    const fills = [...svg.querySelectorAll('text')]
      .filter((t) => t.textContent?.startsWith('['))
      .map((t) => [t.textContent, t.getAttribute('fill')]);

    expect(fills).toEqual([
      ['[+CASE]', '#dc2626'],
      ['[+past]', '#2563eb'],
      ['[+wh]', '#059669'],
    ]);
  });

  it('gives a custom feature a colour rather than dropping it', () => {
    const node = makeNode('T');
    node.features = ['uCase:nom'];

    const { svg } = buildExportSvg(node);
    const tag = [...svg.querySelectorAll('text')].find((t) => t.textContent === '[uCase:nom]');

    expect(tag).toBeDefined();
    expect(tag?.getAttribute('fill')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
