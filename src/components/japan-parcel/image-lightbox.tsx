import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * 点击缩略图后弹窗放大查看。
 * 用作 <img> 的近似替代：传 src/alt/className，渲染缩略图，点击打开 lightbox。
 */
export function ClickableThumb({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt={alt ?? ""}
        loading={loading}
        decoding="async"
        className={`${className ?? ""} cursor-zoom-in`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[92vw] border-none bg-transparent p-0 shadow-none sm:max-w-[92vw]"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={alt ?? ""}
            className="mx-auto max-h-[90vh] w-auto max-w-full rounded object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
