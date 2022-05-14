import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api/index.mjs';
import swell from 'swell-node';
import mime from 'mime-types';
import sizeOf from 'image-size';
import path from "path";
import getReducedObject from './utils/getReducedObject.js';
import fs from 'fs';
import chalk from 'chalk';

import * as Log from './utils/Log.js';
import * as Woo from './types/WooCommerce';
import * as Swell from './types/Swell';
import {
    WooImage,
    CategoryObject,
    CreateProductOptions,
    FieldMap,
    Pages,
    WooConfig,
    SwellConfig,
    GetWooProductsOptions,
    GetSwellCategoriesOptions,
    GetAllPagesSwellOptions,
    GetAllPagesWooOptions,
    DirPaths,
    FilePaths,
    UploadImagesFromFolderOptions,
    GetImageListFromWooOptions,
    WooImageObj,
    FileDetail,
    MigrateCustomersCount,
    MigrateCustomersOptions
} from './types/types';
import { WorkerPerformance } from 'worker_threads';

class WooSwell {

    swell: swell;
    woo: WooCommerceRestApi;
    swellCategories: Swell.Category[]
    wooCategories: Woo.Category[]
    paths: FilePaths;
    swellFiles: Swell.File[]

    /**
     * 
     * @param wooConfig woocommerce API parameters
     * @param swellConfig swell API parameters
     * 
     * @param paths - directory paths to store json files and images
     * @param paths.data - directory to store json files in
     * @param paths.images - directory where wordpress image backup is stored
     */
    constructor(wooConfig: WooConfig, swellConfig: SwellConfig, paths: DirPaths) {
        this.swell = swell.init(swellConfig.store, swellConfig.key);
        this.woo = new WooCommerceRestApi(wooConfig);
        this.paths = {
            /** woocommerce product images */
            wooImageFiles: paths.images,
            /** JSON data files */
            wooImageJson: path.resolve(paths.data, 'woo-images.json'),
            wooProducts: path.resolve(paths.data, 'woo-products.json'),
            wooCustomers: path.resolve(paths.data, 'woo-customers.json'),
            swellCategories: path.resolve(paths.data, 'swell-categories.json')
        }
        this.wooCategories = [];
        this.swellCategories = [];
        this.swellFiles = [];
    }

    /**
     * Create all categories in Swell that exist in Woo. This will not overwrite or create duplicates if 
     * there is already a category with matching slug property.
     * @TODO change API calls to this.getWooCategories
     */
    async createOrUpdateCategories() {

        this.wooCategories = await this.getAllPagesWoo('products/categories') as Woo.Category[];
        this.swellCategories = await this.getAllPagesSwell('/categories') as Swell.Category[];
        const swellObj = getReducedObject(this.swellCategories, 'slug', 'id') as CategoryObject;

        /** Skip if it exists already in swell */
        for (const cat of this.wooCategories) {

            const category: Swell.Category = {
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                active: true
            }

            if (swellObj[cat.slug]) {
                /** update category */
                await this.swell.put(`/categories/${swellObj[cat.slug]}`, category);
                Log.event(`category ${cat.slug} updated`)
                continue;
            }

            /** create category */
            await this.swell.post('/categories', category);
            Log.event(`category ${cat.slug} created`);
        }
    }

    /**
   * Add child / parent relationships to categories in Swell.
   * This should only be executed _after_ all categories have been added to Swell 
   * using createOrUpdateCategories()
   */
    async addCategoryParents() {
        const count = { parents: 0 }

        if (!this.swellCategories.length) {
            this.swellCategories = await this.getAllPagesSwell('/categories') as Swell.Category[];
            this.wooCategories = await this.getAllPagesWoo('products/categories') as Woo.Category[];
        }

        /** build relational objects */
        const wooIdObj = getReducedObject(this.wooCategories, 'id', 'slug') as { [slug: string]: string }
        const wooParentObj = getReducedObject(this.wooCategories, 'slug', 'parent') as { [slug: string]: number }
        const swellSlugObj = getReducedObject(this.swellCategories, 'slug', 'id') as { [slug: string]: string };

        const parentObj: { [slug: string]: string } = {};

        /** build relational object for any categories that contain have a parent category */
        for (const [slug, parentId] of Object.entries(wooParentObj)) {
            /** if there's a parent ID listed in woo AND there is actually a category with that ID */
            if (parentId && swellSlugObj[wooIdObj[parentId]]) {
                parentObj[slug] = swellSlugObj[wooIdObj[parentId]];
            }
        }

        /** update category with parent */
        for (const [slug, id] of Object.entries(parentObj)) {
            await this.swell.put(`categories/${swellSlugObj[slug]}`, { parent_id: id })
            count.parents++;
        }

        return count

    }

