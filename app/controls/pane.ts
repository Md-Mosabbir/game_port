import { FolderApi, Pane } from 'tweakpane';

let pane: Pane | null = null;

export const getPane = () => {
	if (typeof window === 'undefined') return null;
	if (!pane) {
		// Tweakpane creates a lightweight runtime UI for changing values while app runs.
		// Docs: https://tweakpane.github.io/docs/
		pane = new Pane({ title: 'World Controls', expanded: true });
	}
	return pane;
};

export const addFolder = (title: string) => {
	const p = getPane();
	if (!p) return null;

	// Creates a collapsible folder section in the pane UI.
	// Docs: https://tweakpane.github.io/docs/#folders
	return p.addFolder({ title, expanded: false }) as FolderApi;
};
