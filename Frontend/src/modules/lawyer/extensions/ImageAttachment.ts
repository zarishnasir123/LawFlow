import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageAttachmentComponent } from "./ImageAttachmentComponent";

export interface ImageAttachmentAttrs {
  attachmentId: string;
  name: string;
  url: string;
  mimeType: string;
  size?: number;
  uploadedAt?: string;
}

export const ImageAttachment = Node.create({
  name: "imageAttachment",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name"),
        renderHTML: (attributes) => ({
          "data-name": attributes.name,
        }),
      },
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url"),
        renderHTML: (attributes) => ({
          "data-url": attributes.url,
        }),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type"),
        renderHTML: (attributes) => ({
          "data-mime-type": attributes.mimeType,
        }),
      },
      size: {
        default: 0,
        parseHTML: (element) => parseInt(element.getAttribute("data-size") || "0", 10),
        renderHTML: (attributes) => ({
          "data-size": attributes.size,
        }),
      },
      uploadedAt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-uploaded-at"),
        renderHTML: (attributes) => ({
          "data-uploaded-at": attributes.uploadedAt,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-image-attachment]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const name = HTMLAttributes["data-name"] || "";
    const url = HTMLAttributes["data-url"] || "";

    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-image-attachment": "true",
        class: "image-attachment-wrapper",
      }),
      ["img", { src: url, alt: name }],
      ["figcaption", {}, name],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageAttachmentComponent);
  },
});
