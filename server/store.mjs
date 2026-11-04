import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const EMPTY = {
  version: 1,
  limits: { crawlUrlsPerArticle: 3, searchesPerArticle: 5, inspectionsPerArticle: 5 },
  tasks: {},
  sources: []
};

export class JsonStore {
  #tail = Promise.resolve();
  constructor(filePath) { this.filePath = filePath; }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try { await readFile(this.filePath, "utf8"); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.#write(EMPTY);
    }
  }

  async read() {
    await this.#tail;
    try { return JSON.parse(await readFile(this.filePath, "utf8")); }
    catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  async transact(mutator) {
    const operation = this.#tail.then(async () => {
      const state = await this.readUnlocked();
      const result = await mutator(state);
      await this.#write(state);
      return result;
    });
    this.#tail = operation.catch(() => {});
    return operation;
  }

  async readUnlocked() {
    try { return JSON.parse(await readFile(this.filePath, "utf8")); }
    catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  async #write(state) {
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
