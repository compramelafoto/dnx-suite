"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type UploadProgressState = {
  uploading: boolean;
  total: number;
  done: number;
  albumTitle?: string | null;
};

type UploadProgressContextValue = {
  state: UploadProgressState;
  startUpload: (total: number, albumTitle?: string | null) => void;
  updateProgress: (done: number) => void;
  finishUpload: () => void;
};

const initialState: UploadProgressState = {
  uploading: false,
  total: 0,
  done: 0,
  albumTitle: null,
};

const UploadProgressContext = createContext<UploadProgressContextValue | null>(null);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadProgressState>(initialState);

  const startUpload = useCallback((total: number, albumTitle?: string | null) => {
    setState({ uploading: true, total, done: 0, albumTitle });
  }, []);

  const updateProgress = useCallback((done: number) => {
    setState((prev) => ({ ...prev, done }));
  }, []);

  const finishUpload = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <UploadProgressContext.Provider
      value={{ state, startUpload, updateProgress, finishUpload }}
    >
      {children}
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress() {
  const ctx = useContext(UploadProgressContext);
  return ctx;
}
