export interface MediaDimensions {
  width: number;
  height: number;
  duration?: number;
}
export async function validateMedia(
  file: File,
  type: "image" | "video",
  signal?: AbortSignal,
): Promise<MediaDimensions> {
  signal?.throwIfAborted();
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<MediaDimensions>((resolve, reject) => {
      const image = type === "image" ? new Image() : null;
      const video = type === "video" ? document.createElement("video") : null;
      const finish = (result?: MediaDimensions, error?: Error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (image) {
          image.onload = null;
          image.onerror = null;
          image.removeAttribute("src");
        }
        if (video) {
          video.onloadedmetadata = null;
          video.onerror = null;
          video.removeAttribute("src");
          video.load();
        }
        if (error) reject(error);
        else resolve(result!);
      };
      const abort = () =>
        finish(
          undefined,
          new DOMException("Media review cancelled.", "AbortError"),
        );
      const timer = setTimeout(
        () =>
          finish(
            undefined,
            new Error("Media could not be read within 15 seconds."),
          ),
        15000,
      );
      signal?.addEventListener("abort", abort, { once: true });
      if (image) {
        image.onload = () => {
          const width = image.naturalWidth,
            height = image.naturalHeight;
          if (!width || !height)
            finish(undefined, new Error("No image dimensions."));
          else if (width * height > 100_000_000)
            finish(
              undefined,
              new Error(
                "This photograph exceeds the 100 megapixel local decoding limit.",
              ),
            );
          else finish({ width, height });
        };
        image.onerror = () =>
          finish(
            undefined,
            new Error("This file could not be decoded as a photograph."),
          );
        image.src = url;
      }
      if (video) {
        video.onloadedmetadata = () =>
          video.videoWidth > 0 && Number.isFinite(video.duration)
            ? finish({
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
              })
            : finish(
                undefined,
                new Error("No playable video track was found."),
              );
        video.onerror = () =>
          finish(
            undefined,
            new Error("This browser cannot play the selected film."),
          );
        video.preload = "metadata";
        video.src = url;
      }
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
