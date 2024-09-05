
export interface IScope {
	source: string;
	functions: INodes;
	classes: INodes;
	exported: { [key: string]: { [key: string]: string | any; }; };
}

export interface INodes {
	[key: string]: INode
}

export interface INode {
	name: string;
	path: string;
	js: string;
	jsdoc: string;
	methods: INodes;
	calls: string[][][]
}
