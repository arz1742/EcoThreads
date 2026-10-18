import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{ duration: 4000 }}
      {...props}
    />
  );
}
