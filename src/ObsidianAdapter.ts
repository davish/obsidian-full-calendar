import {
    App,
    CachedMetadata,
    EventRef,
    FileManager,
    MetadataCache,
    TAbstractFile,
    TFile,
    Vault,
} from "obsidian";

/**
 * A stripped-down interface into the Obsidian API that only exposes the necessary
 * functions that calendars will use. Factoring this out is useful for mocking the
 * Obsidian API in unit tests.
 */
export interface ObsidianInterface {
    /**
     * @param path path to get the file for.
     * Get a file/folder from the Vault. Returns null if file doesn't exist.
     */
    getAbstractFileByPath(path: string): TAbstractFile | null;

    /**
     * @param path path to get the file for.
     * Get a file from the Vault. Returns null if file doesn't exist or is a folder.
     */
    getFileByPath(path: string): TFile | null;

    /**
     * @param file file to get metadata for.
     * Get the Obsidian-parsed metadata for the given file.
     */
    getMetadata(file: TFile): CachedMetadata | null;

    /**
     * Return a promise that will listen for cache updates if no metadata
     * cache entry exists for a file yet.
     * @param file
     */
    waitForMetadata(file: TFile): Promise<CachedMetadata>;

    /**
     * @param file file to read.
     * Read a file from the vault.
     */
    read(file: TFile): Promise<string>;

    process<T>(file: TFile, func: (text: string) => T): Promise<T>;

    /**
     * Create a new file at the given path with the given contents.
     *
     * @param path path to create the file at.
     * @param contents new contents of the file.
     */
    create(path: string, contents: string): Promise<TFile>;

    /**
     * Rewrite the given file. This API does not directly expose a "write" function
     * to ensure that a file is read from disk directly before it is written to.
     *
     * @param file file to rewrite
     * @param rewriteFunc callback function that performs the rewrite.
     */
    rewrite(
        file: TFile,
        rewriteFunc: (contents: string) => string
    ): Promise<void>;
    rewrite(
        file: TFile,
        rewriteFunc: (contents: string) => Promise<string>
    ): Promise<void>;
    /**
     * Rewrite the given file and return some auxilliary info to the caller.
     *
     * @param file file to rewrite
     * @param rewriteFunc callback function that performs the rewrite.
     */
    rewrite<T>(
        file: TFile,
        rewriteFunc: (contents: string) => [string, T]
    ): Promise<T>;
    rewrite<T>(
        file: TFile,
        rewriteFunc: (contents: string) => Promise<[string, T]>
    ): Promise<T>;

    /**
     * Rename a file.
     * @param file file to rename.
     * @param newPath new path for this file.
     */
    rename(file: TFile, newPath: string): Promise<void>;

    /**
     * Delete a file.
     * @param file file to delete
     * @param system set to true to send to system trash, otherwise Vault trash.
     */
    delete(file: TFile): Promise<void>;

    /**
     * Create a folder at the given path if it doesn't exist.
     * @param path path to create the folder at.
     */
    createFolder(path: string): Promise<void>;
}

/**
 * "Production" implementation of the ObsidianInterface.
 * It takes in the Vault and MetadataCache from Plugin.app.
 */
export class ObsidianIO implements ObsidianInterface {
    vault: Vault;
    metadataCache: MetadataCache;
    fileManager: FileManager;
    systemTrash: boolean;

    constructor(app: App, systemTrash: boolean = true) {
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.fileManager = app.fileManager;
        this.systemTrash = systemTrash;
    }

    delete(file: TFile): Promise<void> {
        return this.vault.trash(file, this.systemTrash);
    }

    rename(file: TFile, newPath: string): Promise<void> {
        return this.fileManager.renameFile(file, newPath);
    }

    async rewrite<T>(
        file: TFile,
        rewriteFunc: (
            contents: string
        ) => string | [string, T] | Promise<string> | Promise<[string, T]>
    ): Promise<T | void> {
        const page = await this.vault.read(file);
        let result = rewriteFunc(page);

        if (result instanceof Promise) {
            result = await result;
        }

        if (Array.isArray(result)) {
            await this.vault.modify(file, result[0]);
            return result[1];
        } else {
            await this.vault.modify(file, result);
            return;
        }
    }

    create(path: string, contents: string): Promise<TFile> {
        return this.vault.create(path, contents);
    }

    getAbstractFileByPath(path: string): TAbstractFile | null {
        return this.vault.getAbstractFileByPath(path);
    }

    getFileByPath(path: string): TFile | null {
        const f = this.vault.getAbstractFileByPath(path);
        if (!f) {
            return null;
        }
        if (!(f instanceof TFile)) {
            return null;
        }
        return f;
    }

    getMetadata(file: TFile): CachedMetadata | null {
        return this.metadataCache.getFileCache(file);
    }

    waitForMetadata(file: TFile): Promise<CachedMetadata> {
        return new Promise((resolve, reject) => {
            const cache = this.metadataCache.getFileCache(file);
            let ref: EventRef | null = null;
            if (cache) {
                resolve(cache);
                return;
            }
            ref = this.metadataCache.on(
                "changed",
                (changedFile, data, cache) => {
                    if (changedFile.path !== file.path) {
                        console.debug(
                            "waitForMetadata(): a different file has changed. continue listening..."
                        );
                        return;
                    }
                    resolve(cache);
                    if (ref) {
                        this.metadataCache.offref(ref);
                    } else {
                        console.warn("No ref was found after cache loaded.");
                    }
                    return;
                }
            );
        });
    }

    read(file: TFile): Promise<string> {
        return this.vault.cachedRead(file);
    }

    async process<T>(file: TFile, func: (text: string) => T): Promise<T> {
        return func(await this.read(file));
    }

    async createFolder(path: string): Promise<void> {
        return this.vault.createFolder(path);
    }
}
