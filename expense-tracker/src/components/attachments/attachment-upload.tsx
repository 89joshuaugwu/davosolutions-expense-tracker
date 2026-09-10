"use client";

import { useState } from "react";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";

export interface AttachmentItem {
  id: string; // The internal attachment ID from finalize
  file: File;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface AttachmentUploadProps {
  attachments: AttachmentItem[];
  onChange: (value: AttachmentItem[] | ((prev: AttachmentItem[]) => AttachmentItem[])) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function AttachmentUpload({ attachments, onChange, maxFiles = 5, disabled = false }: AttachmentUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    
    // Check max files limit
    if (attachments.length + newFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} attachments.`);
      return;
    }

    const items: AttachmentItem[] = newFiles.map((file) => ({
      id: crypto.randomUUID(), // temporary ID during upload
      file,
      status: "uploading",
    }));

    const updated = [...attachments, ...items];
    onChange(updated);

    // Upload each file
    for (const item of items) {
      await uploadFile(item);
    }
  };

  const uploadFile = async (item: AttachmentItem) => {
    try {
      // 1. Get Intent
      const intentRes = await fetch("/api/attachments/intent", { method: "POST" });
      if (!intentRes.ok) throw new Error("Could not initialize upload");
      const intent = await intentRes.json();

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("api_key", intent.apiKey);
      formData.append("timestamp", intent.timestamp);
      formData.append("upload_preset", intent.uploadPreset);
      formData.append("type", intent.type);
      formData.append("signature", intent.signature);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${intent.cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();

      // 3. Finalize on our server
      const finalizeRes = await fetch("/api/attachments/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: uploadData.public_id,
          version: uploadData.version,
          signature: uploadData.signature,
          resource_type: uploadData.resource_type,
          bytes: uploadData.bytes,
          original_filename: uploadData.original_filename,
          format: uploadData.format,
        }),
      });

      if (!finalizeRes.ok) {
        const errData = await finalizeRes.json();
        throw new Error(errData.error || "Finalize failed");
      }
      
      const finalizeData = await finalizeRes.json();

      // Update item with success and real ID
      onChange((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, id: finalizeData.attachmentId, status: "success" } : a))
      );
    } catch (error) {
      console.error("Upload error:", error);
      onChange((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: "error", error: error instanceof Error ? error.message : "Upload error" } : a
        )
      );
    }
  };

  const removeAttachment = (idToRemove: string) => {
    onChange(attachments.filter((a) => a.id !== idToRemove));
  };

  return (
    <div className="attachment-upload">
      {attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((item) => (
            <li key={item.id} className={`attachment-item ${item.status}`}>
              <div className="attachment-info">
                {item.file.type.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span className="filename" title={item.file.name}>{item.file.name}</span>
                <span className="filesize">({Math.round(item.file.size / 1024)} KB)</span>
              </div>
              
              <div className="attachment-actions">
                {item.status === "uploading" && <Loader2 size={16} className="spin" />}
                {item.status === "error" && <span className="error-text" title={item.error}>Failed</span>}
                {!disabled && (
                  <button type="button" onClick={() => removeAttachment(item.id)} aria-label="Remove attachment">
                    <X size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {attachments.length < maxFiles && !disabled && (
        <div
          className={`dropzone ${isDragActive ? "active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            id="attachment-input"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            disabled={disabled}
            className="sr-only"
            accept="image/*,application/pdf"
          />
          <label htmlFor="attachment-input" className="dropzone-label">
            <Paperclip size={20} />
            <span>Click to upload or drag files here</span>
          </label>
        </div>
      )}
    </div>
  );
}
