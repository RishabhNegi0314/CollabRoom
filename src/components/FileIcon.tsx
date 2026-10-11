import React from "react";
import { 
  FileCode, FileJson, FileText, Settings, 
  Folder, FolderOpen, Coffee, Binary, Terminal 
} from "lucide-react";

interface FileIconProps {
  fileName: string;
  className?: string;
}

export default function FileIcon({ fileName, className = "w-4 h-4" }: FileIconProps) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "html":
    case "htm":
      return <FileCode className={`${className} text-orange-500 fill-orange-500/10`} />;
    case "css":
      return <FileCode className={`${className} text-sky-400 fill-sky-400/10`} />;
    case "js":
    case "jsx":
      return <FileCode className={`${className} text-yellow-400 fill-yellow-400/5`} />;
    case "ts":
    case "tsx":
      return <FileCode className={`${className} text-blue-500 fill-blue-500/10`} />;
    case "java":
    case "class":
    case "jar":
      return <Coffee className={`${className} text-amber-500 fill-amber-500/5`} />;
    case "py":
    case "pyc":
    case "pyd":
      return <Binary className={`${className} text-teal-400`} />;
    case "json":
    case "lock":
      return <FileJson className={`${className} text-yellow-300 fill-yellow-300/5`} />;
    case "env":
    case "config":
    case "properties":
    case "xml":
    case "yaml":
    case "yml":
    case "toml":
      return <Settings className={`${className} text-zinc-400`} />;
    case "md":
    case "txt":
    case "readme":
      return <FileText className={`${className} text-zinc-300`} />;
    default:
      return <FileCode className={`${className} text-indigo-400`} />;
  }
}

interface FolderIconProps {
  isOpen: boolean;
  className?: string;
}

export function FolderIcon({ isOpen, className = "w-4 h-4" }: FolderIconProps) {
  return isOpen ? (
    <FolderOpen className={`${className} text-indigo-400 transition-transform duration-200 transform scale-105`} />
  ) : (
    <Folder className={`${className} text-indigo-500 transition-transform duration-200`} />
  );
}