    /**
     * Delete categories that exist in swell but not in woocommerce. 
     * (useful for clearing out initial demo categories)
     */
    async deleteUnmatchedCategories(): Promise<{ deleted: number }> {
        let count = 0;

        if (!this.wooCategories.length) {
            this.wooCategories = await this.getAllPagesWoo('products/categories') as Woo.Category[];
            this.swellCategories = await this.getAllPagesSwell('/categories') as Swell.Category[];

        }
        const wooCatSlugs = this.wooCategories.map(cat => {
            return cat.slug;
        })
        const swellObj = getReducedObject(this.swellCategories, 'slug', 'id') as { [slug: string]: string };

        for (const slug of Object.keys(swellObj)) {
            /** don't delete the category if the name exists in woocommerce */
            if (wooCatSlugs.includes(slug)) {
                continue;
            }
            await this.swell.delete(`/categories/${swellObj[slug]}`)
            Log.event(`category ${slug} deleted`);
            count++
        }

        return { deleted: count }
    }


    /**
     * Iterates through the woo products and creates products in swell, or updates them if they exist already.
     * **Prior** to running this function, you should import categories.
     * 
     * @param options.loadFromFile set to true if you want to load from the json files created the last time this was 
     * executed. This drastically speeds up execution time since it skips the API call to woocommerce. This is 
     * automatically set to false if the `pages` option is provided.
     * 
     * @param options.customFields - array of field mappings if custom fields are being imported. Each field mapping 
     * object should contain the name of the woo field, and the name of the swell field. Example: { woo: 'my_field', swell: 'my_field' }
     * 
     * @param options.pages - if importing a subset of pages, supply { first: number, last: number }
     */
    async createOrUpdateProducts(options?: CreateProductOptions) {
        const count = { skipped: 0, updated: 0, created: 0 }

        /** set loadFromFile to false if importing a subset of pages */
        let loadFromFile = options?.pages ? false : !!options?.loadFromFile;
        let customFields = options?.customFields;

        const products = await this.getWooProducts({ loadFromFile, pages: options?.pages });
        const categories = await this.getSwellCategories({ loadFromFile });

        for (const [index, product] of products.entries()) {
            const { action } = await this.#createOrUpdateProduct(product, categories, customFields);
            switch (action) {
                case 'skipped':
                    count.skipped++;
                    break;
                case 'created':
                    count.created++;
                    break;
                case 'updated':
                    count.updated++;
                    break;
            }

            Log.event(`product ${index + 1}/${products.length} ${product.name} ${action}`)
        }

        return count;
    }

    async deleteAllProducts(){
        const products = await this.getAllPagesSwell('/products') as Swell.Product[]
        let batchPayload = []
        for(const product of products){
            batchPayload.push({
                url: `/products/${product.id}`,
                method: 'delete'
            })
        }

       const res = await this.swell.post('/:batch', batchPayload)
       Log.info(`deleted ${res.length} records`)
    }


    /**
     * Get all product records from woocommerce. Can get a subset of products if the pages options is provided.
     * 
     * @param options.loadFromFile if this function has been executed once already, it
     * can read from the previously file to skip the api call to woo. Default is false.
     * 
     * @param options.pages if you want to import a subset of all the products, supply first and last page numbers. 
     * example: { pages: { first: 1, last: 30 } }
     * 
     * @returns array of woo product objects
     * 
     */
    async getWooProducts(options?: GetWooProductsOptions): Promise<Woo.Product[]> {
        let products: Woo.Product[];

        /** read from data file if it exists and return products */
        if (options?.loadFromFile && fs.existsSync(this.paths.wooProducts)) {
            products = JSON.parse(fs.readFileSync(this.paths.wooProducts, 'utf-8')) as Woo.Product[];
            Log.info(`${products.length} woo products loaded from ${this.paths.wooProducts}`);
        } else {
            /** otherwise, call the API */
            products = await this.getAllPagesWoo('products', options) as Woo.Product[];
        }

        /** save to file if file path has been supplied */
        if (this.paths.wooProducts) {
            fs.writeFileSync(this.paths.wooProducts, JSON.stringify(products, null, 1));
        }

        return products;
    }

