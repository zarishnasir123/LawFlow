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
export function mountFloatingImage(opts: MountOptions): HTMLSpanElement {
  ensurePagePositioning(opts.page);

  const wrapper = buildFloatingImage(opts);
  opts.page.appendChild(wrapper);
  attachInteractions(wrapper, opts.onChange);

  // Click-outside-to-deselect needs to live on the docx-preview host so
  // every floating image on every page shares one listener. We climb up
  // from the page (.docx-wrapper > section.docx → .docx-wrapper → host).
  const host = opts.page.closest(".docx-preview-host") as HTMLElement | null;
  if (host) installSelectionClearer(host);

  return wrapper;
}
