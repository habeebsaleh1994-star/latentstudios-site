import { RelationshipExplorer } from "./RelationshipExplorer";
import { WorkContext } from "./WorkContext";
import { TextStyleDialog } from "./TextStyleDialog";
import { orderedSections } from "./compositionOrder";
import { WorkSelectionBar, GroupingDialog } from "./CanvasGrouping";
import { StudyComparison } from "./StudyComparison";
import {
  readPreviewPosition,
  placePreviewPosition,
  startPosition,
} from "./previewPosition";
import { needsGroupingReview } from "./workDrop";
import {
  planGrouping,
  selectionRange,
  type GroupingAction,
} from "./regrouping";
import { StudiesBar, ArrangementsDialog } from "./CanvasStudies";
import {
  beginCanvas,
  keepStudy,
  proposeArrangement,
  captureStudy,
  flowArrangement,
} from "./compositionStudies";
import { RitualImportPanel } from "./RitualImportPanel";
import { ReleasePanel } from "./ReleasePanel";
import { CompositionPanel } from "./CompositionPanel";
import { reconcileBlocks } from "./composition";
import {
  EditingContext,
  updateTarget,
  targetKey,
  targetLabel,
  type Selection,
} from "./editing";
import { ContextPanel } from "./ContextPanel";
import { IdentityPanel } from "./IdentityPanel";
import { demoId, storyWorkspaceId, editorHref, siteHref } from "./workspace";
import { sampleInfo } from "./samples";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Film,
  ImagePlus,
  Layers,
  Monitor,
  MoreHorizontal,
  Plus,
  Redo2,
  Smartphone,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { blankBlock, moveItem, uid, type Page, type Block } from "./model";