    /**
     * @param options optional.
     * 
     * @param options.loadFromFile
     * 
     * @returns swell categories
     */
    async getSwellCategories(options?: GetSwellCategoriesOptions): Promise<Swell.Category[]> {
        let categories: Swell.Category[];

        /** return local data if loadFromFile is true and filePath is supplied */
        if (options?.loadFromFile && fs.existsSync(this.paths.swellCategories)) {
            categories = JSON.parse(fs.readFileSync(this.paths.swellCategories, 'utf-8'));
            Log.info(`${categories.length} swell categories loaded from ${this.paths.swellCategories}`)

        } else {
            /** otherwise, download category data from swell */
            categories = await this.getAllPagesSwell('/categories') as Swell.Category[];
        }

        if (this.paths.swellCategories) {
            fs.writeFileSync(this.paths.swellCategories, JSON.stringify(categories, null, 1));
        }

        return categories;
    }

    /**
     * gets all records from all pages (or some pages, optionally) of endpoint
     * 
     * @param endpoint - example: '/products'
     * 
     * @param options - optional. if not provided, will return all records from 
     * all pages with no filters.
     * 
     * @param options.pages - supply a range of pages if not needing all - 
     * example: { pages: { first: 1, last: 10 } }
     * 
     * @param options.queryOptions - Swell query options, limit, sort, where, etc. 
     * See https://swell.store/docs/api/?javascript#querying
     * 
     * @returns - record array
     */
    async getAllPagesSwell(endpoint: string, options?: GetAllPagesSwellOptions): Promise<object[]> {

        let queryOptions = { ...options?.queryOptions }
        if(!queryOptions.limit){
            queryOptions.limit = 100;
        }

        const res = await this.swell.get(endpoint, queryOptions) as Swell.GenericResponse
        let numPerPage = res.results.length;
        let totalPages = Math.ceil(res.count / numPerPage)
        
        let firstPage = options?.pages?.first || 1;
        let lastPage = options?.pages?.last || totalPages;

        let records = [];

        Log.info(`getting swell ${endpoint} records from API`);
        for (let i = firstPage; i <= lastPage; i++) {
            const res = await this.swell.get(endpoint, { ...options?.queryOptions, page: i }) as Swell.GenericResponse
            records.push(...res.results)
            Log.event(`page ${i}/${lastPage}`)
        }

       // Log.info(`${records.length} records retrieved`)
        return records;
    }

    /**
     * gets all records from all pages of endpoint
     * 
     * @param endpoint example: 'products'
     * 
     * @param options - optional.
     * 
     * @param options.pages - supply a page range if not loading all pages. 
     * example: { pages: { start: 10, end: 15 } }
     * 
     * @param options.limit how many records per page to get from the WooCommerce API. 
     * Defaults to 100.
     * 
     * @returns - record array
     */
    async getAllPagesWoo(endpoint: string, options?: GetAllPagesWooOptions): Promise<object[]> {

        const perPage = options?.limit || 100;

        const res = await this.woo.get(endpoint, { per_page: perPage });
        const firstPage = options?.pages?.first || 1;
        const lastPage = options?.pages?.last || parseInt(res.headers['x-wp-totalpages']);
        const records = [];

        Log.info(`getting woo ${endpoint} records from API`)
        for (let i = firstPage; i <= lastPage; i++) {
            records.push(...(await this.woo.get(endpoint, { per_page: perPage, page: i })).data)
            Log.event(`page ${i}/${lastPage}`)
        }

        Log.info(`${records.length} records retrieved`)
        return records;

    }

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
    async uploadImagesFromFolder(options?: UploadImagesFromFolderOptions) {
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
            throw new Error(`Image directory path ${path} doesn't exist.`)
        }

        let wooImageObj = await this.getImageListFromWoo({ loadFromFile })

        let wooImageFiles = [];
        for (const [product, imageArray] of Object.entries(wooImageObj)) {
            let filenames = imageArray.map(image => image.filename);
            wooImageFiles.push(...filenames);
        }

        let existingFilenames: string[] = [];

        if (skipDuplicates) {
            existingFilenames = await this.#getExistingSwellFileNames();
        }

