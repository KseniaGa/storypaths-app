// Returns cleanup so only the currently focused editor handles interruptions.
export function protectBrowserEdits(
  browser: Pick<Window, "addEventListener" | "removeEventListener">,
  page: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">,
  flush: () => boolean,
) {
  const hide = () => { flush(); };
  const visibility = () => { if (page.visibilityState === "hidden") hide(); };
  const unload = (event: BeforeUnloadEvent) => {
    if (!flush()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  page.addEventListener("visibilitychange", visibility);
  browser.addEventListener("pagehide", hide);
  browser.addEventListener("beforeunload", unload);
  return () => {
    page.removeEventListener("visibilitychange", visibility);
    browser.removeEventListener("pagehide", hide);
    browser.removeEventListener("beforeunload", unload);
  };
}

export function protectNativeEdits(
  subscribe: (listener: (state: string) => void) => { remove: () => void },
  flush: () => boolean,
) {
  const subscription = subscribe((state) => {
    if (state === "inactive" || state === "background") flush();
  });
  return () => subscription.remove();
}
