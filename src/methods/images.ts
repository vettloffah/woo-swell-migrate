import WooSwell from "../index";
import * as Log from "../utils/Log.js";
import fs from "fs";
import mime from "mime-types";
import sizeOf from "image-size";
import getReducedObject from "../utils/getReducedObject.js";
import path from "path";
import { getWooProducts } from "./products.js";

import * as Woo from "../types/WooCommerce";
import * as Swell from "../types/Swell";
import { FileDetail, GetImageListFromWooOptions, UploadImagesFromFolderOptions, WooImage, WooImageObj } from "../types/types";

/**
* Iterates through a folder of images files and uploads them to swell.
* ONLY images associated with products in woocommerce will be uploaded, even if
* there are other images in the folder. So, there is no need to separate product 
* images from other wordpress images in the file system.
* 
* @param options optional param
* @param options.loadFromFile defaults to true. Load image metadata from json file if it exists yet
* @param options.skipDuplicates defaults to true. if there is already a file with the filename in swell it will 
* skip the upload.
*/
export async function uploadImagesFromFolder(this: WooSwell, options?: UploadImagesFromFolderOptions) {
    let skipDuplicates;
    let loadFromFile;

    if (options) {
        /** defaults to true */
        skipDuplicates = options.skipDuplicates === undefined ? true : options.skipDuplicates;
        loadFromFile = options.loadFromFile === undefined ? true : options.loadFromFile;
    }

    /** use path or fall back to constructor path */
    const path = this.paths.wooImageFiles;

    /** confirm directory exists  */
    if (!fs.existsSync(path)) {
        throw new Error(`Image directory path ${path} doesn't exist.`);
    }

    const wooImageObj = await _getImageListFromWoo.call(this, { loadFromFile });

    const wooImageFiles = [];
    for (const [, imageArray] of Object.entries(wooImageObj)) {
        const filenames = imageArray.map(image => image.filename);
        wooImageFiles.push(...filenames);
    }

    let existingFilenames: string[] = [];

    if (skipDuplicates) {
        existingFilenames = await _getExistingSwellFileNames.call(this);
    }

    Log.wait("getting local file index (takes a while depending on folder size)");
    const localFiles = await _getLocalFiles.call(this, path);
    const localFileObj = getReducedObject(localFiles, "filename", "path");
    const localFilenames = localFiles.map(localFile => {
        return localFile.filename;
    });

    Log.info(`uploading files`);

    for (const filename of localFilenames) {
        /** skip if the file doesn't belong to a woo product, or if it's already been uploaded */
        if (!wooImageFiles.includes(filename)) continue;
        if (existingFilenames.includes(filename)) continue;
        /** upload image */
        await uploadImage.call(this, localFileObj[filename], filename);
        Log.event(`file ${filename} uploaded`);
    }
}

/**
 * After all images are uploaded to Swell, this function will attach them to the corresponding products. 
 * It is required that products have slugs that match woocommerce.
 * 
 */
export async function attachImagesToProducts(this: WooSwell): Promise<void> {
    const filePath = this.paths.wooImageJson;
    const wooImages = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { [slug: string]: WooImage[] };
    if (!this.swellFiles.length) {
        this.swellFiles = await this.getAllPagesSwell("/:files") as Swell.File[];
    }
    type FileObj = {
        [filename: string]: Swell.File
    }

    const initialValue = { [this.swellFiles[0].filename]: this.swellFiles[0] };

    const fileObj = this.swellFiles.reduce((acc: FileObj, curr: Swell.File) => {
        return { ...acc, [curr.filename]: curr };
    }, initialValue) as FileObj;

    for (const [slug, images] of Object.entries(wooImages)) {
        const imgArr: { caption: string, file: Swell.File }[] = [];
        images.forEach(img => {
            if (!fileObj[img.filename]) return;
            imgArr.push({ caption: img.caption, file: fileObj[img.filename] });
        });

        if (!imgArr.length) {
            continue;
        }

        const res = (await this.swell.get("/products", {
            where: {
                slug,
            },
        }));

        if (!res.results.length) {
            Log.warn(`product slug ${slug} not found, can't attach photo`);
            continue;
        }

        const product = res.results[0];
        const resp = await this.swell.put(`/products/${product.id}`, {
            $set: { images: imgArr },
        });

        if (resp.error) {
            Log.error(`error attaching image: ${resp.error.message}`);
        }

        if (!resp.error) {
            Log.event(`attached image to ${product.name}`);
        }
    }
}

