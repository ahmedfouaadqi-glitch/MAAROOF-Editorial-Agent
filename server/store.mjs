import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ensureDefaultWorkspace } from "./editorial-workspaces.mjs";

const EMPTY = {
  version: 1,
  limits: { sourceUrlsPerArticle: 3, scrapesPerArticle: 3, searchesPerArticle: 5, inspectionsPerArticle: 5 },
  tasks: {},
  workspaces: [],
  editorialConversations: [],
  conversationAttachments: [],
  sources: [],
  researchSearches: [],
  researchScrapes: [],
  researchInspections: []
};

export class JsonStore {
  #tail = Promise.resolve();
  constructor(filePath) { this.filePath = filePath; }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const state = JSON.parse(raw);
      let changed = false;
      state.limits = { ...EMPTY.limits, ...(state.limits || {}) };
      if (!Array.isArray(state.workspaces)) { state.workspaces = []; changed = true; }
      const workspaceCount = state.workspaces.length;
      ensureDefaultWorkspace(state);
      if (state.workspaces.length !== workspaceCount) changed = true;
      state.researchScrapes ||= [];
      state.researchInspections ||= [];
      state.researchSearches ||= [];
      state.sources ||= [];
      state.tasks ||= {};
      if (!Array.isArray(state.editorialConversations)) { state.editorialConversations = []; changed = true; }
      if (!Array.isArray(state.conversationAttachments)) { state.conversationAttachments = []; changed = true; }
      for (const task of Object.values(state.tasks)) {
        task.usage ||= {};
        for (const operation of ["source", "scrape", "search", "inspect"]) {
          if (!Number.isSafeInteger(task.usage[operation]) || task.usage[operation] < 0) {
            task.usage[operation] = 0;
            changed = true;
          }
        }
        task.reservations ||= {};
      }
      if (changed || !raw.includes('"workspaces"') || !raw.includes('"scrapesPerArticle"') || !raw.includes('"researchScrapes"') || !raw.includes('"researchInspections"') || !raw.includes('"editorialConversations"') || !raw.includes('"conversationAttachments"')) await this.#write(state);
    }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      const initial = structuredClone(EMPTY);
      ensureDefaultWorkspace(initial);
      await this.#write(initial);
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
