import {
  applyRelationshipCandidate,
  type RelationshipRequest,
} from "./relationships";
import type { Page } from "./model";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteSchema, type Site } from "./model";
import { localDrafts } from "./storage";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
  type EditHistory,
} from "./history";
import { SaveQueue } from "./SaveQueue";
import { localRevisions } from "./revisions";
import { activeWorkspaceId, channelName } from "./workspace";
import { applyStudySafely, applyFlowSafely } from "./compositionStudies";
export function useStudio(readOnly = false, comparison = false) {
  const locked = useRef(readOnly || comparison);
  locked.current = readOnly || comparison;
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening your work…");
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const history = useRef<EditHistory | null>(null);
  const queue = useRef<SaveQueue | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const importing = useRef(false);
  const mounted = useRef(false);
  const publish = useCallback((next: EditHistory) => {
    history.current = next;
    setSite(next.present);
    setHistoryState({
      canUndo: next.past.length > 0,
      canRedo: next.future.length > 0,
    });
  }, []);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const receive = (data: { value: Site; revision: number }) => {
      publish(createHistory(data.value));
      queue.current = new SaveQueue(
        data.revision,
        localDrafts.save,
        (q) => {
          if (!active) return;
          setError(q.error?.message ?? "");
          setStatus(
            q.error
              ? "Changes need attention"
              : q.dirty
                ? "Saving…"
                : "Saved on this device",
          );
        },
        (revision) => channel.current?.postMessage({ revision }),
      );
      setStatus("Saved on this device");
    };
    localDrafts
      .load()
      .then((data) => {
        if (active) receive(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Your saved draft could not be opened. Nothing has been replaced. Keep your backups and reload to try again.",
          );
      });
    const broadcast = new BroadcastChannel(channelName(activeWorkspaceId));
    channel.current = broadcast;
    broadcast.onmessage = () => {
      if (readOnly) {
        localDrafts
          .load()
          .then((data) => {
            if (active) {
              setSite(data.value);
            }
          })
          .catch(() => setError("Could not refresh the preview."));
        return;
      }
      if (queue.current)
        queue.current.interrupt(
          "Another window saved this draft. Export this version, then reload to continue.",
        );
    };
    const protect = (event: BeforeUnloadEvent) => {
      if (queue.current?.dirty || importing.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      active = false;
      mounted.current = false;
      broadcast.close();
      channel.current = null;
      window.removeEventListener("beforeunload", protect);
    };
  }, [readOnly, publish]);
  const commit = useCallback(
    (fn: (site: Site) => Site, group?: string) => {
      if (!history.current || importing.current) return;
      try {
        const nextSite = siteSchema.parse(fn(history.current.present));
        const next = editHistory(history.current, nextSite, group);
        if (next === history.current) return true;
        publish(next);
        queue.current?.enqueue(next.present);
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "This edit could not be applied.",
        );
      }
    },
    [publish],
  );
  const update = useCallback(
    (fn: (site: Site) => Site, group?: string) => {
      if (!locked.current) commit(fn, group);
    },
    [commit],
  );
  // The sole explicit mutation allowed by the comparison UI. It uses current
  // content and retains the displaced arrangement as a study in one transaction.
  const applyArrangementStudy = useCallback(
    (pageId: string, studyId: string) => {
      if (readOnly) return;
      commit((s) => ({
        ...s,
        pages: s.pages.map((p) => {
          if (p.id !== pageId) return p;
          const study = p.studies?.find((s) => s.id === studyId);
          if (!study) return p;
          return applyStudySafely(p, study);
        }),
      }));
    },
    [commit, readOnly],
  );
  const applyRelationship = useCallback(
    (
      pageId: string,
      source: Page,
      q: RelationshipRequest,
      ratio: number,
      id: string,
    ) => {
      if (readOnly) return;
      return commit((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === pageId
            ? applyRelationshipCandidate(s, p, source, q, ratio, id)
            : p,
        ),
      }));
    },
    [commit, readOnly],
  );
  const undo = useCallback(() => {
    if (locked.current || !history.current || importing.current) return;
    const next = undoHistory(history.current);
    if (next === history.current) return;
    publish(next);
    queue.current?.enqueue(next.present);
  }, [publish]);
  const applyFlow = useCallback(
    (pageId: string, sectionId: string, mobile: boolean) => {
      if (readOnly) return;
      commit((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === pageId ? applyFlowSafely(p, sectionId, mobile) : p,
        ),
      }));
    },
    [commit, readOnly],
  );
  const redo = useCallback(() => {
    if (locked.current || !history.current || importing.current) return;
    const next = redoHistory(history.current);
    if (next === history.current) return;
    publish(next);
    queue.current?.enqueue(next.present);
  }, [publish]);
  const endGroup = useCallback(() => {
    if (history.current) history.current = { ...history.current, group: null };
  }, []);
  async function withSaved<T>(
    action: (value: Site, revision: number) => Promise<T>,
  ): Promise<T> {
    if (locked.current)
      throw new Error("Return to the draft before changing it.");
    if (importing.current || !queue.current || !history.current)
      throw new Error("Wait for the current operation to finish.");
    importing.current = true;
    try {
      await queue.current.idle();
      if (locked.current)
        throw new Error("Return to the draft before changing it.");
      if (queue.current.error || queue.current.pending)
        throw new Error(
          "Export this version and reload before continuing. Unsaved changes are still in this window.",
        );
      return await action(history.current.present, queue.current.revision);
    } finally {
      importing.current = false;
    }
  }
  async function restore(text: string, revisionId?: string) {
    if (locked.current)
      throw new Error("Return to the draft before restoring a backup.");
    if (importing.current)
      throw new Error("A backup is already being restored.");
    if (!queue.current) throw new Error("Wait for your draft to open.");
    importing.current = true;
    try {
      await queue.current.idle();
      if (locked.current)
        throw new Error("Return to the draft before restoring a backup.");
      if (queue.current.error || queue.current.pending)
        throw new Error(
          "Export your current version and reload before restoring.",
        );
      const restored = revisionId
        ? await localRevisions.restore(revisionId, queue.current.revision)
        : await localDrafts.importBackup(text, queue.current.revision);
      queue.current.revision = restored.revision;
      if (mounted.current) {
        publish(createHistory(restored.value));
        setError("");
        setStatus(
          revisionId
            ? "Revision restored on this device"
            : "Backup restored on this device",
        );
      }
      channel.current?.postMessage({ revision: restored.revision });
    } finally {
      importing.current = false;
    }
  }
  return {
    site,
    error,
    status,
    update,
    undo,
    redo,
    endGroup,
    restore,
    withSaved,
    applyArrangementStudy,
    applyRelationship,
    applyFlow,
    canUndo: !comparison && !readOnly && historyState.canUndo,
    canRedo: !comparison && !readOnly && historyState.canRedo,
  };
}
