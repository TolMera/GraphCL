import { Model } from "./model";
import type { IScope, INode, INodes } from "./types";

export class ScopeToGraph {
    graph: any;
    scope: IScope;
    constructor(scope: IScope) {
        this.graph = new Model();
        this.scope = scope;

        this.processScope();
    }

    async processScope() {
        try {
            await this.graph.beginTransaction();
            await this.parseRootScope(this.scope);

            await this.parseFunctions(this.scope.functions);
            await this.parseClasses(this.scope.classes);

            await this.parseCalls(this.scope);

            await this.graph.commitTransaction();  // Commit transaction if all queries are successful
        } catch (error) {
            console.error('Error during transaction:', error);
            await this.graph.rollbackTransaction();  // Rollback in case of any errors
        }
        await this.graph.close();  // Close the session and driver
    }

    async parseRootScope(scope: IScope) {
        const folders: string[] = [];
        for (const folder of scope.source.split('/')) {
            if (folder.includes('.')) continue;
            if (folder.trim().length === 0) continue;
            folders.push(folder.trim().split(" ").join(""));
        }

        const filename = scope.source.split('/').pop()?.split('.').shift();
        if (!filename) {
            console.error("Invalid file path provided in scope.source.");
            return;
        }

        const mergeQueries: string[] = [];
        let previousNodeAlias = "";

        folders.forEach((folder, index) => {
            const folderAlias = `folder${index}`;
            if (index === 0) {
                mergeQueries.push(`MERGE (${folderAlias}:folder {name: "${folder}"})`);
            } else {
                mergeQueries.push(`MERGE (${previousNodeAlias})-[:folder]->(${folderAlias}:folder {name: "${folder}"})`);
            }
            previousNodeAlias = folderAlias;
        });

        mergeQueries.push(`MERGE (${previousNodeAlias})-[:contains]->(:file {name: "${filename}"})`);

        const query = mergeQueries.join('\n');

        try {
            await this.graph.runQuery(query);
        } catch (error) {
            console.error("Error executing Cypher query:", error);
        }
    }

    async parseCalls(scope: IScope) {
        for (const inode of [...Object.values(scope.functions), ...Object.values(scope.classes)]) {
            for (const code of inode.calls) {
                for (let chain of code) {
                    const target = chain.pop();
                    const placement = `(${chain.join(`)-[:method]->(`)})`;
                    // for (const link of chain) {
                        // console.log(link);
                    // }

                    /*
                        MATCH (u:User {username: 'johndoe'})
                        WITH u, count(u) as matchCount
                        WHERE matchCount = 1
                        CREATE (u)-[:FRIEND]->(:User {username: 'newfriend', createdAt: timestamp()})
                    */

                    `MATCH ()-[:method]->()<-[:calls]-(node)`

                    const callAsCypher = `({name: ${inode.name}, path: ${inode.path})-[]->(`

                }
            }
        }
    }

    nodeToCypherSelect(node: INode) {
        // TODO: Create or use something that generates names for nodes with a no-collision namespace
        const id = "parentNode";
        return {
            id,
            cypher: `(${id} {name: "${node.name}", path: "${node.path}"})`
        };
    }

    async parseMethods(nodes: INodes, parent: INode) {
        if (nodes === undefined) return;
        for (const node of Object.values(nodes)) {
            node as INode;
            if (false && node.name.includes('anonymous_function_')) {
                // Need to figure the dealing with anon functions.
            }
            else {
                const cypherParentNode = this.nodeToCypherSelect(parent);
                // Normal functions that have been declared.
                const filename = node.path.split('/').pop()!.split('.').shift();
                const nodeAsCypher = `(
                        ${node.name}:Method:${filename} {
                            name: "${node.name}",
                            path: "${node.path}",
                            calls: "${JSON.stringify(node.calls).replace(/"/g, '\\"')}",
                            js: "/output/${node.path}:${node.name}.js",
                            jsdoc: "/output/${node.path}:${node.name}.jsdoc"
                        }
                    )`;
                this.graph.runQuery(`MATCH ${cypherParentNode.cypher}
                    MERGE (${cypherParentNode.id})<-[:parent]-${nodeAsCypher}`);
            }

            this.parseMethods(node.methods, node);
        }
    }

    async parseFunctions(nodes: INodes) {
        if (nodes === undefined) return;
        for (const node of Object.values(nodes)) {
            node as INode;
            if (false && node.name.includes('anonymous_function_')) {
                // Need to figure the dealing with anon functions.
            }
            else {
                // Normal functions that have been declared.
                const filename = node.path.split('/').pop()!.split('.').shift();
                const nodeAsCypher = `(
                        ${node.name}:Function:${filename} {
                            name: "${node.name}",
                            path: "${node.path}",
                            calls: "${JSON.stringify(node.calls).replace(/"/g, '\\"')}",
                            js: "/output/${node.path}:${node.name}.js",
                            jsdoc: "/output/${node.path}:${node.name}.jsdoc"
                        }
                    )`;
                this.graph.runQuery(`MATCH (src:file {name: "${filename}"})
                    MERGE (src)-[:contains]->${nodeAsCypher}
                `);
            }

            this.parseMethods(node.methods, node);
        }
    }

    async parseClasses(nodes: INodes) {
        for (const node of Object.values(nodes)) {
            node as INode;
            if (false && node.name.includes('anonymous_class_')) {
                // Need to figure the dealing with anon classes.
            }
            else {
                // Normal functions that have been declared.
                const filename = node.path.split('/').pop()!.split('.').shift();
                const nodeAsCypher = `(
                        ${node.name}:Class:${filename} {
                            name: "${node.name}",
                            path: "${node.path}",
                            calls: "${JSON.stringify(node.calls).replace(/"/g, '\\"')}",
                            js: "/output/${node.path}:${node.name}.js",
                            jsdoc: "/output/${node.path}:${node.name}.jsdoc"
                        }
                    )`;
                this.graph.runQuery(`MATCH (src:file {name: "${filename}"})
                    MERGE (src)-[:contains]->${nodeAsCypher}
                `);
            }

            this.parseMethods(node.methods, node);
        }
    }
}
