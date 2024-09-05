/**
 * Aiming to build something akin to:
 * (FILE :path)->(Function { name,  path, js, jsdoc, methods: [ "firstMethod", "secondMethod", "thirdMethod" ] })	-[CALL { calls: [ 'a', 'b', 'c', 'd' ] }]->(d)<-(c)<-(b)<-(a)
 * 				 (Function)																					-[CALL { calls: [ 'something' ] }		]->(something)
 * 				 (Class { name, path, js, jsdoc, methods: [ ... ]												})	-[CALL { calls: [ 'a', 'b', 'c', 'd' ] }]->(d)<-(c)<-(b)<-(a)
 */
import {
	Node,
	Program,
	ClassDeclaration,
	ClassExpression,
	FunctionDeclaration,
	FunctionExpression,
	ArrowFunctionExpression,
	ExportNamedDeclaration,
	ExportDefaultDeclaration,
	VariableDeclarator,
	AnonymousFunctionDeclaration,
	AnonymousClassDeclaration,
} from 'acorn';

import walk, {
	simple as walkSimple,
	base as walkBase
} from 'acorn-walk';

// Import types from estree if needed

import fs from 'fs';
import path from 'path';

import prettier from 'prettier';
import acorn, { Comment } from 'acorn';

import { writeToFileAsync } from "./filesystem";
import { uniqueArrays, readCodeFromFile } from './utilities';

import { ScopeToGraph } from './scopeToGraph';
import type { INodes, IScope } from './types';

const args = require('minimist')(process.argv.slice(2));
const inputFilePath = args.i || args.input;

if (!inputFilePath) {
	console.error('Please provide an input file using -i or --input.');
	process.exit(1);
}

const filePath = path.resolve(inputFilePath);
const fileContent = fs.readFileSync(filePath, 'utf-8');

const comments: Comment[] = [];

let anonymousIdentifier = 0;

// Parse the JavaScript code into an abstract syntax tree (AST)
const ast = acorn.parse(fileContent, {
	/**
	 * `ecmaVersion` indicates the ECMAScript version to parse. Can be a
	 * number, either in year (`2022`) or plain version number (`6`) form,
	 * or `"latest"` (the latest the library supports). This influences
	 * support for strict mode, the set of reserved words, and support for
	 * new syntax features.
	 */
	ecmaVersion: 'latest',

	/**
	 * `sourceType` indicates the mode the code should be parsed in.
	 * Can be either `"script"` or `"module"`. This influences global
	 * strict mode and parsing of `import` and `export` declarations.
	 */
	// sourceType?: "script" | "module"

	/**
	 * a callback that will be called when a semicolon is automatically inserted.
	 * @param lastTokEnd the position of the comma as an offset
	 * @param lastTokEndLoc location if {@link locations} is enabled
	 */
	// onInsertedSemicolon?: (lastTokEnd: number, lastTokEndLoc?: Position) => void

	/**
	 * similar to `onInsertedSemicolon`, but for trailing commas
	 * @param lastTokEnd the position of the comma as an offset
	 * @param lastTokEndLoc location if `locations` is enabled
	 */
	// onTrailingComma?: (lastTokEnd: number, lastTokEndLoc?: Position) => void

	/**
	 * By default, reserved words are only enforced if ecmaVersion >= 5.
	 * Set `allowReserved` to a boolean value to explicitly turn this on
	 * an off. When this option has the value "never", reserved words
	 * and keywords can also not be used as property names.
	 */
	allowReserved: false,

	/**
	 * When enabled, a return at the top level is not considered an error.
	 */
	allowReturnOutsideFunction: true,

	/**
	 * When enabled, import/export statements are not constrained to
	 * appearing at the top of the program, and an import.meta expression
	 * in a script isn't considered an error.
	 */
	allowImportExportEverywhere: true,

	/**
	 * By default, `await` identifiers are allowed to appear at the top-level scope only if {@link ecmaVersion} >= 2022.
	 * When enabled, await identifiers are allowed to appear at the top-level scope,
	 * but they are still not allowed in non-async functions.
	 */
	allowAwaitOutsideFunction: true,

	/**
	 * When enabled, super identifiers are not constrained to
	 * appearing in methods and do not raise an error when they appear elsewhere.
	 */
	allowSuperOutsideMethod: true,

	/**
	 * When enabled, hashbang directive in the beginning of file is
	 * allowed and treated as a line comment. Enabled by default when
	 * {@link ecmaVersion} >= 2023.
	 */
	allowHashBang: true,

	/**
	 * By default, the parser will verify that private properties are
	 * only used in places where they are valid and have been declared.
	 * Set this to false to turn such checks off.
	 */
	checkPrivateFields: false,

	/**
	 * When `locations` is on, `loc` properties holding objects with
	 * `start` and `end` properties as {@link Position} objects will be attached to the
	 * nodes.
	 */
	locations: true,
	/**
	 * When {@link locations} is on, you can pass this to record the source
	 * file in every node's `loc` object.
	 */
	sourceFile: filePath,
	/**
	 * This value, if given, is stored in every node, whether {@link locations} is on or off.
	 */
	// directSourceFile?: string

	/**
	 * a callback that will cause Acorn to call that export function with object in the same
	 * format as tokens returned from `tokenizer().getToken()`. Note
	 * that you are not allowed to call the parser from the
	 * callback—that will corrupt its internal state.
	 */
	// onToken?: ((token: Token) => void) | Token[]

	/**
	 * This takes a export function or an array.
	 *
	 * When a export function is passed, Acorn will call that export function with `(block, text, start,
	 * end)` parameters whenever a comment is skipped. `block` is a
	 * boolean indicating whether this is a block (`/* *\/`) comment,
	 * `text` is the content of the comment, and `start` and `end` are
	 * character offsets that denote the start and end of the comment.
	 * When the {@link locations} option is on, two more parameters are
	 * passed, the full locations of {@link Position} export type of the start and
	 * end of the comments.
	 *
	 * When a array is passed, each found comment of {@link Comment} export type is pushed to the array.
	 *
	 * Note that you are not allowed to call the
	 * parser from the callback—that will corrupt its internal state.
	 */
	onComment: comments,

	/**
	 * Nodes have their start and end characters offsets recorded in
	 * `start` and `end` properties (directly on the node, rather than
	 * the `loc` object, which holds line/column data. To also add a
	 * [semi-standardized][range] `range` property holding a `[start,
	 * end]` array with the same numbers, set the `ranges` option to
	 * `true`.
	 */
	ranges: false,

	/**
	 * It is possible to parse multiple files into a single AST by
	 * passing the tree produced by parsing the first file as
	 * `program` option in subsequent parses. This will add the
	 * toplevel forms of the parsed file to the `Program` (top) node
	 * of an existing parse tree.
	 */
	// program?: Node

	/**
	 * When enabled, parenthesized expressions are represented by
	 * (non-standard) ParenthesizedExpression nodes
	 */
	preserveParens: false,
});

