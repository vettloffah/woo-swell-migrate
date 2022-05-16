import WooSwell from '../index';
import chalk from 'chalk';
import * as Log from '../utils/Log.js';
import getReducedObject from '../utils/getReducedObject.js';
import fs from 'fs';

import * as Swell from '../types/Swell';
import * as Woo from '../types/WooCommerce';
import { CreateProductOptions, FieldMap, CategoryObject, GetSwellCategoriesOptions, GetWooProductsOptions } from '../types/types';



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
export async function createOrUpdateProducts(this: WooSwell, options?: CreateProductOptions) {
    const count = { skipped: 0, updated: 0, created: 0 }

    /** set loadFromFile to false if importing a subset of pages */
    let loadFromFile = options?.pages ? false : !!options?.loadFromFile;
    let customFields = options?.customFields;

    const products = await getWooProducts.call(this, { loadFromFile, pages: options?.pages });
    const categories = await _getSwellCategories.call(this, { loadFromFile });

    for (const [index, product] of products.entries()) {
        const { action } = await createOrUpdateProduct.call(this, product, categories, customFields);
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

/**
* If there's no product with the matching slug from woocommerce, create it
* If there is a matching product, update it
* 
* @param product - woocommerce product object returned from woo API 
* @returns 
*/
async function createOrUpdateProduct(this: WooSwell, product: Woo.Product, categories: Swell.Category[], customFields?: FieldMap[]): Promise<{ action: string, product: Swell.Product }> {

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
    if (product.stock_quantity !== null) {
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
 * Delete all products 
 */
export async function deleteAllProducts(this: WooSwell) {
    const products = await this.getAllPagesSwell('/products') as Swell.Product[]
    let batchPayload = []
    for (const product of products) {
        batchPayload.push({
            url: `/products/${product.id}`,
            method: 'delete'
        })
    }

    const res = await this.swell.post('/:batch', batchPayload)
    Log.info(`deleted ${res.length} records`)
}

 /**
     * @param options optional.
     * 
     * @param options.loadFromFile
     * 
     * @returns swell categories
     */
  async function _getSwellCategories(this: WooSwell, options?: GetSwellCategoriesOptions): Promise<Swell.Category[]> {
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
  export async function getWooProducts(this: WooSwell, options?: GetWooProductsOptions): Promise<Woo.Product[]> {
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

