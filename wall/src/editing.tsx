import {
  readEditableText,
  normalizeEditableText,
  replaceEditableSelection,
} from "./plainText";
import { useTypography } from "./TypographyContext";
import { typeFor, typeCSS } from "./typography";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";
import type { Site, Page } from "./model";
export type TextTarget =
  | { kind: "site"; field: "name" | "tagline" | keyof Site["copy"] }
  | { kind: "page"; pageId: string; field: "title" | "subtitle" | "meta" }
  | {
      kind: "block";
      pageId: string;
      blockId: string;
      field: "text" | "caption";
    };
export type Selection =
  | TextTarget
  | { kind: "media"; pageId: string; blockId: string }
  | { kind: "section"; pageId: string; sectionId: string };
export const targetKey = (t: Selection) => JSON.stringify(t);
export function targetValue(site: Site, t: TextTarget) {
  if (t.kind === "site")
    return t.field === "name" || t.field === "tagline"
      ? site[t.field]
      : site.copy[t.field];
  const p = site.pages.find((p) => p.id === t.pageId);
  if (!p) return "";
  return t.kind === "page"
    ? p[t.field]
    : (p.blocks.find((b) => b.id === t.blockId)?.[t.field] ?? "");
}
export function updateTarget(site: Site, t: TextTarget, value: string): Site {
  const limit =
    t.kind === "block" && t.field === "text"
      ? 30000
      : t.kind === "page" && t.field === "subtitle"
        ? 5000
        : 500;
  value = value.slice(0, limit);
  if (t.kind === "site")
    return t.field === "name" || t.field === "tagline"
      ? { ...site, [t.field]: value }
      : { ...site, copy: { ...site.copy, [t.field]: value } };
  return {
    ...site,
    pages: site.pages.map((p) =>
      p.id !== t.pageId
        ? p
        : t.kind === "page"
          ? { ...p, [t.field]: value }
          : {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === t.blockId ? { ...b, [t.field]: value } : b,
              ),
            },
    ),
  };
}
export function targetLabel(t: Selection) {
  if (t.kind === "media") return "Photograph or film";
  if (t.kind === "section") return "Composition section";
  const names = {
    name: "Artist name",
    tagline: "Practice",
    eyebrow: "Opening note",
    closingTitle: "Closing note",
    closingText: "Closing words",
    journalLink: "Journal link",
    programmeNote: "Programme note",
    title: "Page title",
    subtitle: "Introduction",
    meta: "Small print",
    text: "Writing",
    caption: "Caption",
  };
  return names[t.field];
}
export type EditingState = {
  enabled: boolean;
  arrange?: {
    controlsHost?: HTMLElement | null;
    locateRequest?: number;
    locateWork?: (id: string) => void;
    revealWorkId?: string | null;
    cancelReveal?: () => void;
    previewFlow: (sectionId: string, mobile: boolean) => void;
    guides?: boolean;
    change: (pageId: string, fn: (page: Page) => Page) => void;
    explore: (sectionId: string) => void;
    workIds: string[];
    pickWork: (id: string, extend: boolean, mobile: boolean) => void;
    clearWorks: () => void;
    reviewGrouping: (ids: string[]) => void;
  };
  site: Site;
  selection: Selection | null;
  select: (t: Selection | null) => void;
  change: (t: TextTarget, value: string) => void;
  finish: () => void;
  undo: () => void;
  redo: () => void;
};
export const EditingContext = createContext<EditingState | null>(null);
export const useEditing = () => useContext(EditingContext);
export function EditableText({
  as: Tag = "span",
  target,
  value,
  className = "",
  children,
}: {
  as?: ElementType;
  target: TextTarget;
  value: string;
  className?: string;
  children?: ReactNode;
}) {
  const editor = useEditing(),
    typography = useTypography();
  const work =
    typography && target.kind === "block" && target.field === "text"
      ? typography.site.pages
          .find((p) => p.id === target.pageId)
          ?.blocks.find((b) => b.id === target.blockId)
      : undefined;
  const presentation =
    work && typography
      ? typeCSS(typeFor(typography.site, work, typography.mobile))
      : undefined;
  const ref = useRef<HTMLElement | null>(null);
  const max =
    target.kind === "block" && target.field === "text"
      ? 30000
      : target.kind === "page" && target.field === "subtitle"
        ? 5000
        : 500;
  const enabled = !!editor?.enabled,
    selected =
      enabled &&
      !!editor.selection &&
      targetKey(editor.selection) === targetKey(target);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && readEditableText(el) !== value) el.textContent = value;
  }, [value, enabled]);
  useLayoutEffect(() => {
    if (selected && ref.current) ref.current.focus({ preventScroll: true });
  }, [selected]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!selected || !el || !editor) return;
    const beforeInput = (event: InputEvent) => {
      if (event.isComposing || !event.cancelable) return;
      const lineBreak = ["insertLineBreak", "insertParagraph"].includes(
        event.inputType,
      );
      const selectedDeletion =
        event.inputType.startsWith("delete") &&
        !el.ownerDocument.getSelection()?.isCollapsed;
      if (!lineBreak && !selectedDeletion) return;
      if (!replaceEditableSelection(el, lineBreak ? "\n" : "")) return;
      event.preventDefault();
      const value = readEditableText(el).slice(0, max);
      normalizeEditableText(el, value);
      editor.change(target, value);
    };
    el.addEventListener("beforeinput", beforeInput);
    return () => el.removeEventListener("beforeinput", beforeInput);
  }, [selected, editor, target, max]);
  if (!enabled)
    return (
      <Tag className={className} style={presentation} data-text-work={work?.id}>
        {children ?? value}
      </Tag>
    );
  const commit = (el: HTMLElement, composing = false) => {
    const value = readEditableText(el).slice(0, max);
    if (!composing) normalizeEditableText(el, value);
    editor?.change(target, value);
  };
  return (
    <Tag
      ref={ref}
      className={`${className} editable-copy`}
      data-edit-key={targetKey(target)}
      data-selected={selected || undefined}
      data-empty={!value || undefined}
      data-placeholder={`Add ${targetLabel(target).toLowerCase()}`}
      tabIndex={0}
      role={selected ? "textbox" : undefined}
      aria-label={`${selected ? "Edit" : "Select"} ${targetLabel(target).toLowerCase()}`}
      aria-multiline={selected || undefined}
      // Keep CSS display casing out of innerText while the artist is writing.
      style={
        selected ? { ...presentation, textTransform: "none" } : presentation
      }
      data-text-work={work?.id}
      contentEditable={selected ? "plaintext-only" : false}
      suppressContentEditableWarning
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selected) editor.select(target);
      }}
      onInput={(e: React.FormEvent<HTMLElement>) =>
        commit(e.currentTarget, (e.nativeEvent as InputEvent).isComposing)
      }
      onCompositionEnd={(e: React.CompositionEvent<HTMLElement>) =>
        commit(e.currentTarget)
      }
      onCompositionStart={(e: React.CompositionEvent) => e.stopPropagation()}
      onBlur={() => editor.finish()}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) editor.redo();
          else editor.undo();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          editor.finish();
          editor.select(null);
          return;
        }
        if (!selected && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          editor.select(target);
        }
      }}
    />
  );
}