// walk.full(ast, parseProgram);
let functions: INodes = {};
// { [key: string]: { [key: string]: string | any } } = {};
let classes: INodes = {};
let exported: { [key: string]: { default: boolean, identifier: string } } = {};
const scope: IScope = {
	source: ast.loc!.source as string,
	functions,
	classes,
	exported,
}

parseAST(ast);

// postProcessScope(scope);

// console.dir(functions, { depth: null });
// console.dir(classes, { depth: null });
// console.dir(exported, { depth: null });
// console.dir(scope, { depth: null });

for (let name of Object.keys(functions)) {
	// console.dir(functions[name], { depth: 1 });
	functions[name].js && writeToFileAsync(`./output/${functions[name].path}.${functions[name].name}.js`, functions[name].js);
	functions[name].jsdoc && writeToFileAsync(`./output/${functions[name].path}.${functions[name].name}.jsdoc`, functions[name].jsdoc);
}

const scopeToGraph = new ScopeToGraph(scope)

function postProcessScope(scope: any) {
	const keys = Object.keys(scope.functions)
	for (const key of keys) {
		for (const calls of scope.functions[key].calls) {
			if (calls.length === 1) {
				if (calls[0].length === 1) {
					if (keys.includes(calls[0][0])) {
						calls[0][0] = scope.functions[calls[0][0]];
					}
				}
			}
		}
	}
}

// If `walkSimple` is missing, replace `walkSimple` with `walk.simple`
function handleFunctionDeclaration(
	node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | AnonymousFunctionDeclaration,
	parent: any = functions
) {
	const functionName = node.id ? node.id.name : `anonymous_function_${anonymousIdentifier++}`; // Use a default name if the function is anonymous
	parent[functionName] = {
		name: functionName,
		path: node.loc?.source || "",
		js: readCodeFromFile(node),
        jsdoc: extractJsDoc(node),
		methods: {},
		calls: [],
	};

	walk.simple(node.body, {
		FunctionDeclaration(innerNode: FunctionDeclaration | AnonymousFunctionDeclaration) {
			handleFunctionDeclaration(innerNode, parent[functionName].methods);
		},
		FunctionExpression(innerNode: FunctionExpression) {
			handleFunctionDeclaration(innerNode, parent[functionName].methods);
		},
		ArrowFunctionExpression(innerNode: ArrowFunctionExpression) {
			handleFunctionDeclaration(innerNode, parent[functionName].methods);
		},
		ClassDeclaration(innerNode: ClassDeclaration | AnonymousClassDeclaration) {
			handleClassDeclaration(innerNode, parent[functionName].methods);
		},
		ClassExpression(innerNode: ClassExpression) {
			handleClassDeclaration(innerNode, parent[functionName].methods);
		},
		CallExpression(callNode: Node) {
			parent[functionName].calls.push(extractCallChain(callNode));
		},
	});

	parent[functionName].calls = uniqueArrays(parent[functionName].calls);
}

