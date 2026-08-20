/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { DriveExplorer } from "./components/DriveExplorer.js";
import { editorConfig } from "./config.js";

/** Editor component for the app */
export default function Editor(props: EditorProps) {
  // set the config for this app
  // you can update these configs in `./config.ts`
  useSetPHAppConfig(editorConfig);
  // No padded wrapper here: the sidebar must sit flush against the window
  // edge and run full height (same as contributor-billing). DriveExplorer
  // provides its own full-size flex shell; content padding lives inside
  // DriveContents.
  return <DriveExplorer {...props} />;
}
