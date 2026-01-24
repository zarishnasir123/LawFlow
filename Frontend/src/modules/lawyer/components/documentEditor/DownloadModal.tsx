import { X, FileText, Package } from "lucide-react";
import { useDocumentEditorStore } from "../../store/documentEditor.store";

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDocTitle: string;
    currentDocContent: string;
}

export default function DownloadModal({
    isOpen,
    onClose,
    currentDocTitle,
    currentDocContent,
}: DownloadModalProps) {
    const { documentContents, attachments } = useDocumentEditorStore();

    if (!isOpen) return null;

    const downloadCurrentDocument = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${currentDocTitle}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            h1 { font-size: 18pt; margin-bottom: 12pt; }
            h2 { font-size: 16pt; margin-bottom: 10pt; }
            p { margin-bottom: 8pt; }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            @media print {
              body { margin: 0; padding: 1in; }
            }
          </style>
        </head>
        <body>
          ${currentDocContent}
        </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const downloadEntireCaseFile = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const allDocs = Object.entries(documentContents)
            .map(
                ([id, content]) => `
      <div style="page-break-after: always;">
        <h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8pt;">
          ${id}
        </h1>
        ${content}
      </div>
    `
            )
            .join("");

        const attachmentsList =
            attachments.length > 0
                ? `
      <div style="page-break-before: always;">
        <h1 style="border-bottom: 2px solid #000; padding-bottom: 8pt;">
          ATTACHMENTS
        </h1>
        <ul style="list-style: decimal; padding-left: 24pt;">
          ${attachments
                    .map(
                        (att) => `
            <li style="margin-bottom: 6pt;">
              <strong>${att.name}</strong> (${(att.size / 1024).toFixed(1)} KB)
            </li>
          `
                    )
                    .join("")}
        </ul>
      </div>
    `
                : "";

        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Complete Case File - Recovery of Money</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            h1 { font-size: 18pt; margin-bottom: 12pt; }
            h2 { font-size: 16pt; margin-bottom: 10pt; }
            p { margin-bottom: 8pt; }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            ul { margin: 12pt 0; }
            li { margin-bottom: 6pt; }
            @media print {
              body { margin: 0; padding: 1in; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 24pt;">
            <h1 style="border: none; font-size: 24pt; margin-bottom: 6pt;">
              CASE FILE
            </h1>
            <p style="font-size: 14pt;">Recovery of Money</p>
          </div>
          ${allDocs}
          ${attachmentsList}
        </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Download Options
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-3">
                    <button
                        onClick={() => {
                            downloadCurrentDocument();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-semibold text-gray-900">Current Document</p>
                            <p className="text-sm text-gray-500">{currentDocTitle}</p>
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            downloadEntireCaseFile();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                    >
                        <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                            <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left flex-1">
                            <p className="font-semibold text-gray-900">Entire Case File</p>
                            <p className="text-sm text-gray-500">
                                All documents + attachments list
                            </p>
                        </div>
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                    <p className="text-xs text-gray-600">
                        💡 Tip: Use your browser's print dialog to save as PDF
                    </p>
                </div>
            </div>
        </div>
    );
}
