import WooSwell from '../index';
import chalk from 'chalk';
import * as Log from '../utils/Log.js';
import fs from 'fs';
import getReducedObject from '../utils/getReducedObject.js';

import * as Woo from '../types/WooCommerce';
import * as Swell from '../types/Swell';
import { MigrateOrdersOptions, MigrateOrdersCount } from '../types/types';


/**
 * 
 * @param options optional options object
 * 
 * @param options.loadFromFile use data files if they exist from executing this 
 * function or others in the library.
 * 
 * @param options.pagesPerBatch how many pages of records to import 
 * per batch. Default is 1, which is 100 records by default.
 * 
 * @returns count of records created and skipped
 */
export async function migrateOrders(this: WooSwell, options: MigrateOrdersOptions): Promise<MigrateOrdersCount> {

    Log.info(`building customer and product translation objects`);
    const productTransObj = await _getProductTranslationObj.call(this, { loadFromFile: options?.loadFromFile });
    const customerObj = await _getCustomerTranslationObj.call(this, { loadFromFile: options?.loadFromFile });
    
    const count = { created: 0, skipped: 0 }
    const totalPages = await this.getTotalPages('orders', 100);
    const pagesPerBatch = options?.pagesPerBatch || 1;
    const firstPage = options?.pages?.first || 1;
    const lastPage = options?.pages?.last || totalPages;

    /** translate woo status to swell status */
    enum StatusEnum {
        "pending" = "pending",
        "processing" = "pending",
        "on-hold" = "hold",
        "completed" = "complete",
        "cancelled" = "canceled",
        "refunded" = "canceled",
        "failed" = "canceled",
        "trash" = "canceled"
    }
    /** loop through batches of pages  */
    for (let i = firstPage; i <= lastPage; i += pagesPerBatch) {

        /** calculate last page of batch based on pages per batch */
        const last = (i + pagesPerBatch - 1) < lastPage ? (i + pagesPerBatch - 1) : lastPage;

        /** get pages of records */
        const wooOrders = await this.getAllPagesWoo('orders', {
            pages: { first: i, last: last }
        }) as Woo.Order[];

        /** build the batch payload for import */
        const batchPayload = wooOrders.map(order => {
            /** line items */
            const items: Swell.Item[] = order.line_items.map(lineItem => {
                return {
                    product_id: productTransObj[lineItem.product_id],
                    price: lineItem.price,
                    quantity: lineItem.quantity,
                    price_total: parseFloat(lineItem.total),
                    tax_total: lineItem.total_tax ? parseFloat(lineItem.total_tax) : 0.00,
                }
            })

            const { billing, shipping } = getAddressesFromOrder(order);
            const paid = order.status === "completed" || order.status === "processing";
            const subTotal = parseFloat(order.total) - parseFloat(order.total_tax) - parseFloat(order.shipping_total);

            /** order */
            const swellOrder: Swell.Order = {
                $migrate: true,
                number: parseInt(order.number),
                date_created: order.date_created,
                status: StatusEnum[order.status],
                account_id: customerObj[order.customer_id],

                items,
                billing,
                shipping,

                tax_total: parseFloat(order.total_tax),
                sub_total: subTotal,
                grand_total: parseFloat(order.total),
                shipment_total: parseFloat(order.shipping_total),
                shipment_price: parseFloat(order.shipping_total) - parseFloat(order.shipping_tax),
                shipment_tax_included_total: parseFloat(order.shipping_total),
                shipment_delivery: !!order.shipping_lines.length,

                paid: paid,
                payment_marked: paid,
                payment_total: paid ? parseFloat(order.total) : 0,
                payment_balance: paid ? 0 : parseFloat(order.total) * -1, // negative balance means customer owes money

                delivery_marked: order.status === "completed",
                delivered: order.status === "completed",

            }
            return ({ url: '/orders', data: swellOrder, method: 'POST' })
        })

        /** confirm account was created by checking type of response */
        function isOrder(obj: any): obj is Swell.Order {
            return obj.id !== undefined
        }

        /** create records */
        Log.info(`attempting to create ${batchPayload.length} records`)
        const res = await this.swell.post('/:batch', batchPayload);
        let created = 0, skipped = 0;

        res.forEach((element: Swell.ErrorResponse | Swell.Order) => {
            if (isOrder(element)) {
                created++;
            } else {
                skipped++;
            }
        })

        Log.event(`${chalk.green('Created')}: ${created}`)
        Log.event(`${chalk.yellow('Skipped')}: ${skipped}`);

        count.created += created;
        count.skipped += skipped;

    }

    return count;
}

