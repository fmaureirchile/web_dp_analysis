export type PassiveSinglePageCrawlErrorCode =
  | "authorization_scope_rejected"
  | "invalid_entry_url"
  | "http_timeout"
  | "http_non_html_content"
  | "http_fetch_failed"
  | "response_size_limit_exceeded"
  | "internal_error";

export interface StartPassiveSinglePageCrawlDto {
  executionId: string;
  entryUrl: string;
  correlationId?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface PassiveSinglePageCrawlSuccessDto {
  executionId: string;
  entryUrl: string;
  statusHttp: number;
  title?: string;
  evidenceId: string;
  fetchedAt: string;
  contentType?: string;
  contentLength?: number;
}

export interface PassiveSinglePageCrawlErrorDto {
  executionId: string;
  entryUrl: string;
  errorCode: PassiveSinglePageCrawlErrorCode;
  message: string;
}

export interface PassiveSinglePageCrawlResultDto {
  ok: boolean;
  data?: PassiveSinglePageCrawlSuccessDto;
  error?: PassiveSinglePageCrawlErrorDto;
}

export type OperationalExecutionStateFilter =
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED";

export interface OperationalExecutionItemDto {
  executionId: string;
  state: OperationalExecutionStateFilter;
  entryUrl?: string;
  updatedAt: string;
  resultAvailable: boolean;
  statusHttp?: number;
  title?: string;
  evidenceId?: string;
  errorCode?: PassiveSinglePageCrawlErrorCode;
}

export interface OperationalExecutionListDto {
  states: OperationalExecutionStateFilter[];
  from?: string;
  to?: string;
  limit: number;
  items: OperationalExecutionItemDto[];
}