import { useStudio } from "./useStudio";
import { exportBackup, storeAsset } from "./storage";
import { SiteRenderer } from "./SiteRenderer";
import { PreviewFrame } from "./PreviewFrame";
import { Media } from "./Media";
import { DesignPanel } from "./DesignPanel";
import { FocalPoint } from "./FocalPoint";
import { validateMedia } from "./mediaValidation";
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="icon-button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={label === "Writing" ? 9 : 3}
          maxLength={
            label === "Writing" ? 30000 : label === "Introduction" ? 5000 : 500
          }
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
        />
      )}
    </label>
  );
}
export function App() {
  const params = new URLSearchParams(window.location.search);
  const standalone = params.get("view") === "site";
  const [comparing, setComparing] = useState<string | null>(null);
  const [flowPreview, setFlowPreview] = useState<{
    sectionId: string;
    mobile: boolean;
  } | null>(null);
  const [relationshipWork, setRelationshipWork] = useState<string | null>(null);
  const studio = useStudio(
    standalone,
    comparing !== null || relationshipWork !== null,
  );
  const { site, update } = studio;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectMode, setSelectMode] = useState(true);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [groupingMessage, setGroupingMessage] = useState("");
  const workAnchor = useRef<string | null>(null);
  const clearWorks = useCallback(() => {
    setWorkIds([]);
    setGroupingMessage("");
    workAnchor.current = null;
  }, []);
  const [grouping, setGrouping] = useState<GroupingAction | null>(null);
  const [canvasFocus, setCanvasFocus] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false),
    [guides, setGuides] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.innerWidth > 1100,
  );
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1100px)");
    const collapse = () => {
      if (compact.matches) setInspectorOpen(false);
    };
    compact.addEventListener("change", collapse);
    return () => compact.removeEventListener("change", collapse);
  }, []);
  const comparisonPosition = useRef(startPosition);
  const comparisonGuard = useRef(false);
  comparisonGuard.current = comparing !== null || relationshipWork !== null;
  const mediaGeneration = useRef(0);
  const [exploring, setExploring] = useState<string | null>(null);
  const textSelection =
    selection && selection.kind !== "media" && selection.kind !== "section"
      ? selection
      : null;
  const sectionSelection = selection?.kind === "section" ? selection : null;
  const [pageId, setPageId] = useState(params.get("page") || "home");
  const [tab, setTab] = useState<"pages" | "style" | "identity">("pages");
  const [mobile, setMobile] = useState(false);
  const [previewWidths, setPreviewWidths] = useState<{
    desktop: number | undefined;
    mobile: number;
  }>({ desktop: undefined, mobile: 390 });
  const previewWidth = mobile ? previewWidths.mobile : previewWidths.desktop;
  const [actualPreviewWidth, setActualPreviewWidth] = useState(1024);
  const [workControlsHost, setWorkControlsHost] =
    useState<HTMLDivElement | null>(null);
  const [locateRequest, setLocateRequest] = useState(0);
  const [revealWorkId, setRevealWorkId] = useState<string | null>(null);
  useEffect(() => setRevealWorkId(null), [mobile, pageId, selection]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tools, setTools] = useState(false);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<{
    url: string;
    bytes: number;
    text: string;
  } | null>(null);
  const [importText, setImportText] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{
    pageId: string;
    blockId: string;
    type: "image" | "video";
    assetId: string;
  } | null>(null);
  const page = site?.pages.find((p) => p.id === pageId) ?? site?.pages[0];
  const comparedStudy =
    comparing === "__flow-preview__" && flowPreview && page
      ? captureStudy(
          flowArrangement(page, flowPreview.sectionId, flowPreview.mobile),
          `${flowPreview.mobile ? "Phone" : "Desktop"} · Flow preview`,
          "__flow-preview__",
        )
      : page?.studies?.find((study) => study.id === comparing);
  function compareStudy(id: string | null) {
    if (busy) {
      setNotice(
        "Wait for the current file operation to finish before comparing.",
      );
      return;
    }
    studio.endGroup();
    const frame = document.querySelector<HTMLIFrameElement>(
      id ? ".preview-stage iframe" : ".comparison-pane[data-side='a'] iframe",
    );
    if (frame?.contentDocument)
      comparisonPosition.current = readPreviewPosition(frame.contentDocument);
    comparisonGuard.current = id !== null;
    mediaGeneration.current++;
    uploadTarget.current = null;
    setGrouping(null);
    setExploring(null);
    setTools(false);
    setReleaseOpen(false);
    setImportText(null);
    setComparing(id);
  }
  const canvasArrange = arrangeMode && page?.kind !== "home" && !comparedStudy;
  // A device switch remounts the preview. While the writing dialog owns focus,
  // its selected canvas text must not autofocus in the newly loaded iframe.
  const workContextActive =
    canvasArrange &&
    !!page?.composition &&
    [...page.composition.desktop, ...page.composition.mobile].some(
      (s) => !!s.spatial,
    );
  const chosenWorkId =
    selection && "blockId" in selection ? selection.blockId : null;
  const canvasEdit = selectMode && !arrangeMode && !comparedStudy && !typeOpen;
  useEffect(() => {
    setWorkIds((ids) => {
      const valid = ids.filter((id) => page?.blocks.some((b) => b.id === id));
      return valid.length === ids.length ? ids : valid;
    });
  }, [page?.blocks]);
  function pickWork(id: string, extend: boolean, deviceMobile: boolean) {
    if (!page) return;
    setGroupingMessage("");
    studio.endGroup();
    setSelection(null);
    setSelectedBlock(null);
    if (extend && workAnchor.current)
      setWorkIds(selectionRange(page, workAnchor.current, id, deviceMobile));
    else {
      workAnchor.current = id;
      setWorkIds((ids) =>
        ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id],
      );
    }
  }
  function groupSelected(action: GroupingAction) {
    if (!page) return;
    const plan = planGrouping(page, workIds, action, undefined, mobile);
    if (!plan.ok) {
      setGroupingMessage(plan.reason);
      return;
    }
    setGroupingMessage("");
    if (needsGroupingReview(page, workIds, action, mobile)) {
      setGrouping(action);
      return;
    }
    studio.endGroup();
    changeComposition(() => plan.page);
    setNotice(
      `${action === "group" ? "Works grouped" : "Works separated"}. ${mobile ? "Phone" : "Desktop"} only; other arrangement unchanged. Undo is available.`,
    );
  }
  const block = page?.blocks.find((b) => b.id === selectedBlock);
  useEffect(() => {
    if (
      selection?.kind === "section" &&
      !(
        page?.composition ? orderedSections(page.composition, mobile) : []
      ).some((s) => s.id === selection.sectionId)
    )
      setSelection(null);
  }, [selection, page, mobile]);
  useEffect(
    () => () => {
      if (backup) URL.revokeObjectURL(backup.url);
    },
    [backup],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (comparisonGuard.current) {
        if (
          (e.metaKey || e.ctrlKey) &&
          ["z", "y"].includes(e.key.toLowerCase())
        )
          e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      if (target.isContentEditable || e.isComposing || target.closest("dialog"))
        return;
      if (e.key === "Escape" && !target.closest("dialog")) clearWorks();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        studio.redo();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [studio, clearWorks]);
  function navigate(id: string) {
    studio.endGroup();
    clearWorks();
    setGrouping(null);
    setComparing(null);
    setExploring(null);
    setPageId(id);
    setSelectedBlock(null);
    setSelection(null);
    if (standalone) {
      const url = new URL(window.location.href);
      url.searchParams.set("page", id);
      window.history.pushState({}, "", url);
      window.scrollTo(0, 0);
    }
  }
  useEffect(() => {
    const back = () => {
      setPageId(
        new URLSearchParams(window.location.search).get("page") || "home",
      );
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  function selectCanvas(target: Selection | null) {
    studio.endGroup();
    setSelection(target);
    if (!target) {
      setSelectedBlock(null);
      return;
    }
    setTab("pages");
    if (target.kind === "media" || target.kind === "block") {
      setPageId(target.pageId);
      setSelectedBlock(target.blockId);
    } else {
      if (target.kind === "section") setPageId(target.pageId);
      setSelectedBlock(null);
    }
  }
  function patchPage(patch: Partial<Page>, group?: string) {
    if (page)
      update(
        (s) => ({
          ...s,
          pages: s.pages.map((p) =>
            p.id === page.id
              ? patch.blocks
                ? reconcileBlocks({ ...p, ...patch }, patch.blocks)
                : { ...p, ...patch }
              : p,
          ),
        }),
        group,
      );
  }
  function changeComposition(fn: (p: Page) => Page, group?: string) {
    if (page)
      update(
        (s) => ({
          ...s,
          pages: s.pages.map((p) => (p.id === page.id ? fn(p) : p)),
        }),
        group,
      );
  }
  function compositionPanel(selectedId?: string, focused = false) {
    if (!page) return null;
    return (
      <CompositionPanel
        key={`${page.id}-${focused}`}
        page={page}
        change={changeComposition}
        reviewGroup={(ids) => {
          setWorkIds(ids);
          setGrouping("group");
          setArrangeMode(true);
        }}
        selectedId={selectedId}
        select={(id) =>
          selectCanvas(
            id ? { kind: "section", pageId: page.id, sectionId: id } : null,
          )
        }
        editBlock={(id) =>
          selectCanvas({ kind: "media", pageId: page.id, blockId: id })
        }
        mobile={mobile}
        setMobile={setMobile}
        done={focused ? () => selectCanvas(null) : undefined}
      />
    );
  }
  function patchBlock(patch: Partial<Block>, group?: string) {
    if (page && block)
      update(
        (s) => ({
          ...s,
          pages: s.pages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  blocks: p.blocks.map((b) =>
                    b.id === block.id ? { ...b, ...patch } : b,
                  ),
                }
              : p,
          ),
        }),
        group,
      );
  }
  function addPage(kind: Page["kind"]) {
    if (!site) return;
    const id = uid();
    const title =
      kind === "project"
        ? "Untitled project"
        : kind === "writing"
          ? "A new note"
          : "About the artist";
    update((s) => ({
      ...s,
      pages: [
        ...s.pages,
        {
          id,
          kind,
          title,
          label: title,
          subtitle: "",
          meta: kind === "project" ? "Photography / 2026" : "",
          inNav: kind !== "project",
          blocks: [blankBlock(kind === "project" ? "image" : "text")],
          composition: null,
        },
      ],
    }));
    navigate(id);
    setAdding(false);
    setNotice("Page added. Make it your own.");
  }
  function addBlock(type: Block["type"]) {
    if (!page) return;
    const newBlock = blankBlock(type);
    patchPage({ blocks: [...page.blocks, newBlock] });
    setSelectedBlock(newBlock.id);
  }
  async function exportDraft() {
    if (!site) return;
    setBusy(true);
    try {
      const text = await exportBackup(site);
      const blob = new Blob([text], { type: "application/json" });
      setBackup({ url: URL.createObjectURL(blob), bytes: blob.size, text });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function receiveMedia(file?: File) {
    const target = uploadTarget.current;
    if (comparisonGuard.current || !file || !target) return;
    const generation = mediaGeneration.current;
    setBusy(true);
    try {
      if (
        (target.type === "image" && !file.type.startsWith("image/")) ||
        (target.type === "video" && !file.type.startsWith("video/"))
      )
        throw new Error(
          `Choose ${target.type === "image" ? "an image" : "a video"} for this block.`,
        );
      if (file.size > 30 * 1024 * 1024)
        throw new Error("Choose a file up to 30 MB.");
      await validateMedia(file, target.type);
      if (comparisonGuard.current || mediaGeneration.current !== generation)
        return;
      const assetId = await storeAsset(file);
      let applied = false;
      update((s) => ({
        ...s,
        pages: s.pages.map((p) =>
          p.id === target.pageId
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === target.blockId && b.assetId === target.assetId
                    ? ((applied = true),
                      {
                        ...b,
                        assetId,
                        alt: b.alt || file.name.replace(/\.[^.]+$/, ""),
                      })
                    : b,
                ),
              }
            : p,
        ),
      }));
      setNotice(
        applied
          ? "Media added. Saving your updated draft…"
          : "That block changed while the file was opening. Your newer work was kept.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
      if (mediaInput.current) mediaInput.current.value = "";
    }
  }
  if (!site || !page)
    return (
      <div className="loading">
        <div className="brand-mark">l.</div>
        <h1>Opening your studio</h1>
        <p>{studio.error || "Making room for your work…"}</p>
      </div>
    );
  if (standalone)
    return (
      <>
        <div className="local-preview-bar">
          <a href={editorHref()}>← Return to editor</a>
          <span>
            {demoId
              ? `${sampleInfo[demoId].name} · Demo preview`
              : "Local preview"}{" "}
            · not published
          </span>
        </div>
        <SiteRenderer site={site} pageId={pageId} navigate={navigate} />
      </>
    );
  return (
    <div
      className={`studio-shell ${demoId || storyWorkspaceId ? "is-demo" : ""} ${canvasFocus ? "canvas-focus" : ""} ${arrangeMode ? "is-composing" : ""} ${comparedStudy ? "is-comparing" : ""}`}
    >
      {storyWorkspaceId && (
        <div className="ritual-import-banner">
          <span>Separate Story draft · saved in this browser</span>
          <a href="/">Main draft ↗</a>
        </div>
      )}
      {ritualOpen && (
        <RitualImportPanel
          close={() => setRitualOpen(false)}
          flush={() => studio.withSaved(async () => {})}
        />
      )}
      {demoId && (
        <div className="demo-context-banner">
          <span>
            <b>{sampleInfo[demoId].name}</b> · Separate fictional demo studio
          </span>
          <span>
            <a href="?examples=1">All studies</a>
            <a href="/">Your draft ↗</a>
          </span>
        </div>
      )}
      <header className="studio-header">
        <div className="studio-brand">
          <span className="brand-mark">l.</span>
          <span>
            Latent Studio<small>WORKING TITLE</small>
          </span>
        </div>
        <div className="document-name">
          <span>{site.name}</span>
          <span className="draft-pill">
            {demoId ? "Demo draft" : "Local draft"}
          </span>
        </div>
        <div className="header-actions">
          <div className="history-actions">
            <IconButton
              label="Undo"
              onClick={studio.undo}
              disabled={!studio.canUndo}
            >
              <Undo2 size={16} />
            </IconButton>
            <IconButton
              label="Redo"
              onClick={studio.redo}
              disabled={!studio.canRedo}
            >
              <Redo2 size={16} />
            </IconButton>
          </div>
          <a
            className="view-site"
            href={siteHref(page.id)}
            target="_blank"
            rel="noreferrer"
          >
            View site <ArrowUpRight size={15} />
          </a>
          <button
            className="view-site release-button"
            disabled={!!comparedStudy}
            onClick={() => setReleaseOpen(true)}
          >
            Release & recovery
          </button>
          <div className="tools-wrap">
            <IconButton
              label="Draft tools"
              disabled={!!comparedStudy}
              onClick={() => setTools(!tools)}
            >
              <MoreHorizontal size={20} />
            </IconButton>
            {tools && (
              <div className="popover tools-menu">
                <button
                  onClick={() => {
                    setReleaseOpen(true);
                    setTools(false);
                  }}
                >
                  Release & recovery
                </button>
                <button
                  onClick={() => {
                    setRitualOpen(true);
                    setTools(false);
                  }}
                >
                  Bring a Story from Ritual…
                </button>
                <button
                  onClick={() => {
                    void exportDraft();
                    setTools(false);
                  }}
                  disabled={busy}
                >
                  <Download size={16} /> Export backup
                </button>
                <button
                  onClick={() => {
                    importInput.current?.click();
                    setTools(false);
                  }}
                  disabled={busy}
                >
                  <Upload size={16} /> Restore backup
                </button>
                <p>
                  Saved in this browser.
                  <br />
                  Export to keep a portable copy.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="studio-body">
        <aside
          className="editor-sidebar"
          hidden={
            !inspectorOpen ||
            canvasFocus ||
            !!comparedStudy ||
            workContextActive
          }
          inert={!!comparedStudy}
          onBlurCapture={studio.endGroup}
        >
          <div className="workspace-title">
            <span className="eyebrow">Your website</span>
            <h1>A space for your work.</h1>
          </div>
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Editor sections"
          >
            {(["pages", "style", "identity"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setSelectedBlock(null);
                  setSelection(null);
                }}
              >
                {t === "pages"
                  ? "Pages"
                  : t === "style"
                    ? "Design"
                    : "Identity"}
              </button>
            ))}
          </div>
          <div className="sidebar-scroll">
            {textSelection && (
              <ContextPanel
                site={site}
                target={textSelection}
                mobile={mobile}
                previewDevice={setMobile}
                update={update}
                done={() => selectCanvas(null)}
                identity={() => {
                  selectCanvas(null);
                  setTab("identity");
                }}
              />
            )}
            {sectionSelection &&
              compositionPanel(sectionSelection.sectionId, true)}
            {tab === "pages" && !textSelection && !sectionSelection && (
              <>
                {!selectedBlock ? (
                  <>
                    <div className="section-label">
                      <span>Site structure</span>
                      <button
                        className="text-button"
                        aria-label="Add page"
                        onClick={() => setAdding(!adding)}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    {adding && (
                      <div className="add-page-menu">
                        {(["project", "writing", "about"] as const).map(
                          (kind) => (
                            <button key={kind} onClick={() => addPage(kind)}>
                              <Plus size={13} />
                              {kind === "project"
                                ? "Photography / film project"
                                : kind === "writing"
                                  ? "Writing page"
                                  : "About page"}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                    <div className="page-list">
                      {site.pages.map((p, index) => (
                        <div
                          className={`page-row ${p.id === page.id ? "selected" : ""}`}
                          key={p.id}
                        >
                          <button
                            className="page-select"
                            onClick={() => navigate(p.id)}
                          >
                            {p.kind === "home" ? (
                              <Layers size={15} />
                            ) : p.kind === "project" ? (
                              <span className="page-indent">↳</span>
                            ) : (
                              <FileText size={15} />
                            )}
                            <span>{p.label}</span>
                            {p.kind === "home" && (
                              <span className="home-label">Home</span>
                            )}
                          </button>
                          <div className="row-reorder">
                            <IconButton
                              label={`Move ${p.label} up`}
                              disabled={index === 0}
                              onClick={() =>
                                update((s) => ({
                                  ...s,
                                  pages: moveItem(s.pages, index, index - 1),
                                }))
                              }
                            >
                              <ArrowUp size={12} />
                            </IconButton>
                            <IconButton
                              label={`Move ${p.label} down`}
                              disabled={index === site.pages.length - 1}
                              onClick={() =>
                                update((s) => ({
                                  ...s,
                                  pages: moveItem(s.pages, index, index + 1),
                                }))
                              }
                            >
                              <ArrowDown size={12} />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="editor-divider" />
                    <div className="section-label">
                      <span>
                        {page.kind === "home"
                          ? "Home page"
                          : page.kind === "project"
                            ? "Project details"
                            : "Page details"}
                      </span>
                      <span className="quiet">
                        {page.kind === "project" ? "PROJECT" : ""}
                      </span>
                    </div>
                    <Field
                      label="Title"
                      value={page.title}
                      onChange={(title) =>
                        patchPage({ title }, `page:${page.id}:title`)
                      }
                      multiline
                    />
                    <Field
                      label="Introduction"
                      value={page.subtitle}
                      onChange={(subtitle) =>
                        patchPage({ subtitle }, `page:${page.id}:subtitle`)
                      }
                      multiline
                    />
                    <Field
                      label="Small print"
                      value={page.meta}
                      onChange={(meta) =>
                        patchPage({ meta }, `page:${page.id}:meta`)
                      }
                    />
                    <details className="page-settings">
                      <summary>
                        Navigation & page settings <ChevronRight size={14} />
                      </summary>
                      <Field
                        label="Navigation label"
                        value={page.label}
                        onChange={(label) =>
                          patchPage({ label }, `page:${page.id}:label`)
                        }
                      />
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={page.inNav}
                          onChange={(e) =>
                            patchPage({ inNav: e.target.checked })
                          }
                        />
                        Show in navigation
                      </label>
                      {page.kind !== "home" && (
                        <button
                          className="remove-button"
                          onClick={() => {
                            update((s) => ({
                              ...s,
                              pages: s.pages.filter((p) => p.id !== page.id),
                            }));
                            navigate(
                              site.pages.find((p) => p.kind === "home")!.id,
                            );
                            setNotice(
                              "Page removed. Use Undo to bring it back.",
                            );
                          }}
                        >
                          Remove page
                        </button>
                      )}
                    </details>
                    {page.kind !== "home" && (
                      <>
                        <div className="editor-divider" />
                        <div className="section-label">
                          <span>Sequence</span>
                          <span className="quiet">
                            {String(page.blocks.length).padStart(2, "0")} blocks
                          </span>
                        </div>
                        <p className="panel-hint">
                          Shape the rhythm. Every image and word has a place.
                        </p>
                        {compositionPanel()}
                        {!page.composition?.enabled && (
                          <div className="block-list">
                            {page.blocks.map((b, i) => (
                              <div className="block-row" key={b.id}>
                                <button
                                  className="block-select"
                                  onClick={() => setSelectedBlock(b.id)}
                                >
                                  <span className="sequence-number">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  {b.type === "text" ? (
                                    <Type size={19} />
                                  ) : (
                                    <div className="block-thumbnail">
                                      <Media block={b} thumb />
                                    </div>
                                  )}
                                  <span>
                                    {b.type === "text"
                                      ? b.text.slice(0, 28)
                                      : b.caption ||
                                        (b.type === "video"
                                          ? "Film"
                                          : "Photograph")}
                                  </span>
                                </button>
                                <div className="sequence-actions">
                                  <IconButton
                                    label={`Move block ${i + 1} up`}
                                    onClick={() =>
                                      patchPage({
                                        blocks: moveItem(page.blocks, i, i - 1),
                                      })
                                    }
                                    disabled={i === 0 || !!page.composition}
                                  >
                                    <ArrowUp size={12} />
                                  </IconButton>
                                  <IconButton
                                    label={`Move block ${i + 1} down`}
                                    onClick={() =>
                                      patchPage({
                                        blocks: moveItem(page.blocks, i, i + 1),
                                      })
                                    }
                                    disabled={
                                      i === page.blocks.length - 1 ||
                                      !!page.composition
                                    }
                                  >
                                    <ArrowDown size={12} />
                                  </IconButton>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="add-blocks">
                          <button onClick={() => addBlock("image")}>
                            <ImagePlus size={16} />
                            Image
                          </button>
                          <button onClick={() => addBlock("text")}>
                            <Type size={16} />
                            Text
                          </button>
                          <button onClick={() => addBlock("video")}>
                            <Film size={16} />
                            Film
                          </button>
                        </div>
                      </>
                    )}
                    {page.kind === "home" && (
                      <div className="editor-note">
                        <span>Begin with a body of work.</span>
                        <p>
                          Your projects appear here in the order above. Select
                          one to arrange its images, writing, and films.
                        </p>
                      </div>
                    )}
                  </>
                ) : block ? (
                  <>
                    <button
                      className="back-link"
                      onClick={() => {
                        setSelectedBlock(null);
                        setSelection(null);
                      }}
                    >
                      <ChevronLeft size={15} />
                      Back to {page.kind === "project" ? "project" : "page"}
                    </button>
                    <div className="block-heading">
                      <h2>
                        {block.type === "image"
                          ? "Photograph"
                          : block.type === "video"
                            ? "Film"
                            : "Writing"}
                      </h2>
                      <span>
                        {String(
                          page.blocks.findIndex((b) => b.id === block.id) + 1,
                        ).padStart(2, "0")}
                      </span>
                    </div>
                    {block.type === "text" ? (
                      <Field
                        label="Writing"
                        value={block.text}
                        onChange={(text) =>
                          patchBlock({ text }, `block:${block.id}:text`)
                        }
                        multiline
                      />
                    ) : (
                      <>
                        <div className="media-inspector">
                          <Media block={block} />
                        </div>
                        <button
                          className="wide-button"
                          disabled={busy}
                          onClick={() => {
                            uploadTarget.current = {
                              pageId: page.id,
                              blockId: block.id,
                              type: block.type === "video" ? "video" : "image",
                              assetId: block.assetId,
                            };
                            mediaInput.current?.click();
                          }}
                        >
                          <Upload size={15} />
                          {block.assetId ? "Replace" : "Choose"}{" "}
                          {block.type === "video" ? "film" : "photograph"}
                        </button>
                        <p className="panel-hint">
                          {block.type === "video"
                            ? "MP4 or WebM. Native playback, no third-party embed."
                            : "JPG, PNG, WebP or GIF. Your original stays intact."}{" "}
                          Up to 30 MB, stored locally.
                        </p>
                        <Field
                          label="Caption"
                          value={block.caption}
                          onChange={(caption) =>
                            patchBlock({ caption }, `block:${block.id}:caption`)
                          }
                        />
                        <Field
                          label={
                            block.type === "image"
                              ? "Alternative text"
                              : "Film description"
                          }
                          value={block.alt}
                          onChange={(alt) =>
                            patchBlock({ alt }, `block:${block.id}:alt`)
                          }
                          multiline
                        />
                        {block.type === "image" && (
                          <label className="field">
                            <span>Image treatment</span>
                            <select
                              value={block.fit}
                              onChange={(e) =>
                                patchBlock({
                                  fit: e.target.value as Block["fit"],
                                })
                              }
                            >
                              <option value="original">
                                Original proportions · no crop
                              </option>
                              <option value="landscape">
                                Landscape crop · 3:2
                              </option>
                              <option value="portrait">
                                Portrait crop · 4:5
                              </option>
                            </select>
                          </label>
                        )}
                      </>
                    )}
                    {block.type === "image" && block.assetId && (
                      <FocalPoint
                        block={block}
                        change={(focal) =>
                          patchBlock({ focal }, `focal:${block.id}`)
                        }
                        finish={studio.endGroup}
                      />
                    )}
                    <label className="field">
                      <span>Page placement</span>
                      <select
                        value={block.width}
                        onChange={(e) =>
                          patchBlock({
                            width: e.target.value as Block["width"],
                          })
                        }
                      >
                        <option value="full">Full width</option>
                        <option value="inset">
                          Inset · more breathing room
                        </option>
                      </select>
                    </label>
                    {page.composition?.enabled && (
                      <button
                        className="wide-button"
                        onClick={() => {
                          const section = (
                            page.composition
                              ? orderedSections(page.composition, mobile)
                              : []
                          ).find((s) => s.blockIds.includes(block.id));
                          if (section)
                            selectCanvas({
                              kind: "section",
                              pageId: page.id,
                              sectionId: section.id,
                            });
                        }}
                      >
                        Arrange this work’s section ↗
                      </button>
                    )}
                    <button
                      className="remove-button"
                      onClick={() => {
                        patchPage({
                          blocks: page.blocks.filter((b) => b.id !== block.id),
                        });
                        setSelectedBlock(null);
                        setNotice("Block removed. Undo is available.");
                      }}
                    >
                      Remove this block
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedBlock(null);
                      setSelection(null);
                    }}
                  >
                    Return to page
                  </button>
                )}
              </>
            )}
            {tab === "style" && <DesignPanel site={site} update={update} />}
            {tab === "identity" && (
              <>
                <div className="section-label">
                  <span>The artist</span>
                </div>
                <Field
                  label="Artist or studio name"
                  value={site.name}
                  onChange={(name) =>
                    update((s) => ({ ...s, name }), "identity:name")
                  }
                />
                <Field
                  label="Practice / description"
                  value={site.tagline}
                  onChange={(tagline) =>
                    update((s) => ({ ...s, tagline }), "identity:tagline")
                  }
                />
                <EmailField
                  value={site.email}
                  save={(email) =>
                    update((s) => ({ ...s, email }), "identity:email")
                  }
                />
                <div className="editor-divider" />
                <IdentityPanel site={site} update={update} />
                <div className="editor-divider" />
                <div className="section-label">
                  <span>Your draft belongs to you</span>
                </div>
                <p className="panel-hint">
                  Edits and uploaded media are saved in this browser on this
                  device. Clearing browser data will remove them. A backup keeps
                  a portable copy.
                </p>
                <button
                  className="wide-button"
                  onClick={() => void exportDraft()}
                  disabled={busy}
                >
                  <Download size={15} />
                  Export backup
                </button>
                <button
                  className="wide-button secondary"
                  onClick={() => importInput.current?.click()}
                  disabled={busy}
                >
                  <Upload size={15} />
                  Restore backup
                </button>
                <div className="editor-note">
                  <span>Publishing comes later.</span>
                  <p>
                    Hosting, a Latent subdomain, custom domains, and billing are
                    not connected in this local edition.
                  </p>
                </div>
                <p className="demo-note">
                  Sample artist studios are fictional and stored separately.
                  Photographs are licensed via Unsplash; writing and geometric
                  works are original demo material. No Habib Saleh artwork is
                  included.
                </p>
              </>
            )}
          </div>
          <div className="sidebar-footer">
            <span className={`save-dot ${studio.error ? "error" : ""}`} />
            <span>Local save: {studio.status}</span>
            <span className="local-symbol">↙</span>
          </div>
        </aside>
        <section className="canvas-area" aria-label="Live website canvas">
          <div className="canvas-toolbar">
            <div className="canvas-breadcrumb">
              <span>{site.name}</span>
              <ChevronRight size={12} />
              <strong>{page.label}</strong>
            </div>
            <div className="device-switch" aria-label="Preview size">
              <button
                aria-label="Desktop preview"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                <Monitor size={16} />
              </button>
              <button
                aria-label="Mobile preview"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                <Smartphone size={16} />
              </button>
            </div>
            <label className="viewport-width-control">
              Viewport
              <select
                aria-label="Actual viewport width"
                value={previewWidth ?? "auto"}
                onChange={(e) => {
                  setPreviewWidths((widths) => ({
                    ...widths,
                    [mobile ? "mobile" : "desktop"]:
                      e.target.value === "auto"
                        ? undefined
                        : Number(e.target.value),
                  }));
                  setLocateRequest((n) => n + 1);
                }}
              >
                {!mobile && (
                  <option value="auto">
                    Auto · {Math.round(actualPreviewWidth)}px
                  </option>
                )}
                {(mobile ? [360, 390, 430] : [768, 1024, 1440]).map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </label>
            <div className="canvas-mode" aria-label="Canvas interaction">
              <button
                disabled={!!comparedStudy}
                aria-pressed={selectMode && !arrangeMode}
                onClick={() => {
                  setSelectMode(true);
                  setArrangeMode(false);
                  setComparing(null);
                }}
              >
                Edit
              </button>
              {page.kind !== "home" && (
                <button
                  disabled={!!comparedStudy}
                  aria-pressed={arrangeMode}
                  onClick={() => {
                    studio.endGroup();
                    changeComposition(beginCanvas);
                    setArrangeMode(true);
                    if (
                      page.composition &&
                      [
                        ...page.composition.desktop,
                        ...page.composition.mobile,
                      ].some((s) => s.spatial)
                    )
                      selectCanvas({
                        kind: "media",
                        pageId: page.id,
                        blockId: chosenWorkId ?? page.blocks[0].id,
                      });
                    setComparing(null);
                  }}
                >
                  Arrange
                </button>
              )}
              <button
                disabled={!!comparedStudy}
                aria-pressed={!selectMode && !arrangeMode}
                onClick={() => {
                  studio.endGroup();
                  setSelection(null);
                  setSelectMode(false);
                  setArrangeMode(false);
                  setComparing(null);
                }}
              >
                Browse
              </button>
            </div>
            <div className="canvas-view-controls" aria-label="Canvas view">
              <button
                aria-pressed={zoom === "fit"}
                onClick={() => setZoom("fit")}
                title="Fit the full viewport"
              >
                Fit
              </button>
              <button
                aria-label="Actual size"
                aria-pressed={zoom === "actual"}
                onClick={() => setZoom("actual")}
                title="Actual size · scroll horizontally if needed"
              >
                100%
              </button>
              <button
                hidden={workContextActive}
                disabled={!!comparedStudy}
                aria-label={
                  inspectorOpen && !canvasFocus
                    ? "Hide inspector"
                    : "Show inspector"
                }
                aria-expanded={inspectorOpen && !canvasFocus && !comparedStudy}
                onClick={() => {
                  setInspectorOpen(canvasFocus || !inspectorOpen);
                  setCanvasFocus(false);
                }}
              >
                ☷<span> Inspector</span>
              </button>
              {textSelection?.kind === "block" &&
                textSelection.field === "text" &&
                !comparedStudy && (
                  <button onClick={() => setTypeOpen(true)}>
                    Style this writing
                  </button>
                )}
              {arrangeMode && !comparedStudy && (
                <button
                  className="canvas-guide-toggle"
                  aria-pressed={guides}
                  onClick={() => setGuides(!guides)}
                >
                  Guides
                </button>
              )}
              <button
                className="canvas-focus-toggle"
                aria-pressed={canvasFocus}
                aria-label={canvasFocus ? "Exit canvas focus" : "Focus canvas"}
                onClick={() => setCanvasFocus(!canvasFocus)}
              >
                {canvasFocus ? "Exit focus" : "Focus"}
              </button>
            </div>
            {canvasFocus && (
              <div className="focus-history">
                <IconButton
                  label="Undo"
                  onClick={studio.undo}
                  disabled={!studio.canUndo}
                >
                  <Undo2 size={16} />
                </IconButton>
                <IconButton
                  label="Redo"
                  onClick={studio.redo}
                  disabled={!studio.canRedo}
                >
                  <Redo2 size={16} />
                </IconButton>
              </div>
            )}
          </div>
          <div className="canvas-selection-bar">
            <span>
              {comparedStudy
                ? "Read-only study preview. Return to the draft to edit."
                : canvasArrange
                  ? `${mobile ? "Mobile" : "Desktop"} arrangement · select works to compose; drag a grip to move. Shift-click selects a range.`
                  : selection
                    ? `Selected: ${targetLabel(selection)}`
                    : selectMode
                      ? "Click words to write. Select a photograph to shape it."
                      : "Browse your website. Links and film controls are active."}
            </span>
            {selection ? (
              <button onClick={() => selectCanvas(null)}>Done ×</button>
            ) : (
              <a href="?examples=1" target="_blank" rel="noreferrer">
                Artist studies ↗
              </a>
            )}
          </div>
          {page.kind !== "home" && (arrangeMode || !!page.studies?.length) && (
            <StudiesBar
              key={page.id}
              page={page}
              comparing={comparing}
              compare={compareStudy}
              keep={(name) =>
                changeComposition((p) =>
                  keepStudy(p, name || `Study ${(p.studies?.length ?? 0) + 1}`),
                )
              }
              remove={(id) => {
                changeComposition((p) => ({
                  ...p,
                  studies: p.studies?.filter((study) => study.id !== id),
                }));
                if (comparing === id) setComparing(null);
              }}
            />
          )}
          {studio.error && (
            <div className="save-error" role="alert">
              {studio.error}
              <button onClick={() => void exportDraft()}>
                Export this version
              </button>
            </div>
          )}
          {comparedStudy ? (
            <StudyComparison
              applyLabel={
                flowPreview && comparing === "__flow-preview__"
                  ? "Use flow · keep placement"
                  : undefined
              }
              scopeNote={
                flowPreview && comparing === "__flow-preview__"
                  ? `${flowPreview.mobile ? "Phone" : "Desktop"} only. Applying keeps a named spatial study and retains your placement for re-entry.`
                  : undefined
              }
              site={site}
              page={page}
              study={comparedStudy}
              mobile={mobile}
              zoom={zoom}
              viewportWidth={previewWidth}
              initialPosition={comparisonPosition.current}
              close={(position) => {
                comparisonPosition.current = position;
                setComparing(null);
              }}
              apply={() => {
                if (comparing === "__flow-preview__" && flowPreview)
                  studio.applyFlow(
                    page.id,
                    flowPreview.sectionId,
                    flowPreview.mobile,
                  );
                else studio.applyArrangementStudy(page.id, comparedStudy.id);
                setComparing(null);
                if (!comparedStudy.composition?.enabled) {
                  setArrangeMode(false);
                  setSelectMode(true);
                }
                setNotice(
                  "Arrangement applied. Previous arrangement retained as a study. Undo is available.",
                );
              }}
            />
          ) : (
            <div className={`preview-stage ${mobile ? "mobile" : ""}`}>
              <div
                className="preview-paper"
                style={
                  previewWidth
                    ? { width: previewWidth, maxWidth: "100%" }
                    : undefined
                }
              >
                <PreviewFrame
                  mobile={mobile}
                  zoom={zoom}
                  viewportWidth={previewWidth}
                  onViewport={setActualPreviewWidth}
                  pageId={`${page.id}-${site.styleId}`}
                  onReady={(doc) =>
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() =>
                        placePreviewPosition(doc, comparisonPosition.current),
                      ),
                    )
                  }
                >
                  <EditingContext.Provider
                    value={{
                      site,
                      enabled: canvasEdit,
                      arrange: canvasArrange
                        ? {
                            controlsHost: workControlsHost,
                            locateRequest,
                            locateWork: (id) => {
                              selectCanvas({
                                kind: "media",
                                pageId: page.id,
                                blockId: id,
                              });
                              setLocateRequest((n) => n + 1);
                            },
                            revealWorkId,
                            cancelReveal: () => setRevealWorkId(null),
                            previewFlow: (sectionId, deviceMobile) => {
                              setFlowPreview({
                                sectionId,
                                mobile: deviceMobile,
                              });
                              compareStudy("__flow-preview__");
                            },
                            change: (id, fn) =>
                              update((s) => ({
                                ...s,
                                pages: s.pages.map((p) =>
                                  p.id === id ? fn(p) : p,
                                ),
                              })),
                            explore: setExploring,
                            workIds,
                            guides,
                            pickWork,
                            clearWorks,
                            reviewGrouping: (ids) => {
                              setWorkIds(ids);
                              setGrouping("group");
                            },
                          }
                        : undefined,
                      selection,
                      select: selectCanvas,
                      change: (target, value) =>
                        update(
                          (s) => updateTarget(s, target, value),
                          `copy:${targetKey(target)}`,
                        ),
                      finish: studio.endGroup,
                      undo: studio.undo,
                      redo: studio.redo,
                    }}
                  >
                    <SiteRenderer
                      focusBlockId={selectedBlock}
                      site={site}
                      pageId={page.id}
                      navigate={comparedStudy ? () => {} : navigate}
                      onEdit={
                        canvasEdit
                          ? (id) =>
                              selectCanvas({
                                kind: "media",
                                pageId: page.id,
                                blockId: id,
                              })
                          : undefined
                      }
                    />
                  </EditingContext.Provider>
                </PreviewFrame>
              </div>
            </div>
          )}
          {workContextActive && (
            <WorkContext
              page={page}
              exploreRelationship={(id) => {
                studio.endGroup();
                setRelationshipWork(id);
              }}
              id={chosenWorkId}
              mobile={mobile}
              viewport={Math.round(actualPreviewWidth)}
              choose={(id) => {
                selectCanvas({ kind: "media", pageId: page.id, blockId: id });
                setLocateRequest((n) => n + 1);
              }}
              find={() => {
                const doc = document.querySelector<HTMLIFrameElement>(
                  ".preview-stage iframe",
                )?.contentDocument;
                [
                  ...(doc?.querySelectorAll<HTMLElement>(
                    "[data-composition-block]",
                  ) ?? []),
                ]
                  .find((el) => el.dataset.compositionBlock === chosenWorkId)
                  ?.scrollIntoView({ block: "center", inline: "nearest" });
              }}
              reveal={revealWorkId}
              setReveal={setRevealWorkId}
              host={setWorkControlsHost}
              change={changeComposition}
              previewFlow={(sectionId) => {
                setFlowPreview({ sectionId, mobile });
                compareStudy("__flow-preview__");
              }}
            />
          )}
          {canvasArrange && !workContextActive && workIds.length > 0 && (
            <WorkSelectionBar
              page={page}
              mobile={mobile}
              ids={workIds}
              message={groupingMessage}
              review={groupSelected}
              clear={clearWorks}
              explore={setExploring}
              removeIntention={(id) =>
                changeComposition((p) => ({
                  ...p,
                  intentions: p.intentions?.filter((r) => r.id !== id),
                }))
              }
              relationship={() => {
                studio.endGroup();
                setRelationshipWork(workIds[0]);
              }}
            />
          )}
          <div className="canvas-footer">
            <span>
              <span className="tiny-cross">✧</span> {site.styleId.toUpperCase()}{" "}
              <span className="quiet">/</span> YOUR WORK, IN ITS OWN WORLD
            </span>
            <span className="canvas-save-status" role="status">
              {studio.status}
              <span className="live-dot" />
            </span>
          </div>
        </section>
      </div>
      {typeOpen &&
        textSelection?.kind === "block" &&
        textSelection.field === "text" &&
        !comparedStudy && (
          <TextStyleDialog
            site={site}
            target={textSelection}
            mobile={mobile}
            previewDevice={setMobile}
            update={update}
            close={() => setTypeOpen(false)}
            undo={studio.undo}
            redo={studio.redo}
            canUndo={studio.canUndo}
            canRedo={studio.canRedo}
          />
        )}
      {exploring &&
        (page.composition
          ? orderedSections(page.composition, mobile)
          : []
        ).some((s) => s.id === exploring) && (
          <ArrangementsDialog
            site={site}
            page={page}
            sectionId={exploring}
            initialMobile={mobile}
            close={() => setExploring(null)}
            apply={(option, deviceMobile) => {
              changeComposition((p) =>
                proposeArrangement(p, exploring, option, deviceMobile),
              );
              setExploring(null);
              setNotice(
                `Arrangement applied to ${deviceMobile ? "mobile" : "desktop"}. Other device geometry, crops and captions retained.`,
              );
            }}
          />
        )}
      {grouping && (
        <GroupingDialog
          site={site}
          page={page}
          ids={workIds}
          action={grouping}
          initialMobile={mobile}
          close={() => setGrouping(null)}
          apply={(action, id, deviceMobile) => {
            changeComposition((p) => {
              const plan = planGrouping(p, workIds, action, id, deviceMobile);
              if (!plan.ok) throw new Error(plan.reason);
              return plan.page;
            });
            setGrouping(null);
            setSelection(
              action === "group"
                ? { kind: "section", pageId: page.id, sectionId: id }
                : null,
            );
            setNotice(
              `${deviceMobile ? "Phone" : "Desktop"} grouping updated. Other device, original media and crops retained.`,
            );
          }}
        />
      )}
      {relationshipWork && (
        <RelationshipExplorer
          error={studio.error}
          site={site}
          page={page}
          selected={relationshipWork}
          mobile={mobile}
          close={() => setRelationshipWork(null)}
          apply={(source, q, ratio, id) => {
            if (!studio.applyRelationship(page.id, source, q, ratio, id))
              return;
            setRelationshipWork(null);
            setNotice(
              "Composition applied. Previous arrangement kept as a study. Undo is available.",
            );
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <input
        hidden
        type="file"
        accept={
          block?.type === "video"
            ? "video/mp4,video/webm"
            : "image/jpeg,image/png,image/webp,image/gif"
        }
        ref={mediaInput}
        disabled={!!comparedStudy}
        onChange={(e) => void receiveMedia(e.target.files?.[0])}
      />
      <input
        hidden
        type="file"
        accept="application/json,.json"
        ref={importInput}
        disabled={!!comparedStudy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (comparisonGuard.current || !file) return;
          const generation = mediaGeneration.current;
          if (file.size > 90 * 1024 * 1024) {
            setNotice("Choose a backup smaller than 90 MB.");
            return;
          }
          const text = await file.text();
          if (comparisonGuard.current || mediaGeneration.current !== generation)
            return;
          setImportText(text);
          e.target.value = "";
        }}
      />
      {releaseOpen && (
        <ReleasePanel studio={studio} close={() => setReleaseOpen(false)} />
      )}
      {importText !== null && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <span className="eyebrow">Restore a local backup</span>
            <h2 id="restore-title">Make room for another draft.</h2>
            <p>
              Restoring creates a new draft in this browser and retains the
              current draft in Release & recovery. Invalid backups leave your
              draft untouched.
            </p>
            <button
              className="wide-button"
              onClick={() => void exportDraft()}
              disabled={busy}
            >
              Export current draft
            </button>
            <div className="modal-actions">
              <button onClick={() => setImportText(null)}>Cancel</button>
              <button
                className="dark-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await studio.restore(importText);
                    navigate("home");
                    setImportText(null);
                    setNotice("Backup restored.");
                  } catch (e) {
                    setNotice((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore backup
              </button>
            </div>
          </div>
        </div>
      )}
      {backup && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="backup-title"
          >
            <span className="eyebrow">Your portable draft</span>
            <h2 id="backup-title">Keep a copy of your work.</h2>
            <p>
              Your pages, design, writing, and uploaded media are ready in one
              backup file. Download it somewhere you can find again.
            </p>
            <p>{(backup.bytes / 1024).toFixed(0)} KB · Latent Studio backup</p>
            <a
              className="wide-button backup-download"
              href={backup.url}
              download={`latent-studio-${new Date().toISOString().slice(0, 10)}.json`}
            >
              Download backup <Download size={15} />
            </a>
            <button
              className="wide-button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(backup.text);
                  setNotice(
                    "Backup JSON copied. Save it as a .json file to keep it.",
                  );
                } catch {
                  setNotice(
                    "Clipboard access was unavailable. Use the download link.",
                  );
                }
              }}
            >
              Copy backup JSON
            </button>
            <div className="modal-actions">
              <button onClick={() => setBackup(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function EmailField({
  value,
  save,
}: {
  value: string;
  save: (email: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="field">
      <span>Contact email (optional)</span>
      <input
        type="email"
        value={draft}
        placeholder="you@example.com"
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.validity.valid) {
            save(e.target.value);
            setInvalid(false);
          } else setInvalid(true);
        }}
      />
      {invalid && (
        <small className="invalid">
          Enter a valid email to save this field.
        </small>
      )}
    </label>
  );
}
