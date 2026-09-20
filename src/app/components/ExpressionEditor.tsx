/**
 * ExpressionEditor - CodeMirror 6 based multi-line expression input
 * with syntax highlighting for the Syto expression language.
 */

import { useRef, useEffect, useMemo } from 'preact/hooks';
import { EditorView, ViewUpdate, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { minimalSetup } from 'codemirror';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import {
  createExpressionLanguage,
  createExpressionCompletion,
  type ExpressionContext,
} from '../services/expression-language';
import type { ColumnSchema } from '../../core/schema-engine';

export interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  columns: string[];
  /** Column schema for context-aware autocomplete (boosts relevant functions) */
  schema?: ColumnSchema[];
  /** Expression context for autocomplete boosting */
  context?: ExpressionContext;
  className?: string;
}

/** Syntax highlight colors using project CSS variables */
const highlightStyle = HighlightStyle.define([
  { tag: tags.string, color: '#a31515' },
  { tag: tags.number, color: '#098658' },
  { tag: tags.keyword, color: '#0000ff' },
  { tag: tags.operatorKeyword, fontWeight: 'bold', color: '#af00db' },
  { tag: tags.function(tags.definition(tags.variableName)), fontWeight: 'bold', color: '#795e26' },
  { tag: tags.variableName, color: '#001080' },
  { tag: tags.special(tags.variableName), color: '#001080' },
  { tag: tags.operator, color: '#d4351c' },
  { tag: tags.punctuation, color: '#666666' },
]);

/** Theme: compact multi-line editor with border, focus ring, and autocomplete styling */
const editorTheme = EditorView.theme({
  // Wrapper — matches .input class from form-controls.module.css
  '&': {
    width: '100%',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--color-white)',
    border: 'var(--border-width) solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
    fontSize: 'var(--font-size-base)',
    fontFamily: 'var(--font-family-mono)',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--color-cyan)',
    boxShadow: '0 0 0 3px rgba(var(--color-cyan-rgb), 0.1)',
  },
  // Content — multi-line with vertical scroll (3 lines default, scrolls beyond ~5)
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.4', minHeight: '3.6em', maxHeight: '120px' },
  '.cm-content': { padding: '0' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--color-midnight-blue)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'rgba(var(--color-cyan-rgb), 0.2) !important',
  },
  '.cm-placeholder': {
    color: 'var(--color-medium-gray)',
    fontFamily: 'var(--font-family)',
    fontStyle: 'italic',
  },
  // Autocomplete dropdown
  '.cm-tooltip.cm-tooltip-autocomplete': {
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-sm)',
    border: 'var(--border-width) solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--shadow-md)',
    background: 'var(--color-white)',
  },
  '.cm-tooltip-autocomplete ul li': { padding: '4px 8px', lineHeight: '1.4' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'rgba(var(--color-cyan-rgb), 0.12)',
    color: 'var(--color-midnight-blue)',
  },
  // Row backgrounds by completion type (using :has to target parent li from icon class)
  '.cm-tooltip-autocomplete ul li:has(.cm-completionIcon-variable)': {
    background: 'rgba(0, 16, 128, 0.06)',
  },
  '.cm-tooltip-autocomplete ul li:has(.cm-completionIcon-function)': {
    background: 'rgba(121, 94, 38, 0.06)',
  },
  '.cm-tooltip-autocomplete ul li:has(.cm-completionIcon-variable)[aria-selected]': {
    background: 'rgba(0, 16, 128, 0.14)',
  },
  '.cm-tooltip-autocomplete ul li:has(.cm-completionIcon-function)[aria-selected]': {
    background: 'rgba(121, 94, 38, 0.14)',
  },
  '.cm-completionLabel': {
    fontFamily: 'var(--font-family-mono)',
    fontSize: 'var(--font-size-sm)',
  },
  // Completion icons: small colored indicators
  '.cm-completionIcon': {
    width: '1em',
    fontSize: '90%',
    opacity: 1,
  },
  '.cm-completionIcon-variable': { color: '#001080' },
  '.cm-completionIcon-variable::after': { content: "'\\25CF'" },
  '.cm-completionIcon-function': { color: '#795e26' },
  '.cm-completionIcon-function::after': { content: "'\\0192'" },
  '.cm-completionIcon-keyword': { color: '#0000ff' },
  '.cm-completionIcon-keyword::after': { content: "'\\25CB'" },
  '.cm-completionDetail': {
    fontStyle: 'normal',
    color: 'var(--color-dark-gray)',
    marginLeft: '8px',
    fontSize: 'var(--font-size-xs)',
  },
  '.cm-completionInfo': {
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-xs)',
    padding: '8px',
    color: 'var(--color-dark-gray)',
  },
});

export function ExpressionEditor({
  value,
  onChange,
  placeholder,
  columns,
  schema,
  context,
  className,
}: ExpressionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isSyncing = useRef(false);
  const langCompartment = useRef(new Compartment());
  const completionCompartment = useRef(new Compartment());

  // Build column set from prop
  const columnSet = useMemo(() => new Set(columns), [columns]);

  // Initialize editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions: Extension[] = [
      minimalSetup,
      editorTheme,
      syntaxHighlighting(highlightStyle),
      langCompartment.current.of(createExpressionLanguage(columnSet)),
      closeBrackets(),
      completionCompartment.current.of(
        autocompletion({
          override: [createExpressionCompletion(columns, schema, context)],
          activateOnTyping: true,
          icons: true,
        })
      ),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged && !isSyncing.current) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    if (placeholder) {
      extensions.push(cmPlaceholder(placeholder));
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (skip onChange to prevent loops)
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      isSyncing.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
      isSyncing.current = false;
    }
  }, [value]);

  // Reconfigure language and completions when columns change
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: [
          langCompartment.current.reconfigure(createExpressionLanguage(columnSet)),
          completionCompartment.current.reconfigure(
            autocompletion({
              override: [createExpressionCompletion(columns, schema, context)],
              activateOnTyping: true,
              icons: true,
            })
          ),
        ],
      });
    }
  }, [columnSet, schema, context]); // reconfigure when columns, schema, or context change

  return <div ref={containerRef} class={className} />;
}
