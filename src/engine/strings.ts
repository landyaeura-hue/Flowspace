// English UI copy used by the canvas engine. Add other languages by swapping this module.

/** Toast messages with no variable parts. */
export const MSG = {
  theCanvasIsEmpty: 'The canvas is empty',
  pngExportFailedTrySvg: 'PNG export failed — try SVG instead',
  thatFileIsnTA: 'That file isn’t a FlowSpace canvas',
  styleCopied: 'Style copied',
  copied: 'Copied',
  formatPainterCancelled: 'Format painter cancelled',
  needAtLeastTwoMovable: 'Need at least two movable nodes',
  turnOnElasticModeTo: 'Turn on elastic mode to keep nodes away from this text',
  elasticModeOnOverlappingNodes: 'Elastic mode on: overlapping nodes move apart',
  freeModeNodesCanOverlap: 'Free mode: nodes can overlap',
  theseTwoNodesAreAlready: 'These two nodes are already connected in that direction',
  connectorReconnected: 'Connector reconnected',
  lassoDrawAroundWhatYou: 'Lasso: draw around what you want to select',
  nothingInsideTheLasso: 'Nothing inside the lasso',
  styleApplied: 'Style applied',
  thoseStylesDonTMatch: 'Those styles don’t match this object',
  pastedAsATextBox: 'Pasted as a text box',
  selectAtLeast2Objects: 'Select at least 2 objects to group',
  nothingInTheSelectionIs: 'Nothing in the selection is grouped',
  ungrouped: 'Ungrouped',
  copyAStyleFirst: 'Copy a style first',
  stylePasted: 'Style pasted',
  formatPainterClickAnObject: 'Format painter: click an object to apply · Esc to cancel',
  keepAtLeastOneCanvas: 'Keep at least one canvas',
} as const;

/** Rows of the keyboard-shortcut sheet: [action, keys]. MK is ⌘ on Apple devices, Ctrl elsewhere. */
export function shortcutList(MK: string, isMac: boolean): [string, string][] {
  return [['Select tool', 'V'], ['Hand tool', 'H'], ['Five shapes', '1 – 5'], ['Connector', 'L'], ['Text box', 'T'], ['Select all', MK + ' A'], ['Copy', MK + ' C'], ['Cut', MK + ' X'], ['Paste', MK + ' V'], ['Duplicate', MK + ' D'], ['Delete', isMac ? 'Delete ⌫' : 'Delete'], ['Undo', MK + ' Z'], ['Redo', MK + ' Shift Z'], ['Edit selected text', 'Enter'], ['Extend with a new node', 'Tab'], ['New sibling node', MK + ' Enter'], ['Font size up / down', MK + ' Shift > / <'], ['Drag without snapping', 'hold Alt'], ['Exit editing / deselect', 'Esc'], ['Nudge 1px / 10px', 'Arrows · Shift'], ['Zoom in / out', MK + ' + / −'], ['Fit to screen', MK + ' 0'], ['Pan canvas', 'Space + drag'], ['Elastic mode on/off', 'P'], ['Pen', 'B'], ['Lasso select', 'Q · or Alt + drag'], ['iPad long-press', 'object: menu · empty: lasso'], ['Right-click menu', 'copy, group, painter…'], ['Group / ungroup', MK + ' G · ' + MK + ' Shift G'], ['Copy / paste style', MK + ' Alt C · V'], ['Align left / right / top / bottom', 'Alt A · D · W · S'], ['Center horizontally / vertically', 'Alt H · V'], ['Distribute horizontally / vertically', 'Alt Shift H · V'], ['Trackpad pan / zoom', 'two-finger swipe · pinch'], ['iPad handwriting', 'write with Apple Pencil'], ['Label a connector', 'double-click it'], ['New canvas', 'Alt N'], ['Shortcuts', '?']];
}
