import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AttachmentBlockComponent } from './AttachmentBlockComponent.tsx';

export interface AttachmentAttrs {
    attachmentId: string;
    name: string;
    url: string;
    mimeType: string;
    size?: number;
    uploadedAt?: string;
}

export const AttachmentBlock = Node.create({
    name: 'attachmentBlock',

    group: 'block',

    atom: true,  // Non-editable atomic node

    draggable: true,  // Can be dragged and repositioned

    addAttributes() {
        return {
            attachmentId: {
                default: null,
                parseHTML: element => element.getAttribute('data-attachment-id'),
                renderHTML: attributes => ({
                    'data-attachment-id': attributes.attachmentId,
                }),
            },
            name: {
                default: '',
                parseHTML: element => element.getAttribute('data-name'),
                renderHTML: attributes => ({
                    'data-name': attributes.name,
                }),
            },
            url: {
                default: '',
                parseHTML: element => element.getAttribute('data-url'),
                renderHTML: attributes => ({
                    'data-url': attributes.url,
                }),
            },
            mimeType: {
                default: '',
                parseHTML: element => element.getAttribute('data-mime-type'),
                renderHTML: attributes => ({
                    'data-mime-type': attributes.mimeType,
                }),
            },
            size: {
                default: 0,
                parseHTML: element => parseInt(element.getAttribute('data-size') || '0'),
                renderHTML: attributes => ({
                    'data-size': attributes.size,
                }),
            },
            uploadedAt: {
                default: '',
                parseHTML: element => element.getAttribute('data-uploaded-at'),
                renderHTML: attributes => ({
                    'data-uploaded-at': attributes.uploadedAt,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-attachment-block]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const mimeType = HTMLAttributes["data-mime-type"] || "";
        const url = HTMLAttributes["data-url"] || "";
        const name = HTMLAttributes["data-name"] || "";
        const isImage = typeof mimeType === "string" && mimeType.includes("image");

        return [
            "div",
            mergeAttributes(HTMLAttributes, {
                "data-attachment-block": "true",
                class: "attachment-block-wrapper",
            }),
            isImage && url
                ? [
                      "figure",
                      {},
                      ["img", { src: url, alt: name }],
                      ["figcaption", {}, name],
                  ]
                : ["p", {}, name],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AttachmentBlockComponent);
    },
});
