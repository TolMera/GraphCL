import acorn from 'acorn';
import fs from 'fs';

export function uniqueArrays(arrayOfArrays: unknown[][]) {
	const seen = new Set();
	const result = [];

	for (const arr of arrayOfArrays) {
		// Sort and join the array to create a unique string representation
		const sortedKey = arr.slice().sort().join(',');

		// If this representation is not in the set, add it to the result and the set
		if (!seen.has(sortedKey)) {
			seen.add(sortedKey);
			result.push(arr);
		}
	}

	return result;
}

/**
 * Extracts and returns a segment of code from a source file based on the location data provided by an AST node.
 *
 * The function reads the entire content of the file specified by the `loc.source` property of the provided node,
 * then extracts the code segment corresponding to the `start` and `end` positions of the node. The extracted
 * code is further trimmed based on the `start` and `end` column positions to ensure that only the relevant
 * portion of the code is returned.
 *
 * @param {acorn.Node} node - The AST node containing location data (`start`, `end`, `loc`) that specifies
 *							the position and boundaries of the code to extract.
 *							- `start`: The starting character offset in the file.
 *							- `end`: The ending character offset in the file.
 *							- `loc`: Contains `start` and `end` positions, each with `line` and `column` information,
 *							  as well as the `source` file path.
 *
 * @returns {string} The extracted and trimmed code segment from the source file. The returned code
 *				   matches the exact portion of the file as described by the node's location data.
 *
 * @throws {Error} Will throw an error if:
 *				 - The source file specified in `node.loc.source` cannot be found or read.
 *				 - The `node` does not contain valid location data (`loc`, `start`, `end`).
 *
 * @example
 * // Example usage:
 * const codeSegment = readCodeFromFile(someASTNode);
 * console.log(codeSegment);
 *
 * @example
 * // Given the following AST node (pseudo-code):
 * // {
 * //   start: 100,
 * //   end: 150,
 * //   loc: {
 * //	 start: { line: 10, column: 5 },
 * //	 end: { line: 12, column: 2 },
 * //	 source: '/path/to/source.js'
 * //   }
 * // }
 * // The function will extract and return the code from line 10, column 5 to line 12, column 2.
 */
export function readCodeFromFile(node: acorn.Node): string {
	const filePath = node!.loc!.source!;
	const fileContent = fs.readFileSync(filePath, 'utf-8');
	return fileContent.slice(node.start, node.end);
}