/**
 * Return an object that contains the image slug as key, and array of image file objects.
 * 
 * @param potions.pages specify first and last page pages if you don't want them all. 
 * example: `{ pages: { first: 1, last: 10 } }`
 * 
 * @param options.loadFromFile loads woo products from json file (if it exists)
 * 
 * @returns Object - key is the image slug, value is an array of image objects.
 */
 async function _getImageListFromWoo(this: WooSwell, options: GetImageListFromWooOptions): Promise<WooImageObj> {
    const wooImageObj: WooImageObj = {};

    if (options?.loadFromFile && fs.existsSync(this.paths.wooImageJson)) {
        const images = JSON.parse(fs.readFileSync(this.paths.wooImageJson, "utf-8"));
        Log.info(`${Object.keys(images).length} woo image detail records loaded from ${this.paths.wooImageJson}`);
        return images;
    }

    const products: Woo.Product[] = await getWooProducts.call(this, { loadFromFile: options?.loadFromFile });

    for (const product of products) {
        if (product.images && product.images.length) {
            wooImageObj[product.slug] = [];
            product.images.forEach(image => {
                const url = image.src;
                const filename = url.substring(url.lastIndexOf("/") + 1);
                wooImageObj[product.slug].push({
                    filename,
                    caption: image.alt,
                    name: image.name,
                    productSlug: product.slug,
                });
            });
        }
    }

    if (this.paths.wooImageJson) {
        /** Save data locally so we can use it later without calling API */
        fs.writeFileSync(this.paths.wooImageJson, JSON.stringify(wooImageObj, null, 1));
    }

    return wooImageObj;
}

/**
 * Get list of existing files in swell from the API.
 * 
 * @returns fileNames - array of filenames that exist in swell
 */
async function _getExistingSwellFileNames(this: WooSwell): Promise<string[]> {
    if (!this.swellFiles.length) {
        this.swellFiles = await this.getAllPagesSwell("/:files") as Swell.File[];
    }
    /** get just the names from the file objects  */
    let fileNames: string[] = this.swellFiles.map(file => file.filename);

    /** remove undefined elements */
    fileNames = fileNames.filter(filename => filename !== undefined);

    return fileNames;
}

/**
 * utility function used in uploadImagesFromFolder() method
 * 
 * @param filePath - absolute path of file
 * @param filename - example: 'funny-picture.jpg'
 */
async function uploadImage(this: WooSwell, filePath: any, filename: string): Promise<void> {
    const file = fs.readFileSync(filePath);
    const dimensions = sizeOf(filePath);
    const base64 = file.toString("base64");

    await this.swell.post("/:files", {
        data: {
            $binary: base64,
            $type: "00",
        },
        filename,
        content_type: mime.lookup(filename),
        width: dimensions.width,
        height: dimensions.height,
    });
}

 /**
     * 
     * @param dirPath path to image files.
     * @returns Array of file details objects.
     */
  async function _getLocalFiles(dirPath: string): Promise<FileDetail[]> {
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files: any[] = await Promise.all(dirents.map((dirent: fs.Dirent) => {
        const res = path.resolve(dirPath, dirent.name);
        return dirent.isDirectory()
            ? _getLocalFiles(res)
            : { filename: dirent.name, path: res };
    }));
    return Array.prototype.concat(...files);
}
