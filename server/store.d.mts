export class JsonStore {
  constructor(filePath: string);
  init(): Promise<void>;
  read(): Promise<unknown>;
  transact<T>(mutator: (state: unknown) => T | Promise<T>): Promise<T>;
}
