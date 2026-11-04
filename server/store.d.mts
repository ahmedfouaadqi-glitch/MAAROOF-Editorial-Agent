export class JsonStore {
  constructor(filePath: string);
  init(): Promise<void>;
  read(): Promise<any>;
  transact<T>(mutator: (state: any) => T | Promise<T>): Promise<T>;
}
