declare module "pg" {
  import type { EventEmitter } from "node:events";

  export interface QueryConfig {
    text: string;
    values?: Array<unknown>;
  }

  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R extends QueryResultRow = any> {
    command: string;
    rowCount: number;
    rows: R[];
    fields: Array<{ name: string }>; 
  }

  export type ClientConfig = {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
    connectionTimeoutMillis?: number;
  };

  export type PoolConfig = ClientConfig;

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query<R extends QueryResultRow = any>(queryTextOrConfig: string | QueryConfig, values?: Array<unknown>): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }

  export class Pool extends EventEmitter {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R extends QueryResultRow = any>(queryTextOrConfig: string | QueryConfig, values?: Array<unknown>): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }

  export class PoolClient extends Client {
    release(error?: Error | boolean): void;
  }
}
