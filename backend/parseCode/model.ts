import neo4j, { Driver, Session, Transaction } from "neo4j-driver";

export class Model {
    private driver: Driver;
    private session: Session;
    private transaction: Transaction | null = null;

    constructor() {
        this.driver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', '2023Client22!!')
        );
        this.session = this.driver.session();
    }

    async runQuery(query: string) {
        try {
            // If a transaction exists, run the query within the transaction
            if (this.transaction) {
                const result = await this.transaction.run(query);
                return result;
            } else {
                // Otherwise, run the query directly on the session
                const result = await this.session.run(query);
                return result;
            }
        } catch (error) {
            console.error('Error running query:', error);
            throw error;  // Re-throw the error for the caller to handle
        }
    }

    async beginTransaction() {
        if (!this.transaction) {
            this.transaction = this.session.beginTransaction();
        } else {
            console.warn('Transaction already open!');
        }
    }

    async commitTransaction() {
        if (this.transaction) {
            await this.transaction.commit();
            this.transaction = null;  // Reset transaction
        } else {
            console.warn('No transaction to commit!');
        }
    }

    async rollbackTransaction() {
        if (this.transaction) {
            await this.transaction.rollback();
            this.transaction = null;  // Reset transaction
        } else {
            console.warn('No transaction to roll back!');
        }
    }

    async close(): Promise<void> {
        try {
            // Ensure any open transaction is committed or rolled back
            if (this.transaction) {
                await this.transaction.rollback();
                this.transaction = null;
            }
            await this.session.close();
            await this.driver.close();
        } catch (error) {
            console.error('Error closing connection:', error);
        }
    }
}
