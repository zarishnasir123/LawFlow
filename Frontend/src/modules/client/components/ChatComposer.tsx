import { Send, Paperclip, Mic, X } from "lucide-react";
import { useState, useRef } from "react";

interface ChatComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
  onFileUpload?: (files: File[]) => void;
}

export default function ChatComposer({ disabled, onSend, onFileUpload }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = text.trim();
    if (!value && selectedFiles.length === 0) return;
    
    if (value) {
      onSend(value);
      setText("");
    }
    
    if (selectedFiles.length > 0 && onFileUpload) {
      onFileUpload(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white px-5 sm:px-8 py-3 border-t-2 border-gray-300">
      {/* File Preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white px-3 py-2 rounded-lg text-sm border-2 border-gray-300"
            >
              <span className="truncate text-gray-700 font-medium">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-500 hover:text-red-500 transition"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-gray-600 hover:text-[#01411C] transition flex-shrink-0 hover:bg-gray-100 p-2 rounded-lg"
          title="Attach file"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.zip"
        />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#01411C]/30 focus:border-[#01411C] bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={disabled}
        />

        <button
          type="button"
          className="text-gray-600 hover:text-[#01411C] transition flex-shrink-0 hover:bg-gray-100 p-2 rounded-lg"
          title="Send voice message"
          disabled={disabled}
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={disabled || (!text.trim() && selectedFiles.length === 0)}
          className="rounded-lg bg-[#01411C] text-white p-2.5 hover:bg-green-900 transition disabled:opacity-50 flex-shrink-0 shadow-sm hover:shadow-md"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
