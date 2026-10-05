import { mkdir, lstat, open, unlink, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ObjectStore } from "./contracts";
import { assertKey, fail, hash } from "./validation";
/** Service-owned private directory; flat filenames avoid caller-controlled subdirectories. */
export class PrivateFiles implements ObjectStore {
  #root: string;
  private constructor(root: string) {
    this.#root = root;
  }
  static async create(root: string) {
    const absolute = resolve(root);
    await mkdir(absolute, { recursive: true, mode: 0o700 });
    if ((await lstat(absolute)).isSymbolicLink())
      fail("INVALID", "Private storage root must not be a symlink.");
    // Canonicalize macOS /var and /tmp aliases once; callers never control keys as paths.
    return new PrivateFiles(await realpath(absolute));
  }
  #path(key: string) {
    return resolve(this.#root, assertKey(key).replaceAll("/", "_"));
  }
  async put(key: string, bytes: Uint8Array) {
    const path = this.#path(key);
    let handle;
    try {
      handle = await open(
        path,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const prior = await this.read(key);
      if (hash(prior) !== hash(bytes))
        fail(
          "CONFLICT",
          "Immutable object already exists with different bytes.",
        );
      return;
    }
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (e) {
      await handle.close();
      await unlink(path).catch(() => {});
      throw e;
    }
    await handle.close();
    const directory = await open(dirname(path), constants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  async read(key: string) {
    const handle = await open(
      this.#path(key),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 90 * 1024 * 1024)
        fail("MEDIA", "Invalid or oversized stored object.");
      return new Uint8Array(await handle.readFile());
    } finally {
      await handle.close();
    }
  }
  async remove(key: string) {
    try {
      await unlink(this.#path(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}
