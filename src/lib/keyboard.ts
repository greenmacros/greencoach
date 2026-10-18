import { useEffect, useState } from "react";

const isTextField = (el: Element | null) =>
  !!el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "range", "file"].includes((el as HTMLInputElement).type)));

/**
 * True while the on-screen keyboard is up (phones). Bottom bars hide meanwhile, like native apps.
 * After the keyboard closes, iOS home-screen apps can leave fixed bars where they were while it was open
 * (mid-screen) until the page moves; a no-op scroll makes it recompute the layout.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const check = () => setOpen(!!vv && vv.height < window.innerHeight * 0.8 && isTextField(document.activeElement));
    const settle = () => setTimeout(() => {
      check();
      if (!isTextField(document.activeElement)) window.scrollTo(window.scrollX, window.scrollY + 1), window.scrollTo(window.scrollX, window.scrollY - 1);
    }, 120);
    vv?.addEventListener("resize", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", settle);
    return () => {
      vv?.removeEventListener("resize", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", settle);
    };
  }, []);
  return open;
}
