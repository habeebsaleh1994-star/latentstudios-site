import { useEffect, useRef } from "react";
import type { Site } from "./model";
import type { WritingTarget } from "./typography";
import { TextStylePanel } from "./TextStylePanel";
import { trapDialogTab } from "./dialogFocus";
export function TextStyleDialog({
  site,
  target,
  mobile,
  previewDevice,
  update,
  close,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  site: Site;
  target: WritingTarget;
  mobile: boolean;
  previewDevice: (mobile: boolean) => void;
  update: (fn: (s: Site) => Site, group?: string) => void;
  close: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="type-dialog"
      aria-label="Style this writing"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        trapDialogTab(e);
      }}
    >
      <header>
        <h2>Give words their voice.</h2>
        <button aria-label="Close writing style" onClick={close}>
          ×
        </button>
      </header>
      <div className="type-dialog-history">
        <button disabled={!canUndo} onClick={undo}>
          Undo style edit
        </button>
        <button disabled={!canRedo} onClick={redo}>
          Redo style edit
        </button>
      </div>
      <TextStylePanel
        site={site}
        target={target}
        initialMobile={mobile}
        previewDevice={previewDevice}
        update={update}
      />
    </dialog>
  );
}