        Log.wait('getting local file index (takes a while depending on folder size)');
        const localFiles = await this.#getLocalFiles(path)
        const localFileObj = getReducedObject(localFiles, 'filename', 'path')
        const localFilenames = localFiles.map(localFile => {
            return localFile.filename;
        })

        Log.info(`uploading files`);

        let that = this;
        for (const filename of localFilenames) {
            /** skip if the file doesn't belong to a woo product, or if it's already been uploaded */
            if (!wooImageFiles.includes(filename)) continue;
            if (existingFilenames.includes(filename)) continue;
            /** upload image */
            await that.#uploadImage(localFileObj[filename], filename);
            Log.event(`file ${filename} uploaded`);
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
    async getImageListFromWoo(options: GetImageListFromWooOptions): Promise<WooImageObj> {

        let wooImageObj: WooImageObj = {};

        if (options?.loadFromFile && fs.existsSync(this.paths.wooImageJson)) {
            const images = JSON.parse(fs.readFileSync(this.paths.wooImageJson, 'utf-8'));
            Log.info(`${Object.keys(images).length} woo image detail records loaded from ${this.paths.wooImageJson}`)
            return images;
        }

        const products: Woo.Product[] = await this.getWooProducts({ loadFromFile: options?.loadFromFile });

        for (const product of products) {
            if (product.images && product.images.length) {
                wooImageObj[product.slug] = [];
                product.images.forEach(image => {
                    const url = image.src;
                    const filename = url.substring(url.lastIndexOf('/') + 1);
                    wooImageObj[product.slug].push({
                        filename,
                        caption: image.alt,
                        name: image.name,
                        productSlug: product.slug
                    });
                })
            }
        }

        if (this.paths.wooImageJson) {
            /** Save data locally so we can use it later without calling API */
            fs.writeFileSync(this.paths.wooImageJson, JSON.stringify(wooImageObj, null, 1));
        }

        return wooImageObj;
    }

    /**
     * After all images are uploaded to Swell, this function will attach them to the corresponding products. 
     * It is required that products have slugs that match woocommerce.
     * 
     */
    async attachImagesToProducts(): Promise<void> {
        const filePath = this.paths.wooImageJson;
        let wooImages = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { [slug: string]: WooImage[] }
        if (!this.swellFiles.length) {
            this.swellFiles = await this.getAllPagesSwell('/:files') as Swell.File[];
        }
        type FileObj = {
            [filename: string]: Swell.File
        }

        const initialValue = { [this.swellFiles[0].filename]: this.swellFiles[0] };

        let fileObj = this.swellFiles.reduce((acc: FileObj, curr: Swell.File, index: number) => {
            return { ...acc, [curr.filename]: curr }
        }, initialValue) as FileObj

        for (const [slug, images] of Object.entries(wooImages)) {

            let imgArr: { caption: string, file: Swell.File }[] = [];
            images.forEach(img => {
                if (!fileObj[img.filename]) return;
                imgArr.push({ caption: img.caption, file: fileObj[img.filename] })
            })

            if (!imgArr.length) {
                continue;
            }

            const res = (await this.swell.get('/products', {
                where: {
                    slug: slug
                }
            }))

            if (!res.results.length) {
                Log.warn(`product slug ${slug} not found, can't attach photo`);
                continue;
            }

            const product = res.results[0]
            const resp = await this.swell.put(`/products/${product.id}`, {
                $set: { images: imgArr }
            })

            if (resp.error) {
                Log.error(`error attaching image: ${resp.error.message}`);
            }

            if (!resp.error) {
                Log.event(`attached image to ${product.name}`)
            }


        }

    }

    /**
     * Get the total number of pages of records from woocommerce API endpoint.
     * 
     * @returns number of total product pages
     */
    async getTotalPages(endpoint: string): Promise<number> {
        const res = await this.woo.get(endpoint);
        return parseInt(res.headers['x-wp-totalpages'])
    }


    /**
     * 
     * @param dirPath path to image files.
     * @returns Array of file details objects.
     */
    async #getLocalFiles(dirPath: string): Promise<FileDetail[]> {

        const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const files: any[] = await Promise.all(dirents.map((dirent: fs.Dirent) => {
            const res = path.resolve(dirPath, dirent.name);
            return dirent.isDirectory()
                ? this.#getLocalFiles(res)
                : { filename: dirent.name, path: res }
        }));
        return Array.prototype.concat(...files)
    }

