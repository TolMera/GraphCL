import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Convert fs.writeFile and fs.mkdir to promise-based functions
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Ensures that the directory for the given file path exists. If not, creates it.
 *
 * @param {string} dirPath - The directory path to ensure exists.
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
	try {
		await mkdirAsync(dirPath, { recursive: true });
	} catch (error) {
		console.error(`Error creating directory ${dirPath}:`, error);
		throw error;  // Rethrow the error to handle it in writeToFileAsync
	}
}

/**
 * Writes a string to a file asynchronously, creating any missing directories.
 *
 * @param {string} filePath - The path to the file where the string will be written.
 * @param {string} content - The string content to write to the file.
 * @returns {Promise<boolean>} - A promise that resolves to true if the file is written successfully.
 */
export async function writeToFileAsync(filePath: string, content: string): Promise<boolean> {
	try {
		const resolvedPath = path.resolve(__dirname, filePath);

		// Extract directory path from the resolved file path
		const dirPath = path.dirname(resolvedPath);

		// Ensure the directory exists
		await ensureDirectoryExists(dirPath);

		// Write the file
		await writeFileAsync(resolvedPath, content, 'utf8');
		console.log(`Successfully wrote to ${resolvedPath}`);
		return true;
	} catch (error) {
		console.error(`Error writing to file ${filePath}:`, error);
		return false;
	}
}
