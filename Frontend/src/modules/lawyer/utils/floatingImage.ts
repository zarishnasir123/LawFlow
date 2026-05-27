// Floating image — Word's "In Front of Text" positioning model.
//
// The lawyer drags an image attachment from the sidebar onto a page.
// Instead of inserting it inline at the caret (which disrupts text
// flow), we attach it as an absolutely-positioned `<span>` inside the
// page's `<section class="docx">`. The image then floats over the
// content, can be dragged anywhere within the page, and resized from
// any of its four corners with aspect ratio preserved.
//
// Why vanilla DOM instead of React: the docx-preview library injects
// content directly into a host element it owns; we can't easily reach
// in with React refs without re-implementing docx-preview's rendering.
// Treating each floating image as an imperatively-managed DOM atom is
// the path of least resistance.

type Corner = "nw" | "ne" | "sw" | "se";

const SELECTED_CLASS = "lawflow-floating-image-selected";
const FLOATING_CLASS = "lawflow-floating-image";
const HANDLE_CLASS = "lawflow-resize-handle";
// Marker attribute the wrapper carries so we can find the rehydrated
// node by its source attachment after restoring from edited_html.
// Lives on the DOM element AND survives serialization → restore.
const ATTACHMENT_ID_ATTR = "data-attachment-id";
// Boolean flag set on a wrapper once its interactions are wired up.
// Prevents attachInteractions from running twice (which would double-
// fire onMouseDown when the user re-mounts the same node).
const INTERACTIONS_ATTR = "data-lawflow-interactions";

interface MountOptions {
  // Image bytes / URL to display.
  src: string;
  alt?: string;
  // Page element (section.docx) the image gets parented to.
  page: HTMLElement;
  // Position in pixels relative to the page (top-left of image).
  // Defaults: drop point coords supplied by caller.
  left: number;
  top: number;
  // Optional starting width — defaults to 240px, height auto-derived.
  width?: number;
  // Source attachment id — stamped on the wrapper so a second drag of
  // the same attachment can reuse the existing floating image instead
  // of duplicating it. Optional for cases where the caller doesn't
  // care about dedup (one-shot programmatic mounts).
  attachmentId?: string;
  // Fires after any drag / resize completes so the caller can persist
  // the new document state (HTML serialization, autosave, etc.).
  onChange?: () => void;
}

// Ensure the page can host absolutely-positioned children. docx-preview
// renders sections as `position: relative` by default in modern
// versions, but in case the CSS evaluates to `static` (older version,
// reset, etc.) we coerce it.
function ensurePagePositioning(page: HTMLElement) {
  const computed = window.getComputedStyle(page);
  if (computed.position === "static") {
    page.style.position = "relative";
  }
}

// Construct the floating-image DOM atom. Layout:
//
//   <span class="lawflow-floating-image" contenteditable="false"
//         style="position:absolute; left:Xpx; top:Ypx; width:Wpx; height:Hpx">
//     <img src="..." />
//     <div class="lawflow-resize-handle nw"></div>
//     <div class="lawflow-resize-handle ne"></div>
//     <div class="lawflow-resize-handle sw"></div>
//     <div class="lawflow-resize-handle se"></div>
//   </span>
//
// The wrapper sits ABOVE text (z-index 10). Handles are positioned at
// the corners and only become visible on hover / selection (CSS in
// DocxPreviewSurface).
function buildFloatingImage(opts: MountOptions): HTMLSpanElement {
  const wrapper = document.createElement("span");
  wrapper.className = FLOATING_CLASS;
  wrapper.setAttribute("contenteditable", "false");
  if (opts.attachmentId) {
    wrapper.setAttribute(ATTACHMENT_ID_ATTR, opts.attachmentId);
  }
  wrapper.style.position = "absolute";
  wrapper.style.left = `${opts.left}px`;
  wrapper.style.top = `${opts.top}px`;
  wrapper.style.width = `${opts.width ?? 240}px`;
  wrapper.style.height = "auto";
  wrapper.style.zIndex = "10";
  wrapper.style.userSelect = "none";
  wrapper.style.cursor = "move";
  // Prevent the browser from interpreting double-click / triple-click as
  // text selection on the image area.
  wrapper.style.touchAction = "none";

  const img = document.createElement("img");
  img.src = opts.src;
  img.alt = opts.alt ?? "Image";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.style.display = "block";
  // Pointer events go to the wrapper, not the img — keeps the drag /
  // resize event targets predictable. Also disable the browser's native
  // image drag (which would otherwise compete with our drag handler).
  img.style.pointerEvents = "none";
  img.draggable = false;
  wrapper.appendChild(img);

  // Four corner resize handles. Direction encoded in the data-corner
  // attribute and read back in the mousedown handler.
  (["nw", "ne", "sw", "se"] as Corner[]).forEach((corner) => {
    const handle = document.createElement("div");
    handle.className = `${HANDLE_CLASS} ${HANDLE_CLASS}-${corner}`;
    handle.dataset.corner = corner;
    wrapper.appendChild(handle);
  });

  return wrapper;
}

