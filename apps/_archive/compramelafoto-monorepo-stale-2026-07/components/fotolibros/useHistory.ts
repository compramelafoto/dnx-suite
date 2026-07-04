import { useCallback, useRef, useState } from "react";

type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function useHistory<T>(initialState: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });
  const isRestoringRef = useRef(false);

  const setPresent = useCallback((next: T) => {
    setState((prev) => ({
      past: [...prev.past, prev.present],
      present: next,
      future: [],
    }));
  }, []);

  const replacePresent = useCallback((next: T) => {
    setState((prev) => ({
      past: prev.past,
      present: next,
      future: prev.future,
    }));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const markRestoring = useCallback((value: boolean) => {
    isRestoringRef.current = value;
  }, []);

  return {
    state,
    setPresent,
    replacePresent,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    isRestoringRef,
    markRestoring,
  };
}