function handleClassDeclaration(
	node: ClassExpression | ClassDeclaration | AnonymousClassDeclaration,
	parentClasses: any = classes
) {
	const className = node.id ? node.id.name : `anonymous_class_${anonymousIdentifier++}`; // Use a default name if the class is anonymous
	parentClasses[className] = {
		name: className,
		path: node.loc?.source || "",
		js: readCodeFromFile(node),
		jsdoc: extractJsDoc(node),
		methods: {},
		calls: [],
	};

	(node.body.body as Array<Node>).forEach((childNode: Node | any) => {
		if (childNode.type === "MethodDefinition") {
			const methodNode = childNode;
			const methodName = methodNode.key.name; // Extract method name
			parentClasses[className].methods[methodName] = {
				name: methodName,
				path: node.loc?.source || "",
				js: readCodeFromFile(methodNode),
				jsdoc: extractJsDoc(methodNode),
				calls: [],
			};

			// Recursively parse AST for method body
			parseAST(methodNode.value.body, parentClasses[className].methods[methodName]);
		} else if (childNode.type === "ClassDeclaration" || childNode.type === "ClassExpression") {
			parseAST(childNode as any, parentClasses[className].methods);
		}
	});

	parentClasses[className].calls = uniqueArrays(parentClasses[className].calls);
}

// Use the correct `walk.base` reference for dynamic checks
function parseAST(ast: Program | Node, parentContainer?: any) {
	const queue: Node[] = [ast];

	while (queue.length > 0) {
		const node = queue.shift();

		if (!node) continue;

		switch (node.type) {
			case "ClassExpression":
			case "ClassDeclaration":
				handleClassDeclaration(node as any, parentContainer || classes);
				break;

			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ArrowFunctionExpression":
				handleFunctionDeclaration(node as any, parentContainer || functions);
				break;

			default:
				const walker = walk.base[node.type as keyof typeof walk.base];
				if (walker) {
					walker(node as any, queue, (childNode: Node) => queue.push(childNode));
				}
				break;
		}

		if (
			node.type === "ExportNamedDeclaration"
			|| node.type === "ExportDefaultDeclaration"
			|| node.type === "ExpressionStatement"
		) {
			extractExport(node);
		}
	}
}

// let formattedCode = await prettier.format(code, {
// 	parser: 'babel',
// 	useTabs: true,
// 	tabWidth: 4,
// 	semi: true,
// 	singleQuote: true,
// 	quoteProps: 'as-needed',
// 	trailingComma: 'all',
// 	bracketSpacing: true,
// 	bracketSameLine: false,
// 	arrowParens: 'avoid',
// 	proseWrap: 'always',
// 	endOfLine: 'lf',
// 	embeddedLanguageFormatting: 'off',
// 	singleAttributePerLine: true,
// 	printWidth: 120,
// 	insertPragma: true,
// });

/**
 * Extract the JSDoc comment immediately preceding a node.
 *
 * @param {acorn.Node} node - The AST node representing the function or class.
 * @returns {string|null} The JSDoc comment, or null if none is found.
 */
function extractJsDoc(node: acorn.Node): string | null {
	const precedingComments = comments.filter(
		comment => comment.end <= node.start && comment.type === "Block" && comment.value.startsWith("*")
    );

    // Sort comments by their position to ensure we consider the closest preceding comment
    precedingComments.sort((a, b) => b.end - a.end);

    if (precedingComments.length > 0) {
        const closestComment = precedingComments[0];

        if (closestComment.loc!.end.line === node.loc!.start.line -1) {
            return `/**${closestComment.value}*/`;
        }
    }

    return null;
}

/**
 * Extracts export information for a given export node and populates the `exported` object.
 *
 * @param {acorn.Node} node - The AST node representing an export declaration.
 */
