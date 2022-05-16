import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api/index.mjs';
import swell from 'swell-node';
import path from "path";

import * as Log from './utils/Log.js';
import * as Woo from './types/WooCommerce';
import * as Swell from './types/Swell';
import {
    WooConfig,
    SwellConfig,
    GetAllPagesSwellOptions,
    GetAllPagesWooOptions,
    DirPaths,
    FilePaths
} from './types/types';

/** Class Methods  */
import { migrateCustomers, getSwellCustomers, getWooCustomers } from './methods/customers.js';
import { migrateOrders } from './methods/orders.js';
import { createOrUpdateProducts } from './methods/products.js';
import { createOrUpdateCategories, deleteUnmatchedCategories, addCategoryParents } from './methods/categories.js';
import { attachImagesToProducts, uploadImagesFromFolder } from './methods/images.js';

class WooSwell {

    swell: swell;
    woo: WooCommerceRestApi;
    swellCategories: Swell.Category[];
    wooCategories: Woo.Category[];
    paths: FilePaths;
    swellFiles: Swell.File[];

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
            swellProducts: path.resolve(paths.data, 'swell-products.json'),
            swellCategories: path.resolve(paths.data, 'swell-categories.json'),
            swellAccounts: path.resolve(paths.data, 'swell-accounts.json'),
        }
        this.wooCategories = [];
        this.swellCategories = [];
        this.swellFiles = [];
    }

    /** Class Methods */
    public createOrUpdateCategories = createOrUpdateCategories;
    public addCategoryParents = addCategoryParents;
    public deleteUnmatchedCategories = deleteUnmatchedCategories;
    public createOrUpdateProducts = createOrUpdateProducts;

    public uploadImagesFromFolder = uploadImagesFromFolder;
    public attachImagesToProducts = attachImagesToProducts;

    public migrateCustomers = migrateCustomers;
    public getSwellCustomers = getSwellCustomers;
    public getWooCustomers = getWooCustomers;

    public migrateOrders = migrateOrders;

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
            const res = await this.swell.get(endpoint, { ...queryOptions, page: i }) as Swell.GenericResponse
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
        Log.info(`getting woo ${endpoint} records from API`)
        
        const perPage = options?.limit || 100;
        const res = await this.woo.get(endpoint, { per_page: perPage });
        const firstPage = options?.pages?.first || 1;
        const lastPage = options?.pages?.last || parseInt(res.headers['x-wp-totalpages']);
        const records = [];

        for (let i = firstPage; i <= lastPage; i++) {
            let response = await this.woo.get(endpoint, { per_page: perPage, page: i });
            records.push(...response.data);
            Log.event(`page ${i}/${lastPage}`)
        }

        Log.info(`${records.length} records retrieved`)
        return records;

    }

    /**
     * Get the total number of pages of records from woocommerce API endpoint.
     * 
     * @returns number of total product pages
     */
    async getTotalPages(endpoint: string, perPage?: number): Promise<number> {
        Log.info(`getting page count from woocommerce`);
        const res = await this.woo.get(endpoint, { per_page: perPage });
        return parseInt(res.headers['x-wp-totalpages'])
    }


}


export default WooSwell;