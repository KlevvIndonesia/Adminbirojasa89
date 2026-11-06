declare module "node:sqlite" {
  type SQLQueryParam = string | number | bigint | boolean | null | Uint8Array | undefined;

  interface StatementSync {
    get<T = any>(...params: SQLQueryParam[]): T | undefined;
    all<T = any>(...params: SQLQueryParam[]): T[];
  }
}


