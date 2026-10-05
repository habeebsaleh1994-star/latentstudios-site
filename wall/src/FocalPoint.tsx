import type { Block } from "./model";
import { Media } from "./Media";
export function FocalPoint({
  block,
  change,
  finish,
}: {
  block: Block;
  change: (focal: Block["focal"]) => void;
  finish: () => void;
}) {
  function position(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    change({
      x: Math.max(
        0,
        Math.min(100, Math.round(((e.clientX - box.left) / box.width) * 100)),
      ),
      y: Math.max(
        0,
        Math.min(100, Math.round(((e.clientY - box.top) / box.height) * 100)),
      ),
    });
  }
  return (
    <div className="focal-editor">
      <div className="section-label">
        <span>Focal point</span>
        <button
          className="text-button"
          onClick={() => {
            change({ x: 50, y: 50 });
            finish();
          }}
        >
          Center
        </button>
      </div>
      <div
        className="focal-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          position(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) position(e);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <Media block={block} thumb />
        <span
          className="focal-marker"
          aria-hidden="true"
          style={{ left: `${block.focal.x}%`, top: `${block.focal.y}%` }}
        />
      </div>
      <p className="panel-hint">
        Click or drag to guide cover images and crops. Original proportions
        always keep the full photograph.
      </p>
      <label className="field">
        <span>
          Horizontal position <b>{block.focal.x}%</b>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={block.focal.x}
          onChange={(e) =>
            change({ ...block.focal, x: Number(e.target.value) })
          }
        />
      </label>
      <label className="field">
        <span>
          Vertical position <b>{block.focal.y}%</b>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={block.focal.y}
          onChange={(e) =>
            change({ ...block.focal, y: Number(e.target.value) })
          }
        />
      </label>
    </div>
  );
}
