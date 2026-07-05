"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { AlbumUploadSelection } from "@/components/dashboard/albums/AlbumUploadZone";

export type AlbumUploadTriggerHandle = {
  pickFiles: () => void;
  pickFolder: () => void;
};

export type AlbumUploadTriggerProps = {
  onFilesSelected: (selection: AlbumUploadSelection) => void;
  disabled?: boolean;
};

const AlbumUploadTrigger = forwardRef<AlbumUploadTriggerHandle, AlbumUploadTriggerProps>(
  function AlbumUploadTrigger({ onFilesSelected, disabled }, ref) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      pickFiles: () => {
        if (!disabled) fileInputRef.current?.click();
      },
      pickFolder: () => {
        if (!disabled) folderInputRef.current?.click();
      },
    }));

    const emitFiles = (files: FileList, isDirectoryUpload: boolean) => {
      if (files.length > 0) {
        onFilesSelected({ files, isDirectoryUpload });
      }
    };

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) emitFiles(files, false);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory no está en los tipos estándar de React
          webkitdirectory=""
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) emitFiles(files, true);
            e.target.value = "";
          }}
        />
      </>
    );
  }
);

export default AlbumUploadTrigger;