function extractExport(node: any) {
    // Handle named exports
    if (node.type === "ExportNamedDeclaration") {
        if (node.declaration) {
            if (node.declaration.id) {
                // Handle single named export like `export function myFunc() { ... }`
                exported[node.declaration.id.name] = {
                    default: false,
                    identifier: node.declaration.id.name,
                };
            } else if (node.declaration.declarations) {
                // Handle multiple named exports like `export const a = 1, b = 2;`
                node.declaration.declarations.forEach((declarator: any) => {
                    exported[declarator.id.name] = {
                        default: false,
                        identifier: declarator.id.name,
                    };
                });
            }
        } else if (node.specifiers) {
            // Handle exports like `export { foo, bar };`
            node.specifiers.forEach((specifier: any) => {
                exported[specifier.exported.name] = {
                    default: false,
                    identifier: specifier.local.name,
                };
            });
        }
    }

    // Handle default exports
    if (node.type === "ExportDefaultDeclaration") {
        let identifier = null;

        // If the export is an identifier or a named function/class
        if (node.declaration.type === "Identifier") {
            identifier = node.declaration.name;
        } else if (node.declaration.id) {
            identifier = node.declaration.id.name;
        }

        exported["default"] = {
            default: true,
            identifier: identifier,
        };
    }

    // Handle CommonJS exports (e.g., `exports.parseAST = parseAST;` or `exports.default = parseAST;`)
    if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
        const assignment = node.expression;
        if (
            assignment.left.type === "MemberExpression" &&
            assignment.left.object.type === "Identifier" &&
            assignment.left.object.name === "exports"
        ) {
            const exportedName = assignment.left.property.name;
            const identifier = assignment.right.name || assignment.right.type;

            // Check if the export is default
            const isDefault = exportedName === "default";

            exported[exportedName] = {
                default: isDefault,
                identifier: identifier,
            };
        }
    }

    // Handle module.exports (e.g., `module.exports = { parseAST };`)
    if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
        const assignment = node.expression;
        if (
            assignment.left.type === "MemberExpression" &&
            assignment.left.object.type === "Identifier" &&
            assignment.left.object.name === "module" &&
            assignment.left.property.name === "exports"
        ) {
            if (assignment.right.type === "ObjectExpression") {
                assignment.right.properties.forEach((prop: any) => {
                    if (prop.key && prop.key.name) {
                        const isDefault = prop.key.name === "default";
                        exported[prop.key.name] = {
                            default: isDefault,
                            identifier: prop.value.name || prop.value.type,
                        };
                    }
                });
            }
        }
    }
}

/**
 * Extracts the full path of the callee function from a CallExpression node.
 *
 * @param {acorn.Node} callNode - The AST node representing the CallExpression.
 * @returns {string[]} - An array representing the full path to the callee function
 * (e.g., ["$.ajax", "done", "fail"] or ["anonymous", "done"]).
 */
function extractCalleePath(callNode: any & acorn.CallExpression): string[] {
    let callee = callNode.callee;
    let pathParts: string[] = [];

    while (callee.type === 'MemberExpression') {
        pathParts.unshift(callee.property.name);
        callee = callee.object;
    }
	switch (callee.type) {
		case 'Identifier':
			pathParts.unshift(callee.name);
			break
		case 'ThisExpression':
			pathParts.unshift('this');
			break
		case 'FunctionExpression':
		case 'ArrowFunctionExpression':
			if (callee.id) {
				pathParts.unshift(callee.id.name);
			} else {
				pathParts.unshift('anonymous');
			}
			break;
		case 'SequenceExpression':
			const lastExpression = callee.expressions[callee.expressions.length - 1];
			if (lastExpression.type === 'Identifier') {
				pathParts.unshift(lastExpression.name);
			} else if (lastExpression.type === 'MemberExpression') {
				// Extract member expression from the last expression in the sequence
				let member = lastExpression;
				while (member.type === 'MemberExpression') {
					pathParts.unshift(member.property.name);
					member = member.object;
				}
				if (member.type === 'Identifier') {
					pathParts.unshift(member.name);
				}
			}
			break;
		default:
			// console.warn('Unhandled callee type:', callee.type, callee);
			break;
    }

    return pathParts;
}

/**
 * Extracts chained calls from a CallExpression node.
 *
 * @param {acorn.Node} node - The AST node representing the body to search.
 * @returns {string[][]} - An array of call paths representing the chain
 * (e.g., [["$.ajax"], ["$.ajax", "done"], ["$.ajax", "fail"]]).
 */
function extractCallChain(node: any): string[][] {
	const callChains: string[][] = [];

	walkSimple(
		node,
		{
			CallExpression(callExpression) {
				const calleePath = extractCalleePath(callExpression);
				if (calleePath.length > 0) {  // Ensure the path is not empty
					callChains.push(calleePath);
				} else {
					// Log if an empty path is encountered
					console.warn('Encountered empty callee path for CallExpression:', callExpression);
				}
			}
		},
		{
			...walkBase,
			FunctionDeclaration() { },
			FunctionExpression() { },
			ArrowFunctionExpression() { },
			ClassDeclaration() { },
			ClassExpression() { }
		}
	);

	return callChains.reverse(); // Reverse to maintain the order of calls
}
