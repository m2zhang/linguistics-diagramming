import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NodeLibrary } from './NodeLibrary';
import { TemplatePicker } from './TemplatePicker';

describe('library shortcut badges', () => {
  it('shows F5 on X-Bar with its branching description', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<NodeLibrary />);
    const card = Array.from(host.querySelectorAll('.preset')).find(
      (element) => element.querySelector('.preset-name')?.textContent === 'X-Bar',
    );
    expect(card).toBeDefined();
    expect(card!.querySelector('.shortcut-hint')?.textContent).toBe('F5');
    expect(card!.querySelector('.preset-desc')?.textContent).toBe('XP → Spec + X′; X′ → X + complement');
  });

  it('shows F11 for Simple Sentence and keeps F5 exclusive to the node library', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<TemplatePicker />);
    const card = Array.from(host.querySelectorAll('.template')).find(
      (element) => element.querySelector('.t-name')?.textContent === 'Simple Sentence (S)',
    );
    expect(card).toBeDefined();
    expect(card!.querySelector('.shortcut-hint')?.textContent).toBe('F11');
    expect(Array.from(host.querySelectorAll('.shortcut-hint'), (element) => element.textContent))
      .not.toContain('F5');
  });
});
