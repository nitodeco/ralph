import type { Root } from "mdast";
import { visit } from "unist-util-visit";

export function remarkBasePath() {
	return (tree: Root) => {
		visit(tree, "link", (node) => {
			if (node.url.startsWith("/") && !node.url.startsWith("//")) {
				node.url = `/ralph${node.url}`;
			}
		});
	};
}