// Attach mouse-based drag + resize behaviour. Listeners on the wrapper
// detect press, then global listeners on `document` track the rest of
// the gesture so the lawyer can move the mouse outside the image
// without losing the drag (a common gotcha if you put the listeners on
// the wrapper itself).
function attachInteractions(
  wrapper: HTMLSpanElement,
  onChange?: () => void
) {
  // Idempotency guard. Calling this twice on the same node would
  // double-fire the drag handler (each mousedown would attach two
  // sets of global mousemove listeners) and cause images to jump.
  // The marker survives within the DOM only — serialized HTML loses
  // event listeners, so the flag also needs clearing on rehydrate.
  if (wrapper.getAttribute(INTERACTIONS_ATTR) === "true") return;
  wrapper.setAttribute(INTERACTIONS_ATTR, "true");

  let mode: null | "drag" | `resize-${Corner}` = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let startWidth = 0;
  let startHeight = 0;
  let aspect = 1;

  const onMouseMove = (e: MouseEvent) => {
    if (!mode) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === "drag") {
      wrapper.style.left = `${startLeft + dx}px`;
      wrapper.style.top = `${startTop + dy}px`;
      return;
    }

    // Resize: figure out the new width/height/position based on which
    // corner is being dragged. Aspect ratio is locked.
    let newWidth = startWidth;
    let newLeft = startLeft;
    let newTop = startTop;

    // For E/W corners we use horizontal delta as the driver, for N/W
    // corners we invert (drag left = grow).
    const isEast = mode === "resize-ne" || mode === "resize-se";
    const isNorth = mode === "resize-nw" || mode === "resize-ne";

    const widthDelta = isEast ? dx : -dx;
    newWidth = Math.max(40, startWidth + widthDelta);
    const newHeight = newWidth / aspect;

    if (!isEast) {
      newLeft = startLeft + (startWidth - newWidth);
    }
    if (isNorth) {
      newTop = startTop + (startHeight - newHeight);
    }

    wrapper.style.width = `${newWidth}px`;
    wrapper.style.height = `${newHeight}px`;
    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  };

  const onMouseUp = () => {
    if (!mode) return;
    mode = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    onChange?.();
  };

  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const isHandle = target.classList.contains(HANDLE_CLASS);
    if (isHandle) {
      mode = `resize-${target.dataset.corner as Corner}`;
    } else {
      mode = "drag";
    }

    // Select this image visually (CSS in DocxPreviewSurface lights up
    // the outline + handles). Clear other selections so only one image
    // is "active" at a time.
    document
      .querySelectorAll(`.${SELECTED_CLASS}`)
      .forEach((el) => el.classList.remove(SELECTED_CLASS));
    wrapper.classList.add(SELECTED_CLASS);

    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(wrapper.style.left) || 0;
    startTop = parseFloat(wrapper.style.top) || 0;
    startWidth = wrapper.offsetWidth;
    startHeight = wrapper.offsetHeight;
    aspect = startHeight === 0 ? 1 : startWidth / startHeight;

    e.preventDefault();
    e.stopPropagation();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  wrapper.addEventListener("mousedown", onMouseDown);
}

// Global click handler — clicking outside any floating image clears
// the selection. Installed once per host element.
function installSelectionClearer(host: HTMLElement) {
  if ((host as HTMLElement & { __lawflowSelectionInstalled?: boolean })
        .__lawflowSelectionInstalled) {
    return;
  }
  (host as HTMLElement & { __lawflowSelectionInstalled?: boolean })
    .__lawflowSelectionInstalled = true;

  host.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`.${FLOATING_CLASS}`)) {
      host
        .querySelectorAll(`.${SELECTED_CLASS}`)
        .forEach((el) => el.classList.remove(SELECTED_CLASS));
    }
  });

  // Delete / Backspace removes the currently-selected floating image.
  // Listener lives on `document` (not `host`) because after the lawyer
  // mouse-downs an image we preventDefault() to keep their mouse from
  // shifting focus — meaning the keyboard event would otherwise fire on
  // <body> and never bubble to host. Document always sees it. We still
  // skip when the user is typing in a text input/textarea so a stray
  // backspace in a form field doesn't blow away an image.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }
    const selected = host.querySelector(`.${FLOATING_CLASS}.${SELECTED_CLASS}`);
    if (!selected) return;
    e.preventDefault();
    selected.remove();
  });
}

// Align the currently-selected floating image horizontally within its
// parent page. Returns true if an image was found and aligned (so the
// caller knows to skip the normal contenteditable alignment command),
// false if nothing was selected.
//
// Modes:
//   - "left"    → image hugs the left edge of the page's content box
//   - "center"  → centered horizontally
//   - "right"   → image hugs the right edge of the page's content box
//   - "justify" → image stretches to fill the full content width;
//                 height scales by aspect ratio so it doesn't squash
//
// The page element is the <section.docx> the image is parented to.
// docx-preview sets per-page padding via inline styles, so we read the
// computed padding to respect the printable area rather than going
// edge-to-edge.
export type ImageAlignMode = "left" | "center" | "right" | "justify";

