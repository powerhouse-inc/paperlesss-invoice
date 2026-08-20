import {
  Sidebar,
  SidebarProvider,
  type SidebarNode,
} from "@powerhousedao/document-engineering";
import {
  setSelectedNode,
  useSelectedDrive,
} from "@powerhousedao/reactor-browser";
import { Building2, Calendar, CreditCard } from "lucide-react";
import { useMemo, useState } from "react";
import { useBillingFolderStructure } from "../hooks/useBillingFolderStructure.js";

const ICON_SIZE = 14;

/**
 * Folder types for content routing.
 *
 * Ported from contributor-billing and reduced to the billing feature set:
 * the "reporting", "billing" and "subscriptions" sections were stripped, so
 * only "payments" and "billing" (the overview) remain routable.
 */
export type FolderType = "payments" | "billing" | null;

/** Selected folder info for content routing */
export interface SelectedFolderInfo {
  folderId: string;
  folderType: FolderType;
  monthName?: string;
}

type FolderTreeProps = {
  onFolderSelect?: (folderInfo: SelectedFolderInfo | null) => void;
  activeNodeId?: string;
  onActiveNodeIdChange?: (nodeId: string) => void;
};

/**
 * Sidebar navigation showing the Billing folder structure (Month > Payments).
 *
 * Drives created by the old contributor-billing app may also contain
 * Reporting subfolders; those are intentionally not rendered here.
 */
export function FolderTree({
  onFolderSelect,
  activeNodeId: controlledActiveNodeId,
  onActiveNodeIdChange,
}: FolderTreeProps) {
  // Use controlled state if provided, otherwise use local state.
  // Empty string means no selection (overview page).
  const [localActiveNodeId, setLocalActiveNodeId] = useState<string>("");
  const activeNodeId = controlledActiveNodeId ?? localActiveNodeId;
  const setActiveNodeId = onActiveNodeIdChange ?? setLocalActiveNodeId;

  const [driveDocument] = useSelectedDrive();
  const { billingFolder, monthFolders, paymentsFolderIds } =
    useBillingFolderStructure();

  // Build a set of month folder IDs for quick lookup
  const monthFolderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [, info] of monthFolders.entries()) {
      ids.add(info.folder.id);
    }
    return ids;
  }, [monthFolders]);

  // Build a set of all valid node IDs so a stale activeNodeId (e.g. a folder
  // that was just deleted) never reaches the Sidebar component.
  const validNodeIds = useMemo(() => {
    const ids = new Set<string>(["billing-placeholder"]);
    if (billingFolder?.id) ids.add(billingFolder.id);
    for (const info of monthFolders.values()) {
      ids.add(info.folder.id);
      if (info.paymentsFolder) ids.add(info.paymentsFolder.id);
    }
    return ids;
  }, [billingFolder, monthFolders]);

  const sanitizedActiveNodeId = useMemo(() => {
    if (activeNodeId === "") return "";
    if (validNodeIds.has(activeNodeId)) return activeNodeId;
    return "";
  }, [activeNodeId, validNodeIds]);

  // Build navigation: a single Billing section with months > Payments
  const navigationSections = useMemo(() => {
    const billingChildren: SidebarNode[] = [];

    // Sort months by date (most recent first)
    const sortedMonths = Array.from(monthFolders.entries()).sort(
      ([nameA], [nameB]) => {
        const dateA = new Date(nameA);
        const dateB = new Date(nameB);
        return dateB.getTime() - dateA.getTime();
      },
    );

    for (const [monthName, info] of sortedMonths) {
      const monthChildren: SidebarNode[] = [];

      if (info.paymentsFolder) {
        monthChildren.push({
          id: info.paymentsFolder.id,
          title: "Payments",
          icon: <CreditCard size={ICON_SIZE} />,
        });
      }

      billingChildren.push({
        id: info.folder.id,
        title: monthName,
        icon: <Calendar size={ICON_SIZE} />,
        children: monthChildren.length > 0 ? monthChildren : undefined,
      });
    }

    const sections: SidebarNode[] = [
      {
        id: billingFolder?.id || "billing-placeholder",
        title: "Billing",
        icon: <Building2 size={ICON_SIZE} />,
        children: billingChildren.length > 0 ? billingChildren : undefined,
      },
    ];

    return sections;
  }, [billingFolder, monthFolders]);

  const handleActiveNodeChange = (node: SidebarNode) => {
    setActiveNodeId(node.id);

    // Billing root -> overview
    if (node.id === billingFolder?.id || node.id === "billing-placeholder") {
      onFolderSelect?.({
        folderId: billingFolder?.id || "",
        folderType: "billing",
      });
      setSelectedNode("");
      return;
    }

    // Month folder - just let it expand, don't navigate
    if (monthFolderIds.has(node.id)) {
      return;
    }

    // Payments folder -> invoice table
    if (paymentsFolderIds.has(node.id)) {
      for (const [monthName, info] of monthFolders.entries()) {
        if (info.paymentsFolder?.id === node.id) {
          onFolderSelect?.({
            folderId: node.id,
            folderType: "payments",
            monthName,
          });
          setSelectedNode("");
          return;
        }
      }
    }

    // Default: clear selection (shows the overview)
    onFolderSelect?.(null);
    setSelectedNode("");
  };

  // Stable key: remounting on content changes would lose collapsed state
  const sidebarKey = driveDocument?.header.id || "empty";

  return (
    <SidebarProvider nodes={navigationSections}>
      <style>
        {`
          .folder-tree-sidebar .sidebar__item-caret--no-children {
            visibility: hidden;
          }
          .folder-tree-sidebar .sidebar__header-icon {
            display: none;
          }
        `}
      </style>
      <Sidebar
        key={sidebarKey}
        className="pt-1 folder-tree-sidebar"
        nodes={navigationSections}
        activeNodeId={sanitizedActiveNodeId}
        onActiveNodeChange={handleActiveNodeChange}
        sidebarTitle={driveDocument?.header.name || "Billing"}
        showSearchBar={false}
        resizable={true}
        allowPinning={false}
        showStatusFilter={false}
        initialWidth={256}
        defaultLevel={2}
        handleOnTitleClick={() => {
          onFolderSelect?.(null);
          setSelectedNode("");
          setActiveNodeId("");
        }}
      />
    </SidebarProvider>
  );
}
