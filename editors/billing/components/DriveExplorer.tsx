import type { EditorProps } from "document-model";
import { useState, useEffect, useRef } from "react";
import { ToastRenderer } from "./ToastRenderer.js";
import { DriveContents } from "./DriveContents.js";
import { FolderTree, type SelectedFolderInfo } from "./FolderTree.js";
import { FolderTreeErrorBoundary } from "./FolderTreeErrorBoundary.js";
import { DocumentDropZone } from "./DocumentDropZone.js";

/**
 * Main drive explorer for the Billing app.
 *
 * Ported from contributor-billing minus the operational-hub-profile creation
 * gate (that document model is not part of this package) and the Accounts /
 * Reporting / Subscriptions sections.
 */
export function DriveExplorer({ children }: EditorProps) {
  // if a document is selected then its editor will be passed as children
  const showDocumentEditor = !!children;

  // Track which folder is selected for content routing
  const [selectedFolder, setSelectedFolder] =
    useState<SelectedFolderInfo | null>(null);

  // Track active node in sidebar for visual selection sync.
  // Empty string means no selection (overview page).
  const [activeNodeId, setActiveNodeId] = useState<string>("");

  // Remember the last folder before opening a document so we can restore it when closing
  const lastFolderRef = useRef<SelectedFolderInfo | null>(null);
  const prevShowDocumentEditorRef = useRef(showDocumentEditor);

  useEffect(() => {
    const wasShowingDocument = prevShowDocumentEditorRef.current;
    const isShowingDocument = showDocumentEditor;

    if (isShowingDocument && !wasShowingDocument) {
      // Transitioning TO document editor - save current folder
      lastFolderRef.current = selectedFolder;
    } else if (!isShowingDocument && wasShowingDocument) {
      // Transitioning FROM document editor - restore last folder
      if (lastFolderRef.current) {
        setSelectedFolder(lastFolderRef.current);
        if (lastFolderRef.current.folderId) {
          setActiveNodeId(lastFolderRef.current.folderId);
        }
      }
    }

    prevShowDocumentEditorRef.current = isShowingDocument;
  }, [showDocumentEditor, selectedFolder]);

  const handleFolderSelect = (folderInfo: SelectedFolderInfo | null) => {
    setSelectedFolder(folderInfo);
    // Only update sidebar selection when explicitly selecting a folder with a
    // valid ID. When folderInfo is null (opening a document) the sidebar keeps
    // its current selection.
    if (folderInfo && folderInfo.folderId) {
      setActiveNodeId(folderInfo.folderId);
    }
  };

  return (
    <div className="ph-drive-explorer-shell flex h-full w-full overflow-hidden">
      {/* Sidebar - resizable, managed by Sidebar component */}
      <FolderTreeErrorBoundary>
        <FolderTree
          onFolderSelect={handleFolderSelect}
          activeNodeId={activeNodeId}
          onActiveNodeIdChange={setActiveNodeId}
        />
      </FolderTreeErrorBoundary>

      <ToastRenderer />

      {/* Main content area - takes remaining space, scrollable */}
      <DocumentDropZone className="flex-1 min-w-0 h-full overflow-x-hidden overflow-y-auto">
        {showDocumentEditor ? (
          /* Document editor view */
          <div className="min-h-full">{children}</div>
        ) : (
          /* Folder content view */
          <DriveContents
            selectedFolder={selectedFolder}
            onFolderSelect={handleFolderSelect}
          />
        )}
      </DocumentDropZone>
    </div>
  );
}
