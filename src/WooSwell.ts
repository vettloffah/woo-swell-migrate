import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api/index.mjs";
import swell from "swell-node";
import path from "path";

import * as Woo from "./types/WooCommerce";
import * as Swell from "./types/Swell";
import {
    WooConfig,
    SwellConfig,
    DirPaths,
    FilePaths,
} from "./types/types";

/** Class Methods  */
import { migrateCustomers, getSwellCustomers, getWooCustomers } from "./methods/customers.js";
import { migrateOrders } from "./methods/orders.js";
import { createOrUpdateProducts } from "./methods/products.js";
import { createOrUpdateCategories, deleteUnmatchedCategories, addCategoryParents } from "./methods/categories.js";
import { attachImagesToProducts, uploadImagesFromFolder } from "./methods/images.js";
import { getAllPagesSwell, getAllPagesWoo, getTotalPages } from "./methods/utils.js";

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
            wooImageJson: path.resolve(paths.data, "woo-images.json"),
            wooProducts: path.resolve(paths.data, "woo-products.json"),
            wooCustomers: path.resolve(paths.data, "woo-customers.json"),
            swellProducts: path.resolve(paths.data, "swell-products.json"),
            swellCategories: path.resolve(paths.data, "swell-categories.json"),
            swellAccounts: path.resolve(paths.data, "swell-accounts.json"),
        };
        this.wooCategories = [];
        this.swellCategories = [];
        this.swellFiles = [];
    }

    /** Categories */
    public createOrUpdateCategories = createOrUpdateCategories;
    public addCategoryParents = addCategoryParents;
    public deleteUnmatchedCategories = deleteUnmatchedCategories;
    /** Products */
    public createOrUpdateProducts = createOrUpdateProducts;
    /** Images */
    public uploadImagesFromFolder = uploadImagesFromFolder;
    public attachImagesToProducts = attachImagesToProducts;
    /** Customers */
    public migrateCustomers = migrateCustomers;
    public getSwellCustomers = getSwellCustomers;
    public getWooCustomers = getWooCustomers;
    /** Orders */
    public migrateOrders = migrateOrders;
    /** Utilities */
    public getAllPagesSwell = getAllPagesSwell;
    public getAllPagesWoo = getAllPagesWoo;
    public getTotalPages = getTotalPages;
}

export default WooSwell;
