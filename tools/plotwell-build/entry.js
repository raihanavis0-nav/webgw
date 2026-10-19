/* Bundled at build time; no external CDN at editing time. */
import { PlotwellEditor } from "@plotwell/editor";
import { TextSelection } from "prosemirror-state";
import "@plotwell/editor/styles.css";
window.PlotwellEmbed = { PlotwellEditor, TextSelection };