    /**
     * Get list of existing files in swell from the API.
     * 
     * @returns fileNames - array of filenames that exist in swell
     */
    async #getExistingSwellFileNames(): Promise<string[]> {

        if (!this.swellFiles.length) {
            this.swellFiles = await this.getAllPagesSwell('/:files') as Swell.File[]
        }
        /** get just the names from the file objects  */
        let fileNames: string[] = this.swellFiles.map(file => file.filename);

        /** remove undefined elements */
        fileNames = fileNames.filter(filename => {
            if (filename) return filename;
        })

        return fileNames;
    }

    /**
     * utility function used in uploadImagesFromFolder() method
     * 
     * @param filePath - absolute path of file
     * @param filename - example: 'funny-picture.jpg'
     */
    async  #uploadImage(filePath: any, filename: string): Promise<void> {
        const file = fs.readFileSync(filePath);
        const dimensions = sizeOf(filePath)
        const base64 = file.toString('base64');

        await this.swell.post('/:files', {
            data: {
                $binary: base64,
                $type: '00',
            },
            filename,
            content_type: mime.lookup(filename),
            width: dimensions.width,
            height: dimensions.height,
        })
    }

    /**
    * If there's no product with the matching slug from woocommerce, create it
    * If there is a matching product, update it
    * 
    * @param product - woocommerce product object returned from woo API 
    * @returns 
    */
    async #createOrUpdateProduct(product: Woo.Product, categories: Swell.Category[], customFields?: FieldMap[]): Promise<{ action: string, product: Swell.Product }> {

        if (!product.slug) {
            Log.warn(`woo product ${chalk.yellow(product.name)} doesn't contain a slug, cannot sync`)
            return { action: 'skipped', product: {} };
        }

        /** create tag array */
        let tags: string[] | undefined;
        if (product.tags?.length) {
            tags = product.tags.map(tag => tag.name)
        }

        /** So we can find a swell category ID using the slug */
        const swellCategories = getReducedObject(categories, 'slug', 'id') as CategoryObject;

        let categoryId = product.categories && product.categories.length ? swellCategories[product.categories[0].slug] : undefined;
        let newProduct: Swell.Product = {
            $migrate: true,
            name: product.name,
            sku: product.sku,
            description: product.description,
            price: parseFloat(product.price || "0"),
            sale_price: product.sale_price ? parseFloat(product.sale_price) : undefined,
            category_id: categoryId,
            slug: product.slug,
            tags: tags,
            shipment_weight: product.weight ? parseFloat(product.weight) : undefined,
            active: product.status === "publish",
            options: product.attributes?.map(att => {
                return {
                    name: att.name,
                    input_type: 'select',
                    values: att.options.map((option: string) => { return { name: option } })
                } as Swell.ProductOption;
            })
        }

        /** if the woo product contains dimensions, include dimensions */
        if (product.dimensions?.height) {
            newProduct.shipment_dimensions = {
                length: parseFloat(product.dimensions.length),
                width: parseFloat(product.dimensions.width),
                height: parseFloat(product.dimensions.height),
            }
        }

        /** if custom fields are supplied */
        if (customFields && customFields.length) {
            for (const fieldMap of customFields) {
                newProduct[fieldMap.swell] = product[fieldMap.woo];
            }
        }

        /** if stock quantity is set in woo, turn on stock tracking in swell
         * and update stock level 
         * */
        if(product.stock_quantity !== null){
            newProduct.stock_tracking = true;
            newProduct.stock_level = product.stock_quantity;
        }

        const response = await this.swell.get('/products', { where: { slug: product.slug } })

        /** product doesn't exist, create it and return the created product */
        if (!response.count) {
            const res = await this.swell.post('/products', newProduct)
            return { action: 'created', product: res }
        }

        /** update product and return updated product*/
        const res = await this.swell.put(`/products/${response.results[0].id}`, { $set: newProduct });

        return { action: 'updated', product: res }

    }

    /**
     * 
     * @param options 
     * @param options.loadFromFile
     * @param options.pages
     */
    async getWooCustomers(options?: { loadFromFile?: boolean, pages?: Pages }) {
        let customers: Woo.Customer[] = [];

        if (options?.loadFromFile && !options.pages && fs.existsSync(this.paths.wooImageJson)) {
            customers = JSON.parse(fs.readFileSync(this.paths.wooCustomers, 'utf-8')) as Woo.Customer[];
            Log.info(`${Object.keys(customers).length} customer records loaded from ${this.paths.wooCustomers}`)
            return customers;
        }

        customers = await this.getAllPagesWoo('customers', options) as Woo.Customer[];
        return customers;
    }

    async getSwellCustomers(options?: { loadFromFile?: boolean, pages?: Pages }) {

        let customers: Swell.Account[] = [];

        if (options?.loadFromFile && !options.pages && fs.existsSync(this.paths.wooImageJson)) {
            customers = JSON.parse(fs.readFileSync(this.paths.wooCustomers, 'utf-8')) as Swell.Account[];
            Log.info(`${Object.keys(customers).length} customer records loaded from ${this.paths.wooCustomers}`)
            return customers;
        }

        customers = await this.getAllPagesSwell('/accounts', options) as Swell.Account[];
        return customers;

    }

    /**
     * 
     * Migrate customers in batches using the Swell `migrate` feature.  
     * Duplicate records will be skipped (using `email` field as unique identifier)
     * 
     * @param options 
     * 
     * @param options.pagesPerBatch how many woocommerce pages of customer records to import per batch.  
     * The default number of records per page in woocommerce is 10. Swell recommends less than 1,000 
     * records per batch, which would be 100 pages. Defaults to 1.
     * 
     * @param options.pages if you want to only migrate a subset of woocommerce pages of customers 
     * records, provide the pages option. `pages: { first: 100, last: 200 }`. You can ommit the `last` 
     * page property to start migration at a certain point and continue to the end. example:
     * `pages: { first: 150 }`
     */
    async migrateCustomers(options?: MigrateCustomersOptions): Promise<MigrateCustomersCount> {

        const count = { created: 0, skipped: 0 }
        const totalPages = await this.getTotalPages('customers');
        const pagesPerBatch = options?.pagesPerBatch || 1;
        const firstPage = options?.pages?.first || 1;
        const lastPage = options?.pages?.last || totalPages;

        /** loop through batches of pages  */
        for (let i = firstPage; i <= lastPage; i += pagesPerBatch) {
                const wooCustomers = await this.getAllPagesWoo('customers', {
                    pages: { first: i, last: i + pagesPerBatch -1 } 
                }) as Woo.Customer[];

            /** build the batch payload for import */
            const batchPayload = wooCustomers.map(customer => {
                return ({ url: '/accounts', data: this.#getAccountObjFromCustomer(customer), method: 'POST' })
            })

            /** confirm account was created by checking type of response */
            function isAccount(obj: any): obj is Swell.Account {
                return obj.id !== undefined 
              }
            
            /** create records */
            Log.info(`attempting to create ${batchPayload.length} records`)
            const res = await this.swell.post('/:batch', batchPayload);
            let created = 0, skipped = 0;

            res.forEach((element: Swell.ErrorResponse | Swell.Account) => {
                if(isAccount(element)){
                    created ++;
                }else{
                    skipped ++;
                }
            })

            Log.event(`${chalk.green('Created')}: ${created}`)
            Log.event(`${chalk.yellow('Skipped')}: ${skipped}`);

            count.created += created;
            count.skipped += skipped;

        }

        return count;
    }

    #getAccountObjFromCustomer(customer: Woo.Customer): Swell.Account {

        /** set type to company if there is a company name  */
        const type = customer.billing?.company ? "business" : "individual";

        const account: Swell.Account = {
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            name: type === "business" ? customer.billing?.company : undefined,
            phone: customer.billing?.phone,
            type: type,
            billing: {
                first_name: customer.billing?.first_name,
                last_name: customer.billing?.last_name,
                address1: customer.billing?.address_1,
                company: customer.billing?.company,
                address2: customer.billing?.address_2,
                city: customer.billing?.city,
                state: customer.billing?.state,
                zip: customer.billing?.postcode ? parseInt(customer.billing?.postcode) : undefined,
                country: customer.billing?.country,
                phone: customer.billing?.phone,
            },
            shipping: {
                first_name: customer.shipping?.first_name,
                last_name: customer.shipping?.last_name,
                company: customer.shipping?.company,
                address1: customer.shipping?.address_1,
                address2: customer.shipping?.address_2,
                city: customer.shipping?.city,
                state: customer.shipping?.state,
                zip: customer.shipping?.postcode ? parseInt(customer.shipping.postcode) : undefined,
                country: customer.shipping?.country,
            }
        }

        return account;
    }
}

export default WooSwell;