/**
 * 
 * @param order woocommmerce order
 * 
 * @return billing and shipping addresses
 */
function getAddressesFromOrder(order: Woo.Order) {
    const addresses = {
        billing: {
            first_name: order.billing?.first_name,
            last_name: order.billing?.last_name,
            address1: order.billing?.address_1,
            company: order.billing?.company,
            address2: order.billing?.address_2,
            city: order.billing?.city,
            state: order.billing?.state,
            zip: order.billing?.postcode ? parseInt(order.billing?.postcode) : undefined,
            country: order.billing?.country,
            phone: order.billing?.phone,
        },
        shipping: {
            first_name: order.shipping?.first_name,
            last_name: order.shipping?.last_name,
            company: order.shipping?.company,
            address1: order.shipping?.address_1,
            address2: order.shipping?.address_2,
            city: order.shipping?.city,
            state: order.shipping?.state,
            zip: order.shipping?.postcode ? parseInt(order.shipping.postcode) : undefined,
            country: order.shipping?.country,
        }

    }

    return addresses
}

/**
 * Provide woocommerce customer id and get swell account id
 * @returns 
 */
 async function _getCustomerTranslationObj(this: WooSwell, options?: { loadFromFile?: boolean }) {

    let swellAccounts;
    let wooCustomers;

    if (options?.loadFromFile && fs.existsSync(this.paths.swellAccounts)) {
        swellAccounts = JSON.parse(fs.readFileSync(this.paths.swellAccounts, 'utf-8')) as Swell.Account[]
        Log.info(`loaded ${swellAccounts.length} swell accounts from file`)
    } else {
        swellAccounts = await this.getAllPagesSwell('/accounts') as Swell.Account[];
        fs.writeFileSync(this.paths.swellAccounts, JSON.stringify(swellAccounts))
    }

    if (options?.loadFromFile && fs.existsSync(this.paths.wooCustomers)) {
        wooCustomers = JSON.parse(fs.readFileSync(this.paths.wooCustomers, 'utf-8')) as Woo.Customer[]
        Log.info(`loaded ${wooCustomers.length} woo customers from file`)
    } else {
        wooCustomers = await this.getAllPagesWoo('customers') as Woo.Customer[];
        fs.writeFileSync(this.paths.wooCustomers, JSON.stringify(wooCustomers));
    }

    const swellEmailObj = getReducedObject(swellAccounts, 'email', 'id') as { [email: string]: string };

    const transObj: { [email: string]: string } = {};

    for (const customer of wooCustomers) {
        transObj[customer.id] = swellEmailObj[customer.email];
    }

    return transObj;

}

/** download all product data from both platforms so we can link products
 * to orders by product ID.
 */
async function _getProductTranslationObj(this: WooSwell, options?: { loadFromFile?: boolean }): Promise<any> {
    let wooProducts: Woo.Product[];
    let swellProducts: Swell.Product[];

    /** get swell products */
    if (options?.loadFromFile && fs.existsSync(this.paths.swellProducts)) {
        swellProducts = JSON.parse(fs.readFileSync(this.paths.swellProducts, 'utf-8'));
        Log.info(`loaded ${swellProducts.length} swell products from file`)
    } else {
        swellProducts = await this.getAllPagesSwell('/products') as Swell.Product[];
        fs.writeFileSync(this.paths.swellProducts, JSON.stringify(swellProducts));
    }

    /** get woo products */
    if (options?.loadFromFile && fs.existsSync(this.paths.wooProducts)) {
        wooProducts = JSON.parse(fs.readFileSync(this.paths.wooProducts, 'utf-8'));
        Log.info(`loaded ${wooProducts.length} woo products from file`)
    } else {
        wooProducts = await this.getAllPagesWoo('products') as Woo.Product[];
        fs.writeFileSync(this.paths.wooProducts, JSON.stringify(wooProducts));
    }

    /** create slug:id swell object */
    const swellSlugObj = getReducedObject(swellProducts, 'slug', 'id') as { [slug: string]: string }

    /** create translation object
     * Object should be woo product id: swell product id
     */
    const transObj: { [wooId: number]: string } = {};
    for (const wooProduct of wooProducts) {
        if (swellSlugObj[wooProduct.slug]) {
            transObj[wooProduct.id] = swellSlugObj[wooProduct.slug]
        }
    }

    return transObj
}