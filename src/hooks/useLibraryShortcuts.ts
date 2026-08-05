import { useEffect } from 'react'; //to interact with the keyboard of the user
import { PRESETS } from '../components/NodeLibrary'; //export the node down, binary branch, ternary branch
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { cloneWithNewIds } from '../model/types';
import { TEMPLATES, templateToTree } from '../model/templates';

/* F1, F2 and F3 is the keyboard keys and if they are pressed, it selects the PRESETS[#corresponding to it]*/
/* Ex: Press "F2", then it stores it as NODE_SHORTCUTS["F2"] and sets as PRESETS[1]*/
const NODE_SHORTCUTS: Record<string, number> = {
  F1: 0, //Keyboard shortcut for Node down
  F2: 1, //binary branch
  F3: 2, //ternary branch
};

const TEMPLATE_SHORTCUTS: Record<string, number> = {
  F4: 0, // Simple Sentence
  F5: 1, // Noun Phrase
  F6: 2, // NP with Adjective
  F7: 3, // Transitive VP
  F8: 4, // Prepositional Phrase
  F9: 5, // Embedded Clause
};

export function useLibraryShortcuts() {
  const selectedId = useTreeStore((state) => state.selectedId); //Identifies which node the tree should be updated in
  const tree = useTreeStore((state) => state.tree);
  const replaceTree = useTreeStore((state) => state.replaceTree);
  const attachPreset = useTreeStore((state) => state.attachPreset); //for attaching
  const toast = useUiStore((state) => state.toast); //notification to the user

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (
        typing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const templateIndex = TEMPLATE_SHORTCUTS[event.key];

      if (templateIndex !== undefined) {
        event.preventDefault();

        const template = TEMPLATES[templateIndex];
        replaceTree(templateToTree(template));
        toast(`Loaded "${template.name}"`, 'success');
        return;
      }

      const presetIndex = NODE_SHORTCUTS[event.key];

      if (presetIndex === undefined) {
        return;
      }

      event.preventDefault();

      const preset = PRESETS[presetIndex];
      const builtPreset = preset.build();

      if (selectedId) {
        attachPreset(selectedId, builtPreset);
      } else if (tree) {
        attachPreset(tree.id, builtPreset);
      } else {
        replaceTree(cloneWithNewIds(builtPreset));
      }

      toast(`Added ${preset.name}`, 'success');
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, tree, attachPreset, replaceTree, toast]);
}