export function alignSelectedImage(mode: ImageAlignMode): boolean {
  const selected = document.querySelector<HTMLElement>(
    `.${FLOATING_CLASS}.${SELECTED_CLASS}`
  );
  if (!selected) return false;

  const page = selected.parentElement;
  if (!page) return false;

  const cs = window.getComputedStyle(page);
  const padLeft = parseFloat(cs.paddingLeft) || 0;
  const padRight = parseFloat(cs.paddingRight) || 0;
  const contentLeft = padLeft;
  const contentRight = page.clientWidth - padRight;
  const contentWidth = contentRight - contentLeft;

  const imgWidth = selected.offsetWidth;
  const imgHeight = selected.offsetHeight;
  const aspect = imgHeight === 0 ? 1 : imgWidth / imgHeight;

  switch (mode) {
    case "left":
      selected.style.left = `${contentLeft}px`;
      break;
    case "center":
      selected.style.left = `${contentLeft + (contentWidth - imgWidth) / 2}px`;
      break;
    case "right":
      selected.style.left = `${contentRight - imgWidth}px`;
      break;
    case "justify": {
      // Stretch to full content width and rescale height by aspect.
      const newHeight = contentWidth / aspect;
      selected.style.left = `${contentLeft}px`;
      selected.style.width = `${contentWidth}px`;
      selected.style.height = `${newHeight}px`;
      break;
    }
  }
  return true;
}

// Public entry point. Creates the floating image, parents it to the
// page, wires interactions, and returns the wrapper element so callers
// can hold a ref if they need to.
//
// If an attachmentId is supplied AND a floating image with the same
// id already exists anywhere in the docx host, we move that existing
// wrapper to the new page + position instead of creating a duplicate.
// This is the "drag the same attachment twice" case: lawyer expects
// the image to relocate, not multiply.
export function mountFloatingImage(opts: MountOptions): HTMLSpanElement {
  ensurePagePositioning(opts.page);

  const host = opts.page.closest(".docx-preview-host") as HTMLElement | null;

  // Dedup path — same attachment already placed somewhere? Move it.
  if (opts.attachmentId && host) {
    const existing = host.querySelector<HTMLSpanElement>(
      `.${FLOATING_CLASS}[${ATTACHMENT_ID_ATTR}="${CSS.escape(opts.attachmentId)}"]`
    );
    if (existing) {
      // Re-parent to the new page (handles cross-page drags) and
      // reset position. Width/height are preserved — the user already
      // chose them; a relocate shouldn't reset their sizing.
      if (existing.parentElement !== opts.page) {
        opts.page.appendChild(existing);
      }
      existing.style.left = `${opts.left}px`;
      existing.style.top = `${opts.top}px`;
      // Interactions are already wired (idempotent guard makes a
      // re-call safe anyway), but the onChange callback may have
      // changed across renders. Re-attach defensively — the guard
      // will short-circuit if the same closure was already bound.
      attachInteractions(existing, opts.onChange);
      if (host) installSelectionClearer(host);
      opts.onChange?.();
      return existing;
    }
  }

  const wrapper = buildFloatingImage(opts);
  opts.page.appendChild(wrapper);
  attachInteractions(wrapper, opts.onChange);

  // Click-outside-to-deselect needs to live on the docx-preview host so
  // every floating image on every page shares one listener. We climb up
  // from the page (.docx-wrapper > section.docx → .docx-wrapper → host).
  if (host) installSelectionClearer(host);

  return wrapper;
}

// Re-wire drag / resize interactions on floating images that came
// back from a saved HTML snapshot. The DOM nodes survive
// serialization but their event listeners don't — without this call
// the images render in the right place but feel "stuck" (no cursor
// move, no resize handles light up, no Delete/Backspace removal).
//
// Safe to call multiple times; attachInteractions is idempotent via
// the data-lawflow-interactions marker. The marker doesn't survive
// HTML serialization, so we explicitly clear it on the rehydrate
// path to force a fresh wire-up.
export function rehydrateFloatingImages(
  host: HTMLElement,
  onChange?: () => void
) {
  const wrappers = host.querySelectorAll<HTMLSpanElement>(
    `.${FLOATING_CLASS}`
  );
  wrappers.forEach((wrapper) => {
    // Strip any stale interactions marker so attachInteractions
    // doesn't short-circuit (the listeners themselves were lost in
    // the HTML round-trip; the attribute alone is meaningless).
    wrapper.removeAttribute(INTERACTIONS_ATTR);

    // Re-arm the inner img guards. innerHTML / cloneNode preserves
    // these attributes for us, but buildFloatingImage also sets
    // img.pointerEvents and img.draggable imperatively — re-asserting
    // is cheap insurance against partial restores.
    const img = wrapper.querySelector("img");
    if (img) {
      img.draggable = false;
      img.style.pointerEvents = "none";
    }

    attachInteractions(wrapper, onChange);

    // Pages need position:relative for the absolute children to land
    // in the right coordinate space. docx-preview already sets it,
    // but the saved snapshot path doesn't go through renderAsync, so
    // we coerce defensively.
    const page = wrapper.parentElement;
    if (page) ensurePagePositioning(page as HTMLElement);
  });

  installSelectionClearer(host);
}
