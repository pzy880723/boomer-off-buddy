import { useEffect, useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScreenshotDropzone({
  onImage,
  preview,
}: {
  onImage: (dataUrl: string, mime: string) => void;
  preview?: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) readFile(f);
          e.preventDefault();
          return;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  });

  const readFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => onImage(String(r.result), f.type);
    r.readAsDataURL(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) readFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition",
        drag ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      {preview ? (
        <img src={preview} alt="screenshot" className="max-h-64 rounded shadow-sm" />
      ) : (
        <>
          <div className="rounded-full bg-muted p-3">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">拖拽截图到此处，或点击选择</p>
          <p className="text-xs text-muted-foreground">
            也可以直接 <kbd className="rounded border bg-background px-1.5">Ctrl/⌘ + V</kbd> 粘贴
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
        }}
      />
      {preview && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <Upload className="h-3 w-3" /> 重新选择
        </button>
      )}
    </div>
  );
}
