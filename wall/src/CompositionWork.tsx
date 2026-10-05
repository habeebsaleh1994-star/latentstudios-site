import type { Block, CaptionTreatment } from "./model";
import { EditableText, useEditing } from "./editing";
import { Media } from "./Media";
/** One content renderer for flowing and freely placed works. */
export function CompositionWork({
  block: b,
  pageId,
  caption,
}: {
  block: Block;
  pageId: string;
  caption?: CaptionTreatment;
}) {
  const editor = useEditing();
  return b.type === "text" ? (
    <EditableText
      as="div"
      className="direction-prose"
      target={{ kind: "block", pageId, blockId: b.id, field: "text" }}
      value={b.text}
    />
  ) : (
    <figure data-caption-position={caption?.position}>
      <div className="composition-media">
        <Media block={b} />
      </div>
      {(b.caption || editor?.enabled) && (
        <figcaption
          data-caption-backing={caption?.backing}
          style={
            caption?.size
              ? { fontSize: caption.size, lineHeight: 1.5 }
              : undefined
          }
        >
          <EditableText
            target={{ kind: "block", pageId, blockId: b.id, field: "caption" }}
            value={b.caption}
          />
        </figcaption>
      )}
    </figure>
  );
}
