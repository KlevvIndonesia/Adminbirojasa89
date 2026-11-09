import { useCallback, useRef, useState } from "react";
import { ClassifiedActionError, classifyActionError } from "../utils/actionErrorClassifier";

export interface ActionStateEntry {
  loading: boolean;
  error: ClassifiedActionError | null;
}

export type ActionStateMap = Record<string, ActionStateEntry>;

/**
 * Pure state-transition helpers exported for deterministic unit testing
 * as well as internal hook state management.
 */
export function reduceActionStart(state: ActionStateMap, key: string): ActionStateMap {
  return {
    ...state,
    [key]: { loading: true, error: null },
  };
}

export function reduceActionSuccess(
  state: ActionStateMap,
  key: string,
  clearPrefixes: string[] = []
): ActionStateMap {
  const next: ActionStateMap = { ...state };
  if (next[key]) {
    next[key] = { loading: false, error: null };
  }
  for (const prefix of clearPrefixes) {
    for (const k of Object.keys(next)) {
      if (k.startsWith(prefix)) {
        next[k] = { ...next[k], error: null };
      }
    }
  }
  return next;
}

export function reduceActionFailure(
  state: ActionStateMap,
  key: string,
  error: ClassifiedActionError
): ActionStateMap {
  return {
    ...state,
    [key]: { loading: false, error },
  };
}

export interface RunActionOptions<T> {
  entityLabel?: string;
  actionLabel?: string;
  clearPrefixesOnSuccess?: string[];
  onSuccess?: (data: T) => void;
  onError?: (error: ClassifiedActionError) => void;
}

export type RunActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClassifiedActionError; skippedDuplicate?: boolean };

/**
 * Isolated per-button action state manager.
 * Guarantees each button/action key tracks its own loading spinner, duplicate-submission lock,
 * and inline error message without leaking into neighboring buttons or resetting form state.
 */
export function useActionFeedback() {
  const [actionStates, setActionStates] = useState<ActionStateMap>({});
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const isLoading = useCallback(
    (key: string): boolean => Boolean(actionStates[key]?.loading),
    [actionStates]
  );

  const isAnyLoading = useCallback(
    (prefix?: string): boolean => {
      for (const [k, entry] of Object.entries(actionStates)) {
        if (!entry?.loading) continue;
        if (!prefix || k.startsWith(prefix)) return true;
      }
      return false;
    },
    [actionStates]
  );

  const getError = useCallback(
    (key: string): ClassifiedActionError | null => actionStates[key]?.error || null,
    [actionStates]
  );

  const setError = useCallback(
    (key: string, err: unknown, context?: { entityLabel?: string; actionLabel?: string }): ClassifiedActionError => {
      const classified = classifyActionError(err, context);
      setActionStates((prev) => reduceActionFailure(prev, key, classified));
      return classified;
    },
    []
  );

  const clearError = useCallback((key: string): void => {
    setActionStates((prev) => {
      if (!prev[key]?.error) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], error: null },
      };
    });
  }, []);

  const clearByPrefix = useCallback((prefix: string): void => {
    setActionStates((prev) => {
      let changed = false;
      const next: ActionStateMap = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix) && next[k]?.error) {
          next[k] = { ...next[k], error: null };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearAll = useCallback((): void => {
    setActionStates({});
  }, []);

  const runAction = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      options?: RunActionOptions<T>
    ): Promise<RunActionResult<T>> => {
      if (inFlightKeysRef.current.has(key)) {
        const dupErr = classifyActionError({
          statusCode: 409,
          code: "CONCURRENT_GUARD",
          message: "Permintaan sebelumnya masih diproses. Harap tunggu sebentar.",
        });
        return { ok: false, error: dupErr, skippedDuplicate: true };
      }

      inFlightKeysRef.current.add(key);
      setActionStates((prev) => reduceActionStart(prev, key));

      try {
        const data = await fn();
        setActionStates((prev) =>
          reduceActionSuccess(prev, key, options?.clearPrefixesOnSuccess || [])
        );
        options?.onSuccess?.(data);
        return { ok: true, data };
      } catch (err) {
        const classified = classifyActionError(err, {
          entityLabel: options?.entityLabel,
          actionLabel: options?.actionLabel,
        });
        setActionStates((prev) => reduceActionFailure(prev, key, classified));
        options?.onError?.(classified);
        return { ok: false, error: classified };
      } finally {
        inFlightKeysRef.current.delete(key);
      }
    },
    []
  );

  return {
    actionStates,
    isLoading,
    isAnyLoading,
    getError,
    setError,
    clearError,
    clearByPrefix,
    clearAll,
    runAction,
  };
}
