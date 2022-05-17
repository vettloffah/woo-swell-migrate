import WooSwell from '../WooSwell';
import * as Log from '../utils/Log';
import * as Swell from '../types/Swell';

import { GetAllPagesSwellOptions, GetAllPagesWooOptions } from '../types/types';

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
  export async function getAllPagesSwell(this: WooSwell, endpoint: string, options?: GetAllPagesSwellOptions): Promise<object[]> {

    const queryOptions = { ...options?.queryOptions }
    if(!queryOptions.limit){
        queryOptions.limit = 100;
    }

    const res = await this.swell.get(endpoint, queryOptions) as Swell.GenericResponse
    const numPerPage = res.results.length;
    const totalPages = Math.ceil(res.count / numPerPage)

    const firstPage = options?.pages?.first || 1;
    const lastPage = options?.pages?.last || totalPages;

    const records = [];

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
export async function getAllPagesWoo(this: WooSwell, endpoint: string, options?: GetAllPagesWooOptions): Promise<object[]> {
    Log.info(`getting woo ${endpoint} records from API`)
    
    const perPage = options?.limit || 100;
    const res = await this.woo.get(endpoint, { per_page: perPage });
    const firstPage = options?.pages?.first || 1;
    const lastPage = options?.pages?.last || parseInt(res.headers['x-wp-totalpages']);
    const records = [];

    for (let i = firstPage; i <= lastPage; i++) {
        const response = await this.woo.get(endpoint, { per_page: perPage, page: i });
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
export async function getTotalPages(this: WooSwell, endpoint: string, perPage?: number): Promise<number> {
    Log.info(`getting page count from woocommerce`);
    const res = await this.woo.get(endpoint, { per_page: perPage });
    return parseInt(res.headers['x-wp-totalpages'])
